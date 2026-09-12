import { db } from "@/db";
import { merchants, adminConfig } from "@/db/schema";
import { verifySession } from "@/lib/verify";
import { redirect } from "next/navigation";
import { ShieldCheck, Settings2, Sparkles } from "lucide-react";

export default async function AdminPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const allMerchants = await db.select().from(merchants);
  const allConfigs = await db.select().from(adminConfig);
  const admin = allConfigs[0] || { starterPrice: "299", proPrice: "599", businessPrice: "999", trialDaysDefault: 7 };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Administration</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Gérez les essais, les prix et la configuration du produit.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pricing */}
        <div className="rounded-[24px] border border-[#eaeaea] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2 mb-5">
            <Settings2 className="h-5 w-5 text-[#c2185b]" strokeWidth={2} />
            <h2 className="text-[16px] font-extrabold text-[#0a0a0a]">Configuration des prix</h2>
          </div>
          <form className="grid gap-4 md:grid-cols-3" action="#">
            {[
              { label: "Starter (MAD/mois)", defaultValue: admin.starterPrice },
              { label: "Pro (MAD/mois)", defaultValue: admin.proPrice },
              { label: "Business (MAD/mois)", defaultValue: admin.businessPrice },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">{f.label}</label>
                <input type="number" defaultValue={f.defaultValue} className="mt-2 w-full rounded-xl border border-[#eaeaea] bg-[#fafafa] px-4 py-3 text-[14px] font-medium text-[#0a0a0a] focus:outline-none focus:border-[#c2185b]/30 focus:ring-1 focus:ring-[#c2185b]/10 transition" />
              </div>
            ))}
            <button type="submit" className="md:col-span-3 rounded-full bg-[#c2185b] py-3 text-[13px] font-extrabold text-white shadow-[0_2px_12px_rgba(194,24,91,0.2)] hover:bg-[#a8144a] transition hover:-translate-y-0.5">Enregistrer</button>
          </form>
        </div>

        {/* Merchants */}
        <div className="rounded-[24px] border border-[#eaeaea] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="h-5 w-5 text-[#c2185b]" strokeWidth={2} />
            <h2 className="text-[16px] font-extrabold text-[#0a0a0a]">Commerçants et essais</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a] border-b border-[#eaeaea]">
                <tr><th className="text-left py-2.5 px-3">Nom</th><th className="text-left py-2.5 px-3">Entreprise</th><th className="text-left py-2.5 px-3">Statut</th><th className="text-left py-2.5 px-3">Jours</th><th className="text-left py-2.5 px-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-[#eaeaea]">
                {allMerchants.map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#fafafa] transition">
                    <td className="py-2.5 px-3 font-bold text-[#0a0a0a]">{m.fullName}</td>
                    <td className="py-2.5 px-3 text-[#6b6b6b]">{m.businessName}</td>
                    <td className="py-2.5 px-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${m.status === "trial" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{m.status}</span></td>
                    <td className="py-2.5 px-3 font-medium text-[#0a0a0a]">{m.trialDaysRemaining}</td>
                    <td className="py-2.5 px-3"><a href="#" className="text-[11px] font-extrabold text-[#c2185b] hover:underline">Prolonger</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gemini info */}
      <div className="mt-8 rounded-[24px] border border-[#eaeaea] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-[#c2185b]" strokeWidth={2} />
          <h2 className="text-[16px] font-extrabold text-[#0a0a0a]">Intégration Gemini</h2>
        </div>
        <p className="text-[13px] text-[#6b6b6b]">L'agent commercial est connecté à <span className="font-bold text-[#0a0a0a]">Google Gemini</span> via l'API sécurisée. La clé API est stockée dans la variable d'environnement <code className="rounded bg-[#fafafa] px-1.5 py-0.5 text-[11px] font-mono text-[#c2185b] border border-[#eaeaea]">GEMINI_API_KEY</code>. Elle n'est jamais exposée côté client.</p>
      </div>
    </div>
  );
}
