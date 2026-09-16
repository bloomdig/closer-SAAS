/**
 * Offres commerciales — source de vérité des prix.
 * =====================================================================
 * Les prix ne sont JAMAIS codés en dur dans le frontend : le serveur lit la
 * table `plans` (seedée avec ces valeurs par défaut) et les renvoie à l’UI.
 * Modifiables depuis le panneau admin sans redéploiement.
 *
 * Montants en CENTIMES MAD (aucun flottant pour de l’argent).
 */

export type PlanSlug = "starter" | "pro" | "business";

export type PlanLimits = {
  /** Conversations IA par mois. */
  aiConversationsPerMonth: number;
  products: number;
  seats: number;
  channels: number;
  automations: number;
  ordersPerMonth: number | null; // null = illimité
  analyticsHistoryDays: number;
};

export type PlanDefinition = {
  slug: PlanSlug;
  name: string;
  priceMonthly: number;
  priceYearly: number | null;
  currency: "MAD";
  trialDays: number;
  limits: PlanLimits;
  features: string[];
  position: number;
};

export const DEFAULT_TRIAL_DAYS = 7;

export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    slug: "starter",
    name: "Starter",
    priceMonthly: 9900, // 99 MAD
    priceYearly: 99000, // 990 MAD (2 mois offerts)
    currency: "MAD",
    trialDays: DEFAULT_TRIAL_DAYS,
    limits: {
      aiConversationsPerMonth: 500,
      products: 30,
      seats: 1,
      channels: 1,
      automations: 2,
      ordersPerMonth: null,
      analyticsHistoryDays: 30,
    },
    features: [
      "Agent de vente IA (darija, français, arabe)",
      "1 canal de messagerie",
      "Catalogue jusqu’à 30 produits",
      "Création de commandes COD",
      "Tableau de bord des ventes",
    ],
    position: 1,
  },
  {
    slug: "pro",
    name: "Pro",
    priceMonthly: 24900, // 249 MAD
    priceYearly: 249000,
    currency: "MAD",
    trialDays: DEFAULT_TRIAL_DAYS,
    limits: {
      aiConversationsPerMonth: 3000,
      products: 200,
      seats: 3,
      channels: 2,
      automations: 6,
      ordersPerMonth: null,
      analyticsHistoryDays: 180,
    },
    features: [
      "Tout Starter, plus :",
      "WhatsApp + Instagram",
      "Automatisations de relance",
      "3 sièges (propriétaire, admin, agents)",
      "Mode validation avant envoi",
      "Statistiques avancées 6 mois",
    ],
    position: 2,
  },
  {
    slug: "business",
    name: "Business",
    priceMonthly: 49900, // 499 MAD
    priceYearly: 499000,
    currency: "MAD",
    trialDays: DEFAULT_TRIAL_DAYS,
    limits: {
      aiConversationsPerMonth: 20000,
      products: 2000,
      seats: 10,
      channels: 5,
      automations: 20,
      ordersPerMonth: null,
      analyticsHistoryDays: 730,
    },
    features: [
      "Tout Pro, plus :",
      "Jusqu’à 10 sièges",
      "Catalogue illimité (2 000 produits)",
      "Attribution d’agents par conversation",
      "Export des données",
      "Accompagnement prioritaire",
    ],
    position: 3,
  },
];

export function getPlanDefinition(slug: PlanSlug): PlanDefinition {
  const plan = DEFAULT_PLANS.find((p) => p.slug === slug);
  if (!plan) throw new Error(`Offre inconnue : ${slug}`);
  return plan;
}

/** Formatage MAD pour l’UI : 24900 → « 249 DH ». */
export function formatMad(cents: number): string {
  const value = cents / 100;
  const formatted = Number.isInteger(value)
    ? value.toLocaleString("fr-MA")
    : value.toLocaleString("fr-MA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  return `${formatted} DH`;
}
