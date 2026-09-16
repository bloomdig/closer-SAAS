/**
 * Exécuteur des automatisations (§15).
 * =====================================================================
 * Déclenché par Vercel Cron sur `/api/cron/automations` (protégé par
 * `CRON_SECRET`). Propriétés garanties :
 *
 *  - idempotent   : une exécution par (règle, conversation), verrou SQL
 *  - borné        : `AUTOMATION_BATCH_SIZE` exécutions par passage
 *  - anti-spam    : limite quotidienne marchand + limite par client + heures calmes
 *  - journalisé   : chaque décision (envoyé / ignoré + raison) est écrite
 *  - honnête      : canal non connecté → `skipped`, jamais d’envoi simulé
 */
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  automationRules,
  automationRuns,
  conversations,
  customers,
  merchants,
  messages,
  orders,
  products,
} from "@/db/schema";
import {
  isInQuietHours,
  renderTemplate,
  type AutomationConfig,
  type AutomationType,
} from "./types";
import { formatMad } from "@/lib/products/types";

export type RunSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: { type: string; conversationId: string; outcome: string }[];
};

const BATCH_SIZE = Number(process.env.AUTOMATION_BATCH_SIZE ?? 50);

/** Point d’entrée appelé par le cron. */
export async function processDueAutomations(limit = BATCH_SIZE): Promise<RunSummary> {
  const summary: RunSummary = { processed: 0, sent: 0, skipped: 0, failed: 0, details: [] };

  // 1. Candidats détectés pour chaque règle active
  const rules = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.enabled, true))
    .limit(50);

  if (rules.length === 0) return summary;

  for (const rule of rules) {
    const candidates = await findCandidates(rule, limit);

    for (const candidate of candidates) {
      if (summary.processed >= limit) return summary;
      summary.processed += 1;

      const outcome = await evaluateAndRun(rule, candidate.conversationId, candidate.customerId);
      summary[outcome.kind] += 1;
      summary.details.push({
        type: rule.type,
        conversationId: candidate.conversationId,
        outcome: outcome.reason,
      });
    }
  }

  // 2. Exécutions déjà planifiées et arrivées à échéance
  const due = await db
    .select()
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.status, "pending"),
        lte(automationRuns.scheduledFor, new Date()),
      ),
    )
    .limit(limit);

  for (const run of due) {
    if (summary.processed >= limit) break;
    summary.processed += 1;

    const rule = await db.query.automationRules.findFirst({
      where: and(
        eq(automationRules.id, run.ruleId),
        eq(automationRules.enabled, true),
      ),
    });
    if (!rule) {
      await db
        .update(automationRuns)
        .set({ status: "skipped", reason: "regle_desactivee", executedAt: new Date() })
        .where(eq(automationRuns.id, run.id));
      summary.skipped += 1;
      continue;
    }

    // Une exécution sans conversation ne peut pas être traitée.
    if (!run.conversationId) {
      await db
        .update(automationRuns)
        .set({ status: "skipped", reason: "conversation_absente", executedAt: new Date() })
        .where(eq(automationRuns.id, run.id));
      summary.skipped += 1;
      continue;
    }

    const outcome = await evaluateAndRun(rule, run.conversationId, run.customerId, run.id);
    summary[outcome.kind] += 1;
    summary.details.push({
      type: rule.type,
      conversationId: run.conversationId,
      outcome: outcome.reason,
    });
  }

  return summary;
}

type Candidate = { conversationId: string; customerId: string | null };

/** Détecte les conversations/commandes éligibles selon le type de règle. */
async function findCandidates(
  rule: typeof automationRules.$inferSelect,
  limit: number,
): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - rule.delayMinutes * 60_000);
  const merchantId = rule.merchantId;

  switch (rule.type) {
    case "abandoned_conversation": {
      const rows = await db
        .select({
          conversationId: conversations.id,
          customerId: conversations.customerId,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.merchantId, merchantId),
            eq(conversations.status, "open"),
            lte(conversations.lastMessageAt, cutoff),
          ),
        )
        .limit(limit);

      // Ne relancer que si le DERNIER message vient du client.
      const eligible: Candidate[] = [];
      for (const row of rows) {
        const last = await db.query.messages.findFirst({
          where: eq(messages.conversationId, row.conversationId),
          orderBy: (m, { desc }) => [desc(m.createdAt)],
          columns: { senderType: true },
        });
        if (last?.senderType === "customer") eligible.push(row);
      }
      return eligible;
    }

    case "order_confirmation": {
      const rows = await db
        .select({ conversationId: orders.conversationId, customerId: orders.customerId })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            inArray(orders.orderStatus, ["pending_confirmation", "new"]),
            lte(orders.createdAt, cutoff),
          ),
        )
        .limit(limit);
      return rows.filter((r): r is { conversationId: string; customerId: string | null } =>
        Boolean(r.conversationId),
      );
    }

    case "delivery_followup":
    case "review_request":
    case "cross_sell": {
      const rows = await db
        .select({ conversationId: orders.conversationId, customerId: orders.customerId })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            eq(orders.orderStatus, "delivered"),
            isNull(orders.cancelledAt),
            lte(orders.deliveredAt, cutoff),
          ),
        )
        .limit(limit);
      return rows.filter((r): r is { conversationId: string; customerId: string | null } =>
        Boolean(r.conversationId),
      );
    }

    case "repeat_purchase": {
      const rows = await db
        .select({ customerId: orders.customerId, conversationId: orders.conversationId })
        .from(orders)
        .where(
          and(
            eq(orders.merchantId, merchantId),
            eq(orders.orderStatus, "delivered"),
            lte(orders.deliveredAt, cutoff),
          ),
        )
        .limit(limit);
      return rows.filter((r): r is { conversationId: string; customerId: string | null } =>
        Boolean(r.conversationId) && Boolean(r.customerId),
      );
    }

    default:
      return [];
  }
}

