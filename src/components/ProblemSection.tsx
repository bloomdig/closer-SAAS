import { MessageCircle, Clock, ShoppingCart, UserX, CreditCard, TrendingUp } from "lucide-react";

const problems = [
  { icon: MessageCircle, title: "Trop de messages WhatsApp", desc: "Votre téléphone vibre sans arrêt. Vous ne pouvez pas répondre assez vite." },
  { icon: Clock, title: "Réponses trop lentes", desc: "Les clients attendent des heures. Entre-temps, ils achètent ailleurs." },
  { icon: UserX, title: "Clients perdus", desc: "Les conversations commencent mais ne se terminent jamais en commande." },
  { icon: ShoppingCart, title: "Commandes COD non confirmées", desc: "Les commandes restent en suspens. Vous ne savez pas ce qui est réel." },
  { icon: MessageCircle, title: "Questions répétitives", desc: "Les mêmes FAQ répondus encore et encore. Un travail manuel constant." },
  { icon: CreditCard, title: "Saisie manuelle des commandes", desc: "Copier depuis WhatsApp vers un tableau prend un temps fou." },
];

export function ProblemSection() {
  return (
    <section id="probleme" className="bg-[#f6f4ee] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-[#14181f] md:text-[34px]">Chaque message est une vente manquée.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6558]">Les commerçants marocains perdent des commandes chaque jour parce qu’ils ne répondent pas assez vite, ne confirment pas le COD et ne suivent pas leurs clients.</p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => (
            <div key={p.title} className="rounded-lg border border-[#e4e0d3] bg-white p-7 transition hover:border-[#1e5f6e]/30">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaf2f2] text-[#1e5f6e] transition">
                <p.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-[16px] font-semibold text-[#14181f]">{p.title}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#6b6558]">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
