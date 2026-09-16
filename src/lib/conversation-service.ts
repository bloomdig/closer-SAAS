/**
 * Pipeline de conversation — cœur fonctionnel de CLOSER.
 * =====================================================================
 * Un seul point d’entrée pour TOUS les canaux (chat web, WhatsApp, Instagram) :
 *
 *   message entrant → enregistrement → construction du contexte → Gemini
 *   → exécution des outils → enregistrement de la réponse → renvoi au canal
 *
 * Corrige B1, B2, B3 : l’historique est lu en base, la réponse y est écrite,
 * et `conversationId` est réellement utilisé.
 *
 * Gère aussi la reprise en main humaine (§12) : en mode `manual`, l’IA ne
 * répond pas ; en mode `approval`, elle prépare un brouillon à valider.
 */
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { conversations, customers, messages } from "@/db/schema";
import * as repo from "@/lib/repositories";
import {
  buildFallbackReply,
  detectLanguage,
  generateSalesReply,
  isAiConfigured,
} from "@/lib/ai/engine";
import { executeAiTool } from "@/lib/ai/tool-executor";
import type { HandoffMode } from "@/db/schema";

export type InboundInput = {
  merchantId: string;
  source: "web" | "whatsapp" | "instagram" | "facebook" | "sms" | "email";
  /** Identifiant du fil côté fournisseur (WhatsApp/Instagram). */
  externalConversationId?: string | null;
  externalMessageId?: string | null;
  content: string;
  from?: { phone?: string | null; name?: string | null } | null;
  customerId?: string | null;
  conversationId?: string | null;
};

export type InboundResult = {
  conversationId: string;
  customerId: string | null;
  inboundMessageId: string;
  language: string;
  handoffMode: HandoffMode;
  /** Réponse à renvoyer au client (null en mode approval/manual). */
  reply: string | null;
  replyMessageId: string | null;
  /** Brouillon créé en mode approval, à valider par le marchand. */
  draftMessageId: string | null;
  aiUsed: boolean;
  escalatedToHuman: boolean;
  toolResults: { name: string; ok: boolean; error?: string }[];
  degraded: boolean;
  error?: string | null;
};

/** Résout (ou crée) la conversation + le client, dans le périmètre du marchand. */
export async function resolveConversation(input: InboundInput) {
  // 1. Conversation existante par identifiant interne
  if (input.conversationId) {
    const existing = await repo.getConversation(input.merchantId, input.conversationId);
    if (existing) return { conversation: existing, customer: null as null | typeof customers.$inferSelect };
  }

  // 2. Conversation existante par identifiant externe (WhatsApp / Instagram)
  if (input.externalConversationId) {
    const byExternal = await repo.findConversationByExternalId(
      input.merchantId,
      input.source,
      input.externalConversationId,
    );
    if (byExternal) {
      const customer = byExternal.customerId
        ? await repo.getCustomer(input.merchantId, byExternal.customerId)
        : null;
      return { conversation: byExternal, customer };
    }
  }

  // 3. Client par téléphone, puis conversation ouverte récente sur le web
  let customer: typeof customers.$inferSelect | null = null;
  if (input.customerId) {
    customer = await repo.getCustomer(input.merchantId, input.customerId);
  }
  if (!customer && input.from?.phone) {
    const { customer: found } = await repo.findOrCreateCustomerByPhone(
      input.merchantId,
      { phone: input.from.phone, name: input.from.name ?? null },
    );
    customer = found;
  }

  if (customer) {
    const rows = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.merchantId, input.merchantId),
          eq(conversations.customerId, customer.id),
          eq(conversations.status, "open"),
        ),
      )
      .limit(1);

    if (rows[0]) return { conversation: rows[0], customer };
  }

  // 4. Création
  const settings = await repo.getSettings(input.merchantId);
  const conversation = await repo.createConversation(input.merchantId, {
    customerId: customer?.id ?? null,
    source: input.source,
    externalId: input.externalConversationId ?? null,
    status: "open",
    handoffMode: settings?.defaultHandoffMode ?? "ai",
    aiEnabled: settings?.aiEnabled ?? true,
    lastMessageAt: new Date(),
  });

  return { conversation, customer };
}