type Outcome = { kind: "sent" | "skipped" | "failed"; reason: string };

async function evaluateAndRun(
  rule: typeof automationRules.$inferSelect,
  conversationId: string,
  customerId: string | null,
  existingRunId?: string,
): Promise<Outcome> {
  const merchantId = rule.merchantId;
  const config = (rule.configuration ?? {}) as AutomationConfig;

  const skip = async (reason: string): Promise<Outcome> => {
    await recordRun(rule.id, merchantId, conversationId, customerId, "skipped", reason, existingRunId);
    return { kind: "skipped", reason };
  };

  // --- Anti-doublon ---
  const alreadySent = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.ruleId, rule.id),
      eq(automationRuns.conversationId, conversationId),
      inArray(automationRuns.status, ["sent", "pending"]),
    ),
    columns: { id: true },
  });
  if (alreadySent && alreadySent.id !== existingRunId) return skip("deja_envoye");

  // --- Conversation toujours valable ? ---
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.merchantId, merchantId),
    ),
  });
  if (!conversation) return skip("conversation_introuvable");
  if (conversation.status !== "open" && rule.type === "abandoned_conversation") {
    return skip("conversation_cloturee");
  }
  if (conversation.handoffMode === "manual") return skip("reprise_en_main");
  if (!conversation.aiEnabled) return skip("ia_desactivee");

  // --- Client ---
  const customer = customerId
    ? await db.query.customers.findFirst({
        where: and(eq(customers.id, customerId), eq(customers.merchantId, merchantId)),
      })
    : null;
  if (customer?.status === "blacklisted") return skip("client_bloque");

  // --- Limites quotidiennes ---
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [merchantToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.merchantId, merchantId),
        eq(automationRuns.ruleId, rule.id),
        eq(automationRuns.status, "sent"),
        gte(automationRuns.executedAt, startOfDay),
      ),
    );
  if ((merchantToday?.count ?? 0) >= rule.maxRunsPerDay) {
    return skip("limite_quotidienne_marchand");
  }

  if (customerId) {
    const perCustomer = config.maxSendsPerCustomerPerDay ?? 1;
    const [customerToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.merchantId, merchantId),
          eq(automationRuns.customerId, customerId),
          eq(automationRuns.status, "sent"),
          gte(automationRuns.executedAt, startOfDay),
        ),
      );
    if ((customerToday?.count ?? 0) >= perCustomer) {
      return skip("limite_quotidienne_client");
    }
  }

  // --- Heures calmes ---
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
    columns: {
      timezone: true,
      subscriptionStatus: true,
      status: true,
      businessName: true,
      name: true,
    },
  });
  const timezone = merchant?.timezone ?? "Africa/Casablanca";
  if (merchant && (merchant.status !== "active" || merchant.subscriptionStatus === "suspended")) {
    return skip("compte_non_actif");
  }
  if (isInQuietHours(new Date(), timezone, config)) {
    return skip("heures_calmes");
  }

  // --- Canal réellement connecté ? (jamais d’envoi simulé, §41) ---
  const channel = await resolveSender(merchantId, conversation.source);
  if (!channel) {
    return skip(`canal_${conversation.source}_non_connecte`);
  }

  // --- Rendu du message ---
  const lastOrder = customerId
    ? await db.query.orders.findFirst({
        where: and(eq(orders.merchantId, merchantId), eq(orders.customerId, customerId)),
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      })
    : null;

  const lastProduct = await lastProductDiscussed(merchantId, conversationId);

  const content = renderTemplate(config.messageTemplate ?? "", {
    customer_name: customer?.name?.split(" ")[0] ?? "",
    business_name: merchant?.businessName ?? merchant?.name ?? "",
    product_name: lastProduct?.name ?? "",
    related_product: "",
    order_reference: lastOrder?.reference ?? "",
    order_total: lastOrder ? formatMad(lastOrder.total) : "",
  });

  if (!content || content.length < 3) return skip("message_vide");

  // --- Envoi ---
  try {
    const recipient = customer?.phone ?? null;
    if (!recipient && conversation.source !== "web") {
      return skip("destinataire_inconnu");
    }

    if (conversation.source === "web") {
      // Canal web : le message est déposé dans la conversation (aucun envoi externe).
      await db.insert(messages).values({
        merchantId,
        conversationId,
        senderType: "system",
        content,
        aiGenerated: true,
        status: "sent",
      });
    } else {
      const sent = await channel.send(merchantId, recipient!, content);
      if (!sent.ok) {
        await recordRun(rule.id, merchantId, conversationId, customerId, "failed", sent.error ?? "echec_envoi", existingRunId);
        return { kind: "failed", reason: sent.error ?? "echec_envoi" };
      }
    }

    await db
      .update(conversations)
      .set({ lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 280), updatedAt: new Date() })
      .where(and(eq(conversations.id, conversationId), eq(conversations.merchantId, merchantId)));

    await recordRun(rule.id, merchantId, conversationId, customerId, "sent", "envoye", existingRunId);
    return { kind: "sent", reason: "envoye" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erreur_inconnue";
    console.error("[automation] échec d’envoi:", message);
    await recordRun(rule.id, merchantId, conversationId, customerId, "failed", message, existingRunId);
    return { kind: "failed", reason: message };
  }
}

