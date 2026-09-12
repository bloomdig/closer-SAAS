import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "299",
    period: "/mois",
    description: "Pour les petites boutiques qui commencent avec WhatsApp.",
    features: ["Intégration WhatsApp", "Jusqu'à 200 conversations/mois", "Jusqu'à 20 produits", "Agent IA de base", "Confirmation COD", "7 jours d'essai gratuit"],
    cta: "Démarrer l'essai",
    popular: false,
  },
  {
    name: "Pro",
    price: "599",
    period: "/mois",
    description: "Pour les entreprises en croissance avec plusieurs canaux.",
    features: ["WhatsApp + Instagram", "Jusqu'à 1 000 conversations/mois", "Jusqu'à 100 produits", "Agent IA avancé", "Suivis automatiques", "Tableau de bord analytics", "Instructions personnalisées", "Support prioritaire", "7 jours d'essai gratuit"],
    cta: "Démarrer l'essai",
    popular: true,
  },
  {
    name: "Business",
    price: "999",
    period: "/mois",
    description: "Pour les commerçants sérieux avec un volume élevé.",
    features: ["WhatsApp + Instagram + Web", "Conversations illimitées", "Produits illimités", "Personnalisation complète IA", "Analytics avancés", "Reprise manuelle", "Zones de livraison personnalisées", "Responsable dédié", "7 jours d'essai gratuit"],
    cta: "Démarrer l'essai",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="tarifs" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">Tarifs</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Des tarifs simples. Des résultats réels.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6b6b]">Tous les forfaits incluent un essai gratuit de 7 jours. Sans engagement. Les prix sont configurables depuis le panneau d'administration.</p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:items-start">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative rounded-[24px] border p-8 md:p-10 transition hover:-translate-y-1 ${plan.popular ? "border-[#c2185b]/30 bg-[#fafafa] shadow-[0_12px_40px_rgba(194,24,91,0.08)]" : "border-[#eaeaea] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]"}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#c2185b] px-4 py-1 text-[10px] font-extrabold text-white tracking-wide shadow-[0_2px_8px_rgba(194,24,91,0.25)]">
                  LE PLUS POPULAIRE
                </div>
              )}
              <h3 className="text-[20px] font-extrabold text-[#0a0a0a]">{plan.name}</h3>
              <p className="mt-2 text-[13px] text-[#6b6b6b]">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-[42px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{plan.price}</span>
                <span className="text-[14px] font-medium text-[#6b6b6b]">{plan.period}</span>
              </div>
              <a href="/signup" className={`mt-6 block w-full rounded-full py-3.5 text-center text-[13px] font-extrabold transition ${plan.popular ? "bg-[#c2185b] text-white shadow-[0_2px_12px_rgba(194,24,91,0.22)] hover:bg-[#a8144a] hover:shadow-[0_4px_16px_rgba(194,24,91,0.3)] hover:-translate-y-0.5" : "border border-[#eaeaea] bg-white text-[#0a0a0a] hover:border-[#0a0a0a]/20 hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"}`}>
                {plan.cta}
              </a>
              <ul className="mt-8 space-y-2.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2.5 text-[13px] text-[#0a0a0a]">
                    <Check className={`h-4 w-4 shrink-0 ${plan.popular ? "text-[#c2185b]" : "text-emerald-600"}`} strokeWidth={2.5} />
                    <span className="font-medium">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