/** Traite un message client entrant, tous canaux confondus. */
export async function handleInboundMessage(
  input: InboundInput,
): Promise<InboundResult> {
  const { conversation, customer } = await resolveConversation(input);
  const merchantId = input.merchantId;
  const conversationId = conversation.id;
  const language = detectLanguage(input.content);

  // 1. Enregistrement du message client
  const inbound = await repo.insertMessage(merchantId, conversationId, {
    senderType: "customer",
    content: input.content,
    language,
    externalId: input.externalMessageId ?? null,
    status: "sent",
  });

  await repo.touchConversation(merchantId, conversationId, {
    preview: input.content,
    incrementUnread: true,
  });

  if (customer) {
    await repo.updateCustomer(merchantId, customer.id, {
      lastInteractionAt: new Date(),
    });
  }

  const base: InboundResult = {
    conversationId,
    customerId: conversation.customerId ?? customer?.id ?? null,
    inboundMessageId: inbound.id,
    language,
    handoffMode: conversation.handoffMode,
    reply: null,
    replyMessageId: null,
    draftMessageId: null,
    aiUsed: false,
    escalatedToHuman: conversation.needsHumanReview,
    toolResults: [],
    degraded: false,
    error: null,
  };

  // 2. Mode manuel : l’IA ne répond pas (§12)
  if (!conversation.aiEnabled || conversation.handoffMode === "manual") {
    await flagForHumanIfNeeded(merchantId, conversationId, conversation.handoffMode);
    return { ...base, handoffMode: conversation.handoffMode };
  }

  // 3. IA non configurée : état honnête, jamais de fausse réponse (§41)
  if (!isAiConfigured()) {
    return {
      ...base,
      error: "gemini_not_configured",
      degraded: true,
    };
  }

  // 4. Génération avec mémoire de conversation
  let result;
  try {
    result = await generateSalesReply(
      {
        merchantId,
        conversationId,
        customerMessage: input.content,
        customerId: base.customerId,
        language,
      },
      {
        executeTool: executeAiTool,
        /**
         * L’enregistrement est volontairement piloté par ce service et non par
         * le moteur : le statut dépend du mode (envoi immédiat en mode IA,
         * brouillon à valider en mode APPROVAL).
         */
        persistReply: async () => {},
      },
    );
  } catch (error) {
    console.error("[conversation] échec IA:", error);
    return {
      ...base,
      error: error instanceof Error ? error.message : "ai_error",
      degraded: true,
      reply: process.env.AI_FALLBACK_ENABLED === "true" ? buildFallbackReply() : null,
    };
  }

  const escalated = Boolean(result.sideEffects.flagForHumanReview);

  // 5. Effets de bord demandés par les outils (passage en manuel, alerte)
  if (result.sideEffects.setHandoffMode || escalated) {
    await db
      .update(conversations)
      .set({
        handoffMode: result.sideEffects.setHandoffMode ?? conversation.handoffMode,
        aiEnabled: result.sideEffects.setHandoffMode === "manual" ? false : conversation.aiEnabled,
        needsHumanReview: escalated || conversation.needsHumanReview,
        reviewReason: result.sideEffects.reviewReason ?? conversation.reviewReason,
        customerId: base.customerId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.merchantId, merchantId),
        ),
      );
  }

  if (!result.reply) {
    return {
      ...base,
      escalatedToHuman: escalated,
      toolResults: result.toolResults,
      degraded: result.degraded,
      error: result.error ?? null,
    };
  }

  // 6. Mode validation : brouillon à approuver par le marchand
  if (conversation.handoffMode === "approval") {
    const draft = await repo.insertMessage(merchantId, conversationId, {
      senderType: "ai",
      content: result.reply,
      language: result.language,
      aiGenerated: true,
      status: "draft",
      toolCalls: result.toolResults,
      tokensUsed: result.tokensUsed,
    });
    await repo.incrementUsage(merchantId, "ai_drafts");

    return {
      ...base,
      handoffMode: "approval",
      draftMessageId: draft.id,
      reply: null,
      aiUsed: true,
      escalatedToHuman: escalated,
      toolResults: result.toolResults,
      degraded: result.degraded,
    };
  }

  // 7. Mode IA : envoi immédiat
  const reply = await repo.insertMessage(merchantId, conversationId, {
    senderType: "ai",
    content: result.reply,
    language: result.language,
    aiGenerated: true,
    status: "sent",
    toolCalls: result.toolResults,
    tokensUsed: result.tokensUsed,
  });

  await repo.touchConversation(merchantId, conversationId, {
    preview: result.reply,
    incrementUnread: false,
  });
  await repo.incrementUsage(merchantId, "ai_messages");

  return {
    ...base,
    reply: result.reply,
    replyMessageId: reply.id,
    aiUsed: true,
    escalatedToHuman: escalated,
    toolResults: result.toolResults,
    degraded: result.degraded,
  };
}

