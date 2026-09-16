/**
 * Moteur IA CLOSER — Gemini avec mémoire de conversation + appels d’outils.
 * =====================================================================
 * Résout le problème central du prototype : le modèle ne reçoit plus seulement
 * le dernier message. Le pipeline est :
 *
 *   1. identifier la conversation
 *   2. charger l’historique pertinent (fenêtre glissante + résumé ancien)
 *   3. charger les réglages du marchand
 *   4. charger les produits pertinents (catalogue + recherche mot-clé)
 *   5. charger la fiche client
 *   6. construire le contexte système
 *   7. appeler Gemini (avec function calling)
 *   8. exécuter les outils validés côté serveur
 *   9. enregistrer la réponse dans `messages`
 *
 * La clé API reste strictement côté serveur : jamais exposée, jamais journalisée.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversations,
  customers,
  merchantSettings,
  messages,
  merchants,
  orders,
  products,
  type Conversation,
} from "@/db/schema";
import { ORDER_STATUS_FR } from "@/lib/format";
import { AI_TOOLS, TOOL_LIMITS, isRecord, isKnownTool } from "./tools";
import {
  buildSystemPrompt,
  wrapUntrusted,
  type PromptContext,
  type PromptProduct,
} from "./system-prompt";
import type { ToolExecutionResult, ToolExecutor } from "./tools";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
/** `gemini-pro` est retiré : modèle obsolète, plus servi par l’API. */
const DEPRECATED_MODELS = ["gemini-pro", "gemini-1.0-pro", "text-bison-001"];

const HISTORY_WINDOW = 24;
const HISTORY_MAX_CHARS = 12_000;

export type GenerateInput = {
  merchantId: string;
  conversationId: string;
  /** Message client brut, tel que reçu (entrée non fiable). */
  customerMessage: string;
  customerId?: string | null;
  /** Code langue détecté, si connu. */
  language?: string | null;
};

export type GenerateResult = {
  reply: string | null;
  language: string | null;
  toolResults: { name: string; ok: boolean; error?: string }[];
  sideEffects: NonNullable<ToolExecutionResult["sideEffects"]>;
  tokensUsed: number | null;
  degraded: boolean;
  error?: string;
};

export class AiNotConfiguredError extends Error {
  readonly status = 503;
  readonly code = "gemini_not_configured";
  constructor() {
    super("L’IA n’est pas configurée : GEMINI_API_KEY manquante.");
    this.name = "AiNotConfiguredError";
  }
}

export function resolveGeminiModel(): string {
  const configured = (process.env.GEMINI_MODEL ?? "").trim();
  if (!configured) return DEFAULT_GEMINI_MODEL;
  if (DEPRECATED_MODELS.includes(configured.toLowerCase())) {
    console.warn(
      `[ai] le modèle "${configured}" est obsolète, repli sur ${DEFAULT_GEMINI_MODEL}`,
    );
    return DEFAULT_GEMINI_MODEL;
  }
  return configured;
}

export function isAiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY ?? "";
  return key.trim().length > 0;
}

let genAiSingleton: GoogleGenerativeAI | null = null;
function getGenAi(): GoogleGenerativeAI {
  if (!isAiConfigured()) throw new AiNotConfiguredError();
  if (!genAiSingleton) {
    genAiSingleton = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  }
  return genAiSingleton;
}

/* ------------------------------------------------------------------ */
/* 1–5. Construction du contexte                                       */
/* ------------------------------------------------------------------ */

export async function loadMerchantContext(merchantId: string) {
  const [merchant, settings] = await Promise.all([
    db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
      columns: {
        id: true,
        name: true,
        businessName: true,
        locale: true,
        timezone: true,
      },
    }),
    db.query.merchantSettings.findFirst({
      where: eq(merchantSettings.merchantId, merchantId),
    }),
  ]);

  if (!merchant) {
    throw new Error("Marchand introuvable.");
  }
  return { merchant, settings };
}