async function recordRun(
  ruleId: string,
  merchantId: string,
  conversationId: string,
  customerId: string | null,
  status: "sent" | "skipped" | "failed" | "pending",
  reason: string,
  existingRunId?: string,
) {
  if (existingRunId) {
    await db
      .update(automationRuns)
      .set({ status, reason, executedAt: new Date() })
      .where(and(eq(automationRuns.id, existingRunId), eq(automationRuns.merchantId, merchantId)));
    return;
  }

  await db.insert(automationRuns).values({
    ruleId,
    merchantId,
    conversationId,
    customerId,
    status,
    reason,
    executedAt: new Date(),
  });
}

/** Produit le plus récemment mentionné dans la conversation. */
async function lastProductDiscussed(merchantId: string, conversationId: string) {
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.merchantId, merchantId)),
    columns: { aiContext: true },
  });
  const context = (conversation?.aiContext ?? {}) as { productId?: string };
  if (!context.productId) return null;

  return db.query.products.findFirst({
    where: and(
      eq(products.id, context.productId),
      eq(products.merchantId, merchantId),
    ),
    columns: { name: true },
  });
}

/**
 * Résout l’expéditeur réel selon le canal.
 * Renvoie `null` si le canal n’est pas connecté → l’exécution est ignorée,
 * jamais simulée.
 */
async function resolveSender(
  merchantId: string,
  source: string,
): Promise<{ send: (merchantId: string, to: string, text: string) => Promise<{ ok: boolean; error?: string }> } | null> {
  if (source === "web") {
    return { send: async () => ({ ok: true }) };
  }

  if (source === "whatsapp") {
    const { whatsAppChannel } = await import("@/lib/channels/whatsapp");
    const state = await whatsAppChannel.getConnectionState(merchantId);
    if (!state.connected) return null;
    return {
      send: async (mid, to, text) => {
        const result = await whatsAppChannel.sendText(mid, to, text);
        return { ok: result.ok, error: result.error ?? undefined };
      },
    };
  }

  if (source === "instagram") {
    const { instagramChannel } = await import("@/lib/channels/instagram");
    const state = await instagramChannel.getConnectionState(merchantId);
    if (!state.connected) return null;
    return {
      send: async (mid, to, text) => {
        const result = await instagramChannel.sendText(mid, to, text);
        return { ok: result.ok, error: result.error ?? undefined };
      },
    };
  }

  return null;
}

/** Planifie une exécution différée (appelé à la détection d’un événement). */
export async function scheduleAutomation(
  merchantId: string,
  type: AutomationType,
  conversationId: string,
  customerId: string | null,
): Promise<{ scheduled: boolean; reason?: string }> {
  const rule = await db.query.automationRules.findFirst({
    where: and(
      eq(automationRules.merchantId, merchantId),
      eq(automationRules.type, type),
      eq(automationRules.enabled, true),
    ),
  });
  if (!rule) return { scheduled: false, reason: "regle_absente_ou_desactivee" };

  const existing = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.ruleId, rule.id),
      eq(automationRuns.conversationId, conversationId),
      inArray(automationRuns.status, ["pending", "sent"]),
    ),
    columns: { id: true },
  });
  if (existing) return { scheduled: false, reason: "deja_planifie" };

  await db.insert(automationRuns).values({
    ruleId: rule.id,
    merchantId,
    conversationId,
    customerId,
    status: "pending",
    scheduledFor: new Date(Date.now() + rule.delayMinutes * 60_000),
  });

  return { scheduled: true };
}
