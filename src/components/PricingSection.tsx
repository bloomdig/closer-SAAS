import { eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { db } from "@/db";
import { plans as plansTable } from "@/db/schema";
import {
  DEFAULT_PLANS,
  formatMad,
  type PlanDefinition,
  type PlanSlug,
} from "@/lib/subscriptions/plans";

/**
 * Contenu marketing (description, argumentaire, mise en avant) : ceci reste
 * éditorial et vit dans le composant. En revanche le PRIX et la durée
 * d'essai ne sont plus jamais codés en dur ici — ils viennent de la table
 * `plans` (ou de `DEFAULT_PLANS` si elle n'est pas encore seedée), qui est
 * l'unique source de vérité utilisée par le dashboard, l'admin et la
 * facturation. Corrige le bug : la page publique affichait 299/599/999 DH
 * alors que les offres réelles sont 99/249/499 DH.
 */
const MARKETING: Record<
  PlanSlug,
  { description: string; features: string[]; cta: string; popular: boolean }
> = {
  starter: {
    description: "Pour les petites boutiques qui commencent avec WhatsApp.",
    features: [
      "Intégration WhatsApp",
      "Jusqu’à 500 conversations IA/mois",
      "Jusqu’à 30 produits",
      "Agent IA de base",
      "Confirmation COD",
    ],
    cta: "Démarrer l’essai",
    popular: false,
  },
  pro: {
    description: "Pour les entreprises en croissance avec plusieurs canaux.",
    features: [
      "WhatsApp + Instagram",
      "Jusqu’à 3 000 conversations IA/mois",
      "Jusqu’à 200 produits",
      "Automatisations de relance",
      "Mode validation avant envoi",
      "3 sièges (propriétaire, admin, agents)",
      "Statistiques avancées 6 mois",
    ],
    cta: "Démarrer l’essai",
    popular: true,
  },
  business: {
    description: "Pour les commerçants sérieux avec un volume élevé.",
    features: [
      "WhatsApp + Instagram",
      "Jusqu’à 20 000 conversations IA/mois",
      "Catalogue jusqu’à 2 000 produits",
      "Jusqu’à 10 sièges",
      "Attribution d’agents par conversation",
      "Accompagnement prioritaire",
    ],
    cta: "Démarrer l’essai",
    popular: false,
  },
};

async function getPlans(): Promise<PlanDefinition[]> {
  try {
    const rows = await db.select().from(plansTable);
    if (!rows.length) return DEFAULT_PLANS;
    return rows
      .map((row) => ({
        slug: row.slug as PlanDefinition["slug"],
        name: row.name,
        priceMonthly: row.priceMonthly,
        priceYearly: row.priceYearly ?? null,
        currency: "MAD" as const,
        trialDays: row.trialDays,
        limits: row.limits as PlanDefinition["limits"],
        features: (row.features as unknown as string[]) ?? [],
        position: row.position,
      }))
      .sort((a, b) => a.position - b.position);
  } catch {
    // La base peut ne pas être joignable au moment du build statique :
    // on retombe sur les valeurs par défaut plutôt que de casser la page.
    return DEFAULT_PLANS;
  }
}

export async function PricingSection() {
  const plans = await getPlans();
  const trialDays = plans[0]?.trialDays ?? 7;

  return (
    <section id="tarifs" className="bg-white py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="max-w-xl">
          <h2 className="font-display text-[28px] font-medium tracking-[-0.01em] text-[#14181f] md:text-[34px]">
            Des tarifs simples, alignés sur votre volume.
          </h2>
          <p className="mt-4 text-[15px] leading-[1.65] text-[#3f4552]">
            Essai gratuit de {trialDays} jours sur chaque offre. Sans engagement. Modifiable à tout moment
            depuis votre tableau de bord.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-[#e4e0d3] bg-[#e4e0d3] lg:grid-cols-3">
          {plans.map((plan) => {
            const marketing = MARKETING[plan.slug] ?? {
              description: "",
              features: plan.features,
              cta: "Démarrer l’essai",
              popular: false,
            };
            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col bg-white p-8 md:p-9 ${marketing.popular ? "border-t-2 border-[#a9762e]" : "border-t-2 border-transparent"}`}
              >
                {marketing.popular && (
                  <span className="mb-4 inline-flex w-fit items-center rounded bg-[#f6ecd9] px-2 py-0.5 text-[11px] font-medium text-[#a9762e]">
                    Le plus choisi
                  </span>
                )}
                <h3 className="text-[17px] font-semibold text-[#14181f]">{plan.name}</h3>
                <p className="mt-1.5 text-[13px] text-[#6b6558]">{marketing.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-[34px] font-medium tracking-[-0.02em] text-[#14181f]">{formatMad(plan.priceMonthly)}</span>
                  <span className="text-[13px] text-[#6b6558]">/mois</span>
                </div>
                <a
                  href="/signup"
                  className={`mt-6 block rounded-lg py-2.5 text-center text-[13px] font-semibold transition ${
                    marketing.popular
                      ? "bg-[#14181f] text-white hover:bg-[#252b38]"
                      : "border border-[#d3cdba] text-[#14181f] hover:border-[#14181f]/40"
                  }`}
                >
                  {marketing.cta}
                </a>
                <ul className="mt-7 space-y-2.5 border-t border-[#efece3] pt-6">
                  {marketing.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-[13px] text-[#3f4552]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1e5f6e]" strokeWidth={2.5} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
