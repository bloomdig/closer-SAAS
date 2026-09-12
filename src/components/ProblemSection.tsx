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
    <section id="probleme" className="bg-[#fafafa] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">Le problème</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Chaque message est une vente manquée.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6b6b]">Les commerçants marocains perdent des commandes chaque jour parce qu'ils ne répondent pas assez vite, ne confirment pas le COD et ne suivent pas leurs clients.</p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => (
            <div key={p.title} className="rounded-2xl border border-[#eaeaea] bg-white p-7 transition hover:border-[#c2185b]/15 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#c2185b]/5 text-[#c2185b] transition">
                <p.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="text-[16px] font-extrabold text-[#0a0a0a]">{p.title}</h3>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#6b6b6b]">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
