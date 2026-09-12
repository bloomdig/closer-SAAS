import { TrendingUp, Users, ShoppingBag, Clock, ArrowUpRight } from "lucide-react";

export function DashboardPreview() {
  return (
    <section className="bg-[#fafafa] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">Aperçu du tableau de bord</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Votre activité en un coup d'œil.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6b6b]">Suivez vos commandes, conversations, revenus et performances de l'agent commercial en temps réel.</p>
        </div>

        <div className="mt-16 overflow-hidden rounded-[24px] border border-[#eaeaea] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3 border-b border-[#eaeaea] px-6 md:px-8 py-4">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0e0e0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0e0e0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0e0e0]" />
            </div>
            <span className="ml-2 text-[11px] font-semibold text-[#9a9a9a]">Tableau de bord — CLOSER</span>
          </div>

          <div className="p-6 md:p-8 lg:p-10">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: "Commandes aujourd'hui", value: "24", change: "+12%", icon: ShoppingBag },
                { label: "Conversations actives", value: "8", change: "En direct", icon: Users },
                { label: "Revenu (semaine)", value: "14 320 DH", change: "+18%", icon: TrendingUp },
                { label: "Réponse moyenne", value: "3 s", change: "-45 s", icon: Clock },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-[#eaeaea] bg-[#fafafa] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#9a9a9a]">{s.label}</span>
                    <s.icon className="h-4 w-4 text-[#c2185b]" strokeWidth={2} />
                  </div>
                  <div className="mt-2 text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{s.value}</div>
                  <div className="mt-1 text-[11px] font-bold text-emerald-600">{s.change}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl border border-[#eaeaea] bg-[#fafafa] p-6">
                <h4 className="text-[13px] font-extrabold text-[#0a0a0a]">Commandes récentes</h4>
                <div className="mt-5 divide-y divide-[#eaeaea]">
                  {[
                    { name: "Robe Noire Élégante", price: "349 DH", status: "Confirmée", time: "2 min" },
                    { name: "Veste en Denim", price: "279 DH", status: "En attente", time: "15 min" },
                    { name: "Pantalon Beige", price: "199 DH", status: "Confirmée", time: "32 min" },
                    { name: "Robe Noire Élégante", price: "349 DH", status: "Livrée", time: "1 h" },
                  ].map((o) => (
                    <div key={o.name + o.time} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[14px] font-bold text-[#0a0a0a]">{o.name}</p>
                        <p className="text-[11px] text-[#9a9a9a]">{o.time}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[14px] font-extrabold text-[#0a0a0a]">{o.price}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${o.status === "Confirmée" ? "bg-emerald-50 text-emerald-700" : o.status === "En attente" ? "bg-amber-50 text-amber-700" : "bg-[#fafafa] text-[#9a9a9a] border border-[#eaeaea]"}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#eaeaea] bg-[#fafafa] p-6">
                <h4 className="text-[13px] font-extrabold text-[#0a0a0a]">Conversations actives</h4>
                <div className="mt-5 space-y-3">
                  {[
                    { name: "Amine El Fassi", msg: "Bghiti nconfirmi lik wa7da ?", time: "Maintenant" },
                    { name: "Sara Benali", msg: "Salam, had robe kayna ?", time: "3 min" },
                    { name: "Karim Idrissi", msg: "Livraison à Marrakech bch7al ?", time: "8 min" },
                  ].map((c) => (
                    <a key={c.name} href="#" className="flex items-start gap-3 rounded-xl bg-white border border-[#eaeaea] p-3.5 transition hover:border-[#c2185b]/20 hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-[10px] font-extrabold">{c.name.split(" ").map((n: string) => n[0]).join("")}</div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#0a0a0a] truncate">{c.name}</p>
                        <p className="text-[12px] text-[#6b6b6b] truncate">{c.msg}</p>
                        <p className="text-[10px] text-[#9a9a9a]">{c.time}</p>
                      </div>
                    </a>
                  ))}
                </div>
                <a href="#" className="mt-4 flex items-center gap-1 text-[11px] font-extrabold text-[#c2185b] hover:underline">
                  Voir toutes les conversations <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
