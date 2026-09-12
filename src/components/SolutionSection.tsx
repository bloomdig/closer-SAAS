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
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">La solution</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Votre vendeur ne dort jamais.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6b6b]">CLOSER lit vos produits, prix, stock, zones de livraison, promotions et instructions. Ensuite il parle à vos clients comme un vrai vendeur — dans leur langue, à tout moment.</p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-5">
          {solutions.map((s) => (
            <div key={s.title} className="rounded-2xl border border-[#eaeaea] bg-white p-6 text-center transition hover:border-[#c2185b]/15 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#c2185b]/5 text-[#c2185b] shadow-[inset_0_1px_3px_rgba(194,24,91,0.08)]">
                <s.icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <h3 className="text-[15px] font-extrabold text-[#0a0a0a]">{s.title}</h3>
              <p className="mt-2.5 text-[13px] leading-[1.6] text-[#6b6b6b]">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-[#eaeaea] bg-[#fafafa] p-8 md:p-10">
          <h3 className="text-[18px] font-extrabold text-[#0a0a0a]">Ce que l'agent comprend</h3>
          <div className="mt-5 grid grid-cols-2 gap-2 text-[13px] text-[#0a0a0a]">
            {[
              "Darija marocaine", "Arabe marocain", "Français", "Messages mélangés",
              "Noms de produits", "Prix en DH", "Zones de livraison", "Règles de promotion",
              "Niveaux de stock", "Horaires d'ouverture", "Confirmation COD", "Timing du suivi"
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 border border-[#eaeaea]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c2185b] shrink-0" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
