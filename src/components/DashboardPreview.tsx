import { TrendingUp, Users, ShoppingBag, Clock, ArrowUpRight } from "lucide-react";

export function DashboardPreview() {
  return (
    <section className="bg-[#f6f4ee] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mt-4 font-display text-[28px] font-medium tracking-[-0.01em] leading-[1.15] text-[#14181f] md:text-[34px]">Votre activité en un coup d’œil.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6558]">Suivez vos commandes, conversations, revenus et performances de l’agent commercial en temps réel.</p>
        </div>

        <div className="mt-16 overflow-hidden rounded-xl border border-[#e4e0d3] bg-white">
          <div className="flex items-center gap-3 border-b border-[#e4e0d3] px-6 md:px-8 py-4">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0e0e0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0e0e0]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#e0e0e0]" />
            </div>
            <span className="ml-2 text-[11px] font-semibold text-[#9b9587]">Tableau de bord — CLOSER</span>
          </div>

          <div className="p-6 md:p-8 lg:p-10">
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: "Commandes aujourd’hui", value: "24", change: "+12%", icon: ShoppingBag },
                { label: "Conversations actives", value: "8", change: "En direct", icon: Users },
                { label: "Revenu (semaine)", value: "14 320 DH", change: "+18%", icon: TrendingUp },
                { label: "Réponse moyenne", value: "3 s", change: "-45 s", icon: Clock },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-[#e4e0d3] bg-[#f6f4ee] p-5">
                  <div className="flex items-center justify-between">                    <s.icon className="h-4 w-4 text-[#1e5f6e]" strokeWidth={2} />
                  </div>
                  <div className="mt-2 text-[28px] font-extrabold tracking-[-0.03em] text-[#14181f]">{s.value}</div>
                  <div className="mt-1 text-[11px] font-bold text-emerald-600">{s.change}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-lg border border-[#e4e0d3] bg-[#f6f4ee] p-6">
                <h4 className="text-[13px] font-extrabold text-[#14181f]">Commandes récentes</h4>
                <div className="mt-5 divide-y divide-[#e4e0d3]">
                  {[
                    { name: "Robe Noire Élégante", price: "349 DH", status: "Confirmée", time: "2 min" },
                    { name: "Veste en Denim", price: "279 DH", status: "En attente", time: "15 min" },
                    { name: "Pantalon Beige", price: "199 DH", status: "Confirmée", time: "32 min" },
                    { name: "Robe Noire Élégante", price: "349 DH", status: "Livrée", time: "1 h" },
                  ].map((o) => (
                    <div key={o.name + o.time} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[14px] font-bold text-[#14181f]">{o.name}</p>
                        <p className="text-[11px] text-[#9b9587]">{o.time}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[14px] font-extrabold text-[#14181f]">{o.price}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${o.status === "Confirmée" ? "bg-emerald-50 text-emerald-700" : o.status === "En attente" ? "bg-amber-50 text-amber-700" : "bg-[#f6f4ee] text-[#9b9587] border border-[#e4e0d3]"}`}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#e4e0d3] bg-[#f6f4ee] p-6">
                <h4 className="text-[13px] font-extrabold text-[#14181f]">Conversations actives</h4>
                <div className="mt-5 space-y-3">
                  {[
                    { name: "Amine El Fassi", msg: "Bghiti nconfirmi lik wa7da ?", time: "Maintenant" },
                    { name: "Sara Benali", msg: "Salam, had robe kayna ?", time: "3 min" },
                    { name: "Karim Idrissi", msg: "Livraison à Marrakech bch7al ?", time: "8 min" },
                  ].map((c) => (
                    <a key={c.name} href="#" className="flex items-start gap-3 rounded-xl bg-white border border-[#e4e0d3] p-3.5 transition hover:border-[#1e5f6e]/30">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[#14181f] text-white flex items-center justify-center text-[10px] font-extrabold">{c.name.split(" ").map((n: string) => n[0]).join("")}</div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#14181f] truncate">{c.name}</p>
                        <p className="text-[12px] text-[#6b6558] truncate">{c.msg}</p>
                        <p className="text-[10px] text-[#9b9587]">{c.time}</p>
                      </div>
                    </a>
                  ))}
                </div>
                <a href="#" className="mt-4 flex items-center gap-1 text-[11px] font-extrabold text-[#1e5f6e] hover:underline">
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
