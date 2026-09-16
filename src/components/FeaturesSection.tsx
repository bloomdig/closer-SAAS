import { Bot, MessageSquare, Package, ShieldCheck, BellRing, BarChart3, Users, ShieldCheck as Shield, Languages, Headphones } from "lucide-react";

const features = [
  { icon: Bot, title: "Agent commercial", desc: "Comprend le darija, l’arabe, le français et les messages mélangés. Pousse à la vente." },
  { icon: MessageSquare, title: "WhatsApp", desc: "Intégration native pour des réponses automatisées en temps réel." },
  { icon: MessageSquare, title: "Instagram", desc: "Répond aux messages directs automatiquement avec des recommandations produits." },
  { icon: Package, title: "Connaissance produits", desc: "Lit votre catalogue, prix, descriptions, stock et promotions." },
  { icon: ShieldCheck, title: "Confirmation COD", desc: "Collecte les informations de commande et confirme automatiquement le COD." },
  { icon: BellRing, title: "Suivis automatiques", desc: "Relance sur les commandes non confirmées, confirme la livraison, demande des avis." },
  { icon: BarChart3, title: "Gestion des commandes", desc: "Visualisez toutes les commandes, statuts, clients et revenus en un seul endroit." },
  { icon: Users, title: "Gestion clients", desc: "Suivez les conversations, l’historique des commandes et les préférences clients." },
  { icon: Shield, title: "Reprise manuelle", desc: "Reprenez manuellement n’importe quelle conversation à tout moment." },
  { icon: Languages, title: "Multilingue", desc: "Fluide en darija, arabe marocain, français et messages mélangés." },
];

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-[#14181f] md:text-[34px]">Conçu pour le commerce marocain.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6558]">Chaque fonctionnalité est pensée pour la réalité du e-commerce marocain : WhatsApp, COD, darija, et conversations à fort volume.</p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-[#e4e0d3] bg-white p-6 transition hover:border-[#1e5f6e]/30">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaf2f2] text-[#1e5f6e]">
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-[14px] font-semibold text-[#14181f]">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-[#6b6558]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
