/**
 * Moteur d’automatisations (relances).
 * =====================================================================
 * Déclenché par Vercel Cron sur `/api/cron/automations` (protégé par
 * `CRON_SECRET`). Conçu pour être idempotent, borné et anti-spam :
 *
 *  - une seule exécution par règle / conversation / client
 *  - limite quotidienne par marchand (`maxRunsPerDay`)
 *  - heures calmes (pas de message entre 22h et 9h, fuseau du marchand)
 *  - journalisé dans `automation_runs` (traçabilité complète)
 *
 * Types supportés : conversation abandonnée, confirmation de commande,
 * suivi de livraison, demande d’avis, vente croisée, réachat.
 */
import type { AutomationRule } from "@/db/schema";

export type AutomationType =
  | "abandoned_conversation"
  | "order_confirmation"
  | "delivery_followup"
  | "review_request"
  | "cross_sell"
  | "repeat_purchase";

export type AutomationConfig = {
  /** Message envoyé. Variables disponibles entre {{ }}. */
  messageTemplate: string;
  language?: "fr" | "ar" | "darija" | "auto";
  maxSendsPerCustomerPerDay?: number;
  quietHoursStart?: number; // heure locale, ex. 22
  quietHoursEnd?: number; // ex. 9
  /** Conditions métier évaluées avant envoi. */
  conditions?: {
    minOrderValue?: number;
    orderStatuses?: string[];
    customerStatuses?: string[];
    excludeVip?: boolean;
  };
};

export const AUTOMATION_LABELS_FR: Record<AutomationType, string> = {
  abandoned_conversation: "Conversation abandonnée",
  order_confirmation: "Confirmation de commande",
  delivery_followup: "Suivi de livraison",
  review_request: "Demande d’avis",
  cross_sell: "Vente croisée",
  repeat_purchase: "Réachat",
};

export const AUTOMATION_DESCRIPTIONS_FR: Record<AutomationType, string> = {
  abandoned_conversation:
    "Relance un client qui n’a plus répondu depuis le délai défini.",
  order_confirmation:
    "Rappelle le client pour confirmer une commande en attente.",
  delivery_followup:
    "Prend des nouvelles après livraison et traite un éventuel problème.",
  review_request:
    "Demande un avis aux clients satisfaits après une commande livrée.",
  cross_sell:
    "Propose un produit complémentaire après un achat.",
  repeat_purchase:
    "Relance un client habituel au bon moment pour un nouvel achat.",
};

export const DEFAULT_DELAY_MINUTES: Record<AutomationType, number> = {
  abandoned_conversation: 90,
  order_confirmation: 240,
  delivery_followup: 1440,
  review_request: 4320,
  cross_sell: 10080,
  repeat_purchase: 43200,
};

export const DEFAULT_TEMPLATES_FR: Record<AutomationType, string> = {
  abandoned_conversation:
    "Salam {{customer_name}}, vous regardiez {{product_name}}. Il est toujours disponible — je vous le réserve ?",
  order_confirmation:
    "Bonjour {{customer_name}}, votre commande {{order_reference}} ({{order_total}}) est en attente de confirmation. Je la valide ?",
  delivery_followup:
    "Bonjour {{customer_name}}, votre commande {{order_reference}} a été livrée. Tout est conforme ?",
  review_request:
    "Merci pour votre confiance {{customer_name}} ! Si vous êtes satisfait(e), un petit avis nous aide énormément.",
  cross_sell:
    "Bonjour {{customer_name}}, les clients qui ont pris {{product_name}} choisissent aussi {{related_product}}. Je vous envoie les photos ?",
  repeat_purchase:
    "Salam {{customer_name}}, on a du nouveau en boutique depuis votre dernier achat. Je vous montre ?",
};

export const TEMPLATE_VARIABLES = [
  "customer_name",
  "product_name",
  "related_product",
  "order_reference",
  "order_total",
  "business_name",
] as const;

/** Rendu du modèle ; les variables inconnues sont retirées proprement. */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  return template
    .replace(/{{\s*(\w+)\s*}}/g, (_match, key: string) => {
      const value = variables[key];
      return value === null || value === undefined ? "" : String(value);
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Heures calmes : true si l’envoi doit être reporté. */
export function isInQuietHours(
  now: Date,
  timezone: string,
  config: AutomationConfig,
): boolean {
  const start = config.quietHoursStart;
  const end = config.quietHoursEnd;
  if (typeof start !== "number" || typeof end !== "number") return false;

  const hour = Number(
    new Intl.DateTimeFormat("fr-MA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    })
      .format(now)
      .split(":")[0],
  );

  // Plage traversant minuit (22 → 9).
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}

/** Date de déclenchement prévue pour une règle. */
export function computeScheduledFor(
  rule: Pick<AutomationRule, "delayMinutes">,
  referenceDate: Date = new Date(),
): Date {
  return new Date(referenceDate.getTime() + rule.delayMinutes * 60_000);
}

export type DueCandidate = {
  ruleId: string;
  merchantId: string;
  conversationId: string;
  customerId: string | null;
  scheduledFor: Date;
};

/**
 * Filtre final avant envoi. Retourne `null` si l’envoi doit être ignoré,
 * sinon la raison d’ignorance est journalisée dans `automation_runs.reason`.
 */
export type SkipCheck = {
  alreadySentForConversation: boolean;
  dailyMerchantLimitReached: boolean;
  customerDailyLimitReached: boolean;
  quietHours: boolean;
  conversationTakenByHuman: boolean;
  customerBlacklisted: boolean;
  aiDisabled: boolean;
};

export function skipReason(checks: SkipCheck): string | null {
  if (checks.alreadySentForConversation) return "deja_envoye";
  if (checks.dailyMerchantLimitReached) return "limite_quotidienne_marchand";
  if (checks.customerDailyLimitReached) return "limite_quotidienne_client";
  if (checks.quietHours) return "heures_calmes";
  if (checks.conversationTakenByHuman) return "conversation_reprise_en_main";
  if (checks.customerBlacklisted) return "client_bloque";
  if (checks.aiDisabled) return "ia_desactivee";
  return null;
}

/**
 * Interface du planificateur. L’implémentation Drizzle vit dans
 * `src/lib/automation/runner.ts` et est appelée par la route cron.
 *
 * Contrat d’exécution :
 *   1. sélectionner au plus `AUTOMATION_BATCH_SIZE` exécutions dues
 *   2. verrouiller la ligne (FOR UPDATE SKIP LOCKED) pour éviter les doublons
 *   3. évaluer `skipReason`
 *   4. rendre le modèle, envoyer via le canal connecté (ou marquer `skipped`
 *      si le canal n’est pas configuré — jamais d’envoi simulé)
 *   5. journaliser le résultat dans `automation_runs`
 */
export interface AutomationRunner {
  processDueRuns(limit?: number): Promise<{
    processed: number;
    sent: number;
    skipped: number;
    failed: number;
  }>;
  scheduleRule(
    rule: AutomationRule,
    candidate: Omit<DueCandidate, "ruleId" | "merchantId" | "scheduledFor">,
  ): Promise<{ scheduled: boolean; reason?: string }>;
}