/**
 * Produits injectés dans le prompt : catalogue actif tronqué + correspondances
 * sur les mots-clés du dernier message (darija/français/arabe).
 */
export async function loadRelevantProducts(
  merchantId: string,
  customerMessage: string,
  limit = 12,
): Promise<PromptProduct[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        inArray(products.status, ["active", "out_of_stock"]),
      ),
    )
    .orderBy(products.position, products.createdAt)
    .limit(200);

  const toPrompt = (p: (typeof rows)[number]): PromptProduct => ({
    id: p.id,
    name: p.name,
    price: p.price,
    salePrice: p.salePrice,
    currency: "MAD",
    inStock: p.status !== "out_of_stock" && (!p.trackStock || p.stock > 0),
    stock: p.trackStock ? p.stock : undefined,
    description: p.description,
    variants: p.variants as unknown[],
    sizes: p.sizes as string[],
    colors: p.colors as string[],
  });

  const query = customerMessage.toLowerCase().trim();
  const words = query
    .split(/[\s,?.!؟،]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 12);

  if (words.length === 0) {
    return rows.slice(0, limit).map(toPrompt);
  }

  const scored = rows
    .map((p) => {
      const haystack = [
        p.name,
        p.description ?? "",
        JSON.stringify(p.searchKeywords ?? []),
        JSON.stringify(p.colors ?? []),
        JSON.stringify(p.sizes ?? []),
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      for (const word of words) {
        if (haystack.includes(word)) score += 2;
      }
      // Un mot du message contenu dans le nom pèse plus lourd.
      if (words.some((w) => p.name.toLowerCase().includes(w))) score += 3;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, limit).map((x) => x.p);
  // Toujours garder quelques produits phares si la recherche est trop étroite.
  const filler = rows.filter((p) => !selected.includes(p)).slice(0, 3);

  return [...selected, ...filler].slice(0, limit).map(toPrompt);
}

async function loadCustomer(merchantId: string, customerId: string | null) {
  if (!customerId) return null;
  const row = await db.query.customers.findFirst({
    where: and(
      eq(customers.id, customerId),
      eq(customers.merchantId, merchantId),
    ),
  });
  if (!row) return null;
  return {
    name: row.name,
    city: row.city,
    ordersCount: row.ordersCount,
    totalSpent: row.totalSpent,
    notes: row.notes,
  };
}

/**
 * Commandes récentes liées au client OU à cette conversation (§2 :
 * « current order information when applicable »). Toujours scopées au
 * marchand ; 3 plus récentes, articles bornés.
 */
async function loadRecentOrders(
  merchantId: string,
  conversationId: string,
  customerId: string | null,
) {
  const scope = customerId
    ? or(eq(orders.customerId, customerId), eq(orders.conversationId, conversationId))
    : eq(orders.conversationId, conversationId);

  const rows = await db
    .select({
      reference: orders.reference,
      orderStatus: orders.orderStatus,
      total: orders.total,
      createdAt: orders.createdAt,
      items: orders.items,
    })
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), scope))
    .orderBy(desc(orders.createdAt))
    .limit(3);

  return rows.map((row) => ({
    reference: row.reference,
    statusLabel: ORDER_STATUS_FR[row.orderStatus] ?? row.orderStatus,
    total: row.total,
    createdAt: row.createdAt.toISOString(),
    items: (Array.isArray(row.items) ? (row.items as { name?: unknown; quantity?: unknown }[]) : [])
      .slice(0, 5)
      .map((item) => ({
        name: String(item?.name ?? "article"),
        quantity: Number(item?.quantity ?? 1) || 1,
      })),
  }));
}

