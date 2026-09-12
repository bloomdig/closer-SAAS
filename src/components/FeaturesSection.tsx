import { Bot, MessageSquare, Package, ShieldCheck, BellRing, BarChart3, Users, ShieldCheck as Shield, Languages, Headphones } from "lucide-react";

const features = [
  { icon: Bot, title: "Agent commercial", desc: "Comprend le darija, l'arabe, le français et les messages mélangés. Pousse à la vente." },
  { icon: MessageSquare, title: "WhatsApp", desc: "Intégration native pour des réponses automatisées en temps réel." },
  { icon: MessageSquare, title: "Instagram", desc: "Répond aux messages directs automatiquement avec des recommandations produits." },
  { icon: Package, title: "Connaissance produits", desc: "Lit votre catalogue, prix, descriptions, stock et promotions." },
  { icon: ShieldCheck, title: "Confirmation COD", desc: "Collecte les informations de commande et confirme automatiquement le COD." },
  { icon: BellRing, title: "Suivis automatiques", desc: "Relance sur les commandes non confirmées, confirme la livraison, demande des avis." },
  { icon: BarChart3, title: "Gestion des commandes", desc: "Visualisez toutes les commandes, statuts, clients et revenus en un seul endroit." },
  { icon: Users, title: "Gestion clients", desc: "Suivez les conversations, l'historique des commandes et les préférences clients." },
  { icon: Shield, title: "Reprise manuelle", desc: "Reprenez manuellement n'importe quelle conversation à tout moment." },
  { icon: Languages, title: "Multilingue", desc: "Fluide en darija, arabe marocain, français et messages mélangés." },
];

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">Fonctionnalités</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Conçu pour le commerce marocain.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6b6b]">Chaque fonctionnalité est pensée pour la réalité du e-commerce marocain : WhatsApp, COD, darija, et conversations à fort volume.</p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-5">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#eaeaea] bg-white p-6 transition hover:border-[#c2185b]/15 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#c2185b]/5 text-[#c2185b]">
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-[14px] font-extrabold text-[#0a0a0a]">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#6b6b6b]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