/** Signale la conversation si un humain doit intervenir. */
async function flagForHumanIfNeeded(
  merchantId: string,
  conversationId: string,
  mode: HandoffMode,
) {
  if (mode !== "manual") return;
  await db
    .update(conversations)
    .set({ needsHumanReview: true, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.merchantId, merchantId),
      ),
    );
}

/* ------------------------------------------------------------------ */
/* Sortant : messages écrits par le marchand                           */
/* ------------------------------------------------------------------ */

export async function sendAgentMessage(params: {
  merchantId: string;
  conversationId: string;
  authorId: string;
  content: string;
}) {
  const conversation = await repo.getConversation(params.merchantId, params.conversationId);
  if (!conversation) return null;

  const message = await repo.insertMessage(params.merchantId, params.conversationId, {
    senderType: "agent",
    authorId: params.authorId,
    content: params.content,
    status: "sent",
  });

  // Un humain qui répond reprend la main : l’IA se met en pause (§12).
  await db
    .update(conversations)
    .set({
      handoffMode: "manual",
      aiEnabled: false,
      needsHumanReview: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, params.conversationId),
        eq(conversations.merchantId, params.merchantId),
      ),
    );

  await repo.touchConversation(params.merchantId, params.conversationId, {
    preview: params.content,
    incrementUnread: false,
  });

  return message;
}

/** Approuve un brouillon IA (mode validation) et le marque comme envoyé. */
export async function approveDraft(params: {
  merchantId: string;
  conversationId: string;
  messageId: string;
  editedContent?: string | null;
}) {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.id, params.messageId),
        eq(messages.conversationId, params.conversationId),
        eq(messages.merchantId, params.merchantId),
        eq(messages.status, "draft"),
      ),
    )
    .limit(1);

  const draft = rows[0];
  if (!draft) return null;

  const content = params.editedContent?.trim() || draft.content;

  const [updated] = await db
    .update(messages)
    .set({ content, status: "sent" })
    .where(
      and(eq(messages.id, draft.id), eq(messages.merchantId, params.merchantId)),
    )
    .returning();

  await repo.touchConversation(params.merchantId, params.conversationId, {
    preview: content,
    incrementUnread: false,
  });
  await repo.incrementUsage(params.merchantId, "ai_messages");

  return updated;
}

/** Refuse un brouillon IA. */
export async function rejectDraft(params: {
  merchantId: string;
  conversationId: string;
  messageId: string;
  reason?: string | null;
}) {
  const [updated] = await db
    .update(messages)
    .set({
      status: "failed",
      error: params.reason ?? "Brouillon refusé par le marchand.",
    })
    .where(
      and(
        eq(messages.id, params.messageId),
        eq(messages.conversationId, params.conversationId),
        eq(messages.merchantId, params.merchantId),
        eq(messages.status, "draft"),
      ),
    )
    .returning();

  return updated ?? null;
}
