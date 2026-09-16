/**
 * Contrôle d’accès selon l’état de facturation.
 * =====================================================================
 * Sépare clairement :
 *   1. intégration du fournisseur de paiement  → src/lib/payments
 *   2. gestion de l’abonnement (états, périodes) → src/lib/subscriptions
 *   3. état de facturation du compte marchand    → schema.subscriptions / merchants
 *   4. accès aux fonctionnalités                 → CE fichier
 *
 * À l’expiration de l’essai : les données sont CONSERVÉES, les fonctions
 * premium sont restreintes et un écran de mise à niveau est exigé.
 * Aucune suppression automatique de données.
 */
import type { PlanLimits } from "./plans";
import { getPlanDefinition, type PlanSlug } from "./plans";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "payment_failed"
  | "cancelled"
  | "expired"
  | "suspended";

export type MerchantAccountStatus =
  | "pending"
  | "active"
  | "suspended"
  | "deactivated";

export type AccessLevel =
  /** Tout fonctionne. */
  | "full"
  /** Lecture + fonctions de base, IA et automatisations coupées. */
  | "restricted"
  /** Consultation seule, écran de mise à niveau obligatoire. */
  | "read_only"
  /** Compte désactivé par l’administrateur. */
  | "blocked";

export type AccessDecision = {
  level: AccessLevel;
  plan: PlanSlug;
  limits: PlanLimits;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  /** true → l’UI doit afficher l’écran de mise à niveau. */
  requireUpgrade: boolean;
  /** true → période de grâce : on avertit sans couper. */
  gracePeriod: boolean;
  /** Message affiché au marchand (français, jamais technique). */
  banner: string | null;
  features: {
    aiReplies: boolean;
    automations: boolean;
    newOrders: boolean;
    newProducts: boolean;
    newConversations: boolean;
    exports: boolean;
    channels: boolean;
  };
};

const DAY_MS = 86_400_000;
/** Jours de grâce après un paiement échoué avant restriction. */
export const GRACE_DAYS = 3;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

