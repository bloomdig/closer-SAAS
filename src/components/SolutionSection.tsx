import { Bot, MessageSquare, TrendingUp, ShieldCheck, BellRing } from "lucide-react";

const solutions = [
  { icon: Bot, title: "Agent commercial IA", desc: "Répond instantanément en darija, arabe et français. Comprend les messages mélangés." },
  { icon: MessageSquare, title: "WhatsApp et Instagram", desc: "Se connecte aux canaux que vos clients utilisent réellement au Maroc." },
  { icon: TrendingUp, title: "Vente de produits", desc: "Recommande des produits, affiche les prix, répond aux objections et pousse à la vente." },
  { icon: ShieldCheck, title: "Confirmation COD", desc: "Collecte nom, adresse, produit, quantité et confirme automatiquement la commande COD." },
  { icon: BellRing, title: "Suivi automatique", desc: "Relance les clients sur les commandes non confirmées, confirme la livraison et demande des avis." },
];

export function SolutionSection() {
  return (
    <section id="solution" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-[#14181f] md:text-[34px]">Votre vendeur ne dort jamais.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6558]">CLOSER lit vos produits, prix, stock, zones de livraison, promotions et instructions. Ensuite il parle à vos clients comme un vrai vendeur — dans leur langue, à tout moment.</p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-5">
          {solutions.map((s) => (
            <div key={s.title} className="rounded-lg border border-[#e4e0d3] bg-white p-6 text-center transition hover:border-[#1e5f6e]/30">
              <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#eaf2f2] text-[#1e5f6e]">
                <s.icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#14181f]">{s.title}</h3>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-[#6b6558]">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl rounded-lg border border-[#e4e0d3] bg-[#f6f4ee] p-8 md:p-10">
          <h3 className="text-[16px] font-semibold text-[#14181f]">Ce que l’agent comprend</h3>
          <div className="mt-5 grid grid-cols-2 gap-2 text-[13px] text-[#14181f]">
            {[
              "Darija marocaine", "Arabe marocain", "Français", "Messages mélangés",
              "Noms de produits", "Prix en DH", "Zones de livraison", "Règles de promotion",
              "Niveaux de stock", "Horaires d’ouverture", "Confirmation COD", "Timing du suivi"
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 border border-[#e4e0d3]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1e5f6e] shrink-0" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