/** 2. Historique : fenêtre glissante, bornée en caractères, plus récent en dernier. */
async function loadHistory(conversationId: string, merchantId: string) {
  const rows = await db
    .select({
      senderType: messages.senderType,
      content: messages.content,
      createdAt: messages.createdAt,
      status: messages.status,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.merchantId, merchantId),
        // Les brouillons en attente de validation ne sont pas encore envoyés.
        inArray(messages.status, ["sent", "delivered", "read"]),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_WINDOW);

  const ordered = rows.reverse();

  let total = 0;
  const trimmed: typeof ordered = [];
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    total += ordered[i].content.length;
    if (total > HISTORY_MAX_CHARS) break;
    trimmed.unshift(ordered[i]);
  }

  const omitted = ordered.length - trimmed.length;
  return { history: trimmed, omittedBefore: omitted };
}

export function toGeminiHistory(
  history: { senderType: string; content: string }[],
): { role: "user" | "model"; parts: { text: string }[] }[] {
  return history.map((m) => ({
    role: m.senderType === "customer" ? "user" : "model",
    parts: [
      {
        text:
          m.senderType === "customer"
            ? wrapUntrusted(m.content)
            : m.content,
      },
    ],
  }));
}

/* ------------------------------------------------------------------ */
/* 6–8. Génération + outils                                            */
/* ------------------------------------------------------------------ */

export type AiEngineDeps = {
  executeTool: ToolExecutor;
  /** Enregistre la réponse IA en base (messages + maj conversation). */
  persistReply: (input: {
    merchantId: string;
    conversationId: string;
    content: string;
    toolCalls: unknown[];
    tokensUsed: number | null;
  }) => Promise<void>;
};

/** Détection de langue simple et déterministe (fr / ar / darija latine). */
export function detectLanguage(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  const darijaHints =
    /\b(salam|salamo|wach|bghit|bghiti|kayn|kayna|3lach|chhal|mnin|had|hadchi|dial|dyal|bzaf|wakha|sahha|merci\b)/i;
  if (darijaHints.test(text)) return "darija";
  return "fr";
}