export function evaluateAccess(params: {
  now?: Date;
  merchantStatus: MerchantAccountStatus;
  subscriptionStatus: SubscriptionStatus;
  plan: PlanSlug;
  trialEndsAt?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
}): AccessDecision {
  const now = params.now ?? new Date();
  const trialEndsAt = params.trialEndsAt
    ? new Date(params.trialEndsAt)
    : null;
  const periodEnd = params.currentPeriodEnd
    ? new Date(params.currentPeriodEnd)
    : null;

  const planDef = getPlanDefinition(params.plan);
  const baseFeatures = {
    aiReplies: true,
    automations: true,
    newOrders: true,
    newProducts: true,
    newConversations: true,
    exports: true,
    channels: true,
  };

  // --- Décisions administratives priment toujours ---
  if (params.merchantStatus === "deactivated" || params.merchantStatus === "suspended") {
    return {
      level: "blocked",
      plan: params.plan,
      limits: planDef.limits,
      subscriptionStatus: params.subscriptionStatus,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      trialDaysLeft: 0,
      requireUpgrade: false,
      gracePeriod: false,
      banner:
        "Ce compte a été suspendu. Contactez l’équipe CLOSER pour le réactiver.",
      features: {
        aiReplies: false,
        automations: false,
        newOrders: false,
        newProducts: false,
        newConversations: false,
        exports: false,
        channels: false,
      },
    };
  }

  if (params.subscriptionStatus === "suspended") {
    return {
      level: "blocked",
      plan: params.plan,
      limits: planDef.limits,
      subscriptionStatus: "suspended",
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      trialDaysLeft: 0,
      requireUpgrade: false,
      gracePeriod: false,
      banner: "Compte suspendu. Contactez l’équipe CLOSER.",
      features: {
        aiReplies: false,
        automations: false,
        newOrders: false,
        newProducts: false,
        newConversations: false,
        exports: false,
        channels: false,
      },
    };
  }

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, daysBetween(now, trialEndsAt))
    : 0;

  // --- Essai en cours ---
  if (params.subscriptionStatus === "trialing") {
    const expired = trialEndsAt !== null && now > trialEndsAt;

    if (!expired) {
      return {
        level: "full",
        plan: params.plan,
        limits: planDef.limits,
        subscriptionStatus: "trialing",
        trialEndsAt: trialEndsAt?.toISOString() ?? null,
        trialDaysLeft,
        requireUpgrade: false,
        gracePeriod: false,
        banner:
          trialDaysLeft <= 2
            ? `Votre essai gratuit se termine dans ${trialDaysLeft} jour${trialDaysLeft > 1 ? "s" : ""}. Vos données seront conservées.`
            : null,
        features: baseFeatures,
      };
    }

    // Essai expiré : lecture seule, données conservées.
    return {
      level: "read_only",
      plan: params.plan,
      limits: planDef.limits,
      subscriptionStatus: "expired",
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      trialDaysLeft: 0,
      requireUpgrade: true,
      gracePeriod: false,
      banner:
        "Votre essai de 7 jours est terminé. Vos données sont conservées — choisissez une offre pour réactiver CLOSER.",
      features: {
        aiReplies: false,
        automations: false,
        newOrders: false,
        newProducts: false,
        newConversations: false,
        exports: true,
        channels: false,
      },
    };
  }

  // --- Abonnement actif ---
  if (params.subscriptionStatus === "active") {
    const lapsed = periodEnd !== null && now > periodEnd;
    if (!lapsed) {
      return {
        level: "full",
        plan: params.plan,
        limits: planDef.limits,
        subscriptionStatus: "active",
        trialEndsAt: trialEndsAt?.toISOString() ?? null,
        trialDaysLeft: 0,
        requireUpgrade: false,
        gracePeriod: false,
        banner: params.cancelAtPeriodEnd
          ? "Votre abonnement s’arrêtera à la fin de la période en cours. Vos données resteront accessibles en lecture."
          : null,
        features: baseFeatures,
      };
    }
  }

  // --- Impayé : période de grâce puis restriction ---
  if (
    params.subscriptionStatus === "past_due" ||
    params.subscriptionStatus === "payment_failed"
  ) {
    const sinceLapse = periodEnd ? daysBetween(periodEnd, now) : GRACE_DAYS + 1;

    if (sinceLapse <= GRACE_DAYS) {
      return {
        level: "full",
        plan: params.plan,
        limits: planDef.limits,
        subscriptionStatus: params.subscriptionStatus,
        trialEndsAt: trialEndsAt?.toISOString() ?? null,
        trialDaysLeft: 0,
        requireUpgrade: false,
        gracePeriod: true,
        banner:
          "Nous n’avons pas pu encaisser votre dernier paiement. Merci de mettre à jour votre moyen de paiement sous 3 jours pour éviter toute interruption.",
        features: baseFeatures,
      };
    }

    return {
      level: "restricted",
      plan: params.plan,
      limits: planDef.limits,
      subscriptionStatus: params.subscriptionStatus,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      trialDaysLeft: 0,
      requireUpgrade: true,
      gracePeriod: false,
      banner:
        "Paiement échoué : l’IA et les automatisations sont suspendues. Vos conversations et commandes restent accessibles.",
      features: {
        aiReplies: false,
        automations: false,
        newOrders: true,
        newProducts: false,
        newConversations: true,
        exports: true,
        channels: false,
      },
    };
  }

  // --- Annulé / expiré : lecture seule, aucune suppression ---
  return {
    level: "read_only",
    plan: params.plan,
    limits: planDef.limits,
    subscriptionStatus:
      params.subscriptionStatus === "cancelled" ? "cancelled" : "expired",
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    trialDaysLeft: 0,
    requireUpgrade: true,
    gracePeriod: false,
    banner:
      "Votre abonnement est interrompu. Vos données sont conservées — réactivez votre compte pour reprendre les ventes.",
    features: {
      aiReplies: false,
      automations: false,
      newOrders: false,
      newProducts: false,
      newConversations: false,
      exports: true,
      channels: false,
    },
  };
}

/** Test rapide utilisé dans les routes API. */
export function canUseAi(decision: AccessDecision): boolean {
  return decision.level === "full" && decision.features.aiReplies;
}

export function requireFeature(
  decision: AccessDecision,
  feature: keyof AccessDecision["features"],
): void {
  if (!decision.features[feature]) {
    const error = new Error(
      decision.banner ??
        "Cette fonctionnalité n’est pas disponible avec votre abonnement actuel.",
    ) as Error & { status: number; code: string };
    error.status = 402; // Payment Required
    error.code = "subscription_required";
    throw error;
  }
}