export async function generateSalesReply(
  input: GenerateInput,
  deps: AiEngineDeps,
): Promise<GenerateResult> {
  const { merchantId, conversationId, customerMessage } = input;
  const sideEffects: NonNullable<ToolExecutionResult["sideEffects"]> = {};
  const toolResults: GenerateResult["toolResults"] = [];

  if (!isAiConfigured()) {
    throw new AiNotConfiguredError();
  }

  // 1–5. Contexte
  const [{ merchant, settings }, products, history, customer, recentOrders, conversation] =
    await Promise.all([
      loadMerchantContext(merchantId),
      loadRelevantProducts(merchantId, customerMessage),
      loadHistory(conversationId, merchantId),
      loadCustomer(merchantId, input.customerId ?? null),
      loadRecentOrders(merchantId, conversationId, input.customerId ?? null),
      db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, conversationId),
          eq(conversations.merchantId, merchantId),
        ),
      }) as Promise<Conversation | undefined>,
    ]);

  // L’IA ne répond pas si la conversation est passée en manuel.
  if (conversation && (!conversation.aiEnabled || conversation.handoffMode === "manual")) {
    return {
      reply: null,
      language: input.language ?? detectLanguage(customerMessage),
      toolResults,
      sideEffects,
      tokensUsed: null,
      degraded: false,
      error: "conversation_en_mode_manuel",
    };
  }

  // 6. Prompt système
  const promptContext: PromptContext = {
    businessName: merchant.businessName ?? merchant.name,
    businessDescription: settings?.businessDescription ?? null,
    tone: settings?.tone ?? "professional",
    preferredLanguage: settings?.preferredLanguage ?? "fr",
    currency: settings?.currency ?? "MAD",
    openingHours: (settings?.openingHours as unknown[]) ?? [],
    deliveryFeeDefault: settings?.deliveryFeeDefault ?? 0,
    deliveryZones: (settings?.deliveryZones as never) ?? [],
    deliveryEta: {
      min: settings?.deliveryEtaDaysMin ?? null,
      max: settings?.deliveryEtaDaysMax ?? null,
    },
    freeShippingThreshold: settings?.freeShippingThreshold ?? null,
    returnPolicy: settings?.returnPolicy ?? null,
    exchangePolicy: settings?.exchangePolicy ?? null,
    faq: (settings?.faq as never) ?? [],
    promotions: (settings?.promotions as never) ?? [],
    customInstructions: settings?.customInstructions ?? null,
    products,
    customer,
    recentOrders,
    nowIso: new Date().toISOString(),
  } as PromptContext;

  const systemPrompt = buildSystemPrompt(promptContext);

  const model = getGenAi().getGenerativeModel({
    model: resolveGeminiModel(),
    systemInstruction: systemPrompt,
    tools: [
      {
        functionDeclarations: AI_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          // Schéma JSON simplifié attendu par le SDK.
          parameters: tool.parameters as never,
        })),
      },
    ],
    generationConfig: {
      temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.7),
      maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1024),
      topP: 0.95,
    },
  });

  const chat = model.startChat({
    history: toGeminiHistory(history.history),
  });

  // 7. Appel au modèle
  const result = await chat.sendMessage(wrapUntrusted(customerMessage));
  const response = result.response;

  let tokensUsed: number | null = null;
  const usage = response.usageMetadata;
  if (usage?.totalTokenCount) tokensUsed = usage.totalTokenCount;

  // 8. Exécution des outils — boucle bornée, validation serveur systématique
  let text = response.text().trim();
  let calls = response.functionCalls() ?? [];
  let iterations = 0;

  while (calls.length > 0 && iterations < 3) {
    iterations += 1;
    const responses: { name: string; response: unknown }[] = [];

    for (const call of calls.slice(0, TOOL_LIMITS.maxToolCallsPerTurn)) {
      const args = isRecord(call.args) ? call.args : {};

      if (!isKnownTool(call.name)) {
        responses.push({
          name: call.name,
          response: { ok: false, error: "Outil inconnu." },
        });
        continue;
      }

      let outcome: ToolExecutionResult;
      try {
        outcome = await deps.executeTool(call.name, args, {
          merchantId,
          conversationId,
          customerId: input.customerId ?? null,
          locale: merchant.locale ?? "fr-MA",
        });
      } catch (error) {
        outcome = {
          ok: false,
          error:
            error instanceof Error
              ? `Action impossible : ${error.message}`
              : "Action impossible.",
        };
      }

      if (outcome.sideEffects) Object.assign(sideEffects, outcome.sideEffects);
      toolResults.push({
        name: call.name,
        ok: outcome.ok,
        error: outcome.error,
      });

      responses.push({
        name: call.name,
        response: outcome.ok
          ? { ok: true, result: outcome.data ?? null }
          : { ok: false, error: outcome.error ?? "Échec de l’action." },
      });
    }

    const next = await chat.sendMessage(responses as never);
    const nextResponse = next.response;
    if (nextResponse.usageMetadata?.totalTokenCount) {
      tokensUsed = (tokensUsed ?? 0) + nextResponse.usageMetadata.totalTokenCount;
    }
    const nextText = nextResponse.text().trim();
    if (nextText) text = nextText;
    calls = nextResponse.functionCalls() ?? [];
  }

  if (!text) {
    return {
      reply: null,
      language: detectLanguage(customerMessage),
      toolResults,
      sideEffects,
      tokensUsed,
      degraded: true,
      error: "reponse_vide",
    };
  }

  // 9. Persistance
  await deps.persistReply({
    merchantId,
    conversationId,
    content: text,
    toolCalls: toolResults,
    tokensUsed,
  });

  return {
    reply: text,
    language: detectLanguage(text),
    toolResults,
    sideEffects,
    tokensUsed,
    degraded: false,
  };
}

/**
 * Message de repli honnête : jamais de fausse réponse IA.
 * Utilisé quand Gemini n’est pas configuré ou en erreur.
 */
export function buildFallbackReply(): string {
  return (
    "Salam, merci pour votre message. Un conseiller vous répond très rapidement. " +
    "Merci de votre patience."
  );
}
