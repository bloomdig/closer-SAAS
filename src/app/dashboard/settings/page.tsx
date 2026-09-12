import { db } from "@/db";
import { merchants, adminConfig } from "@/db/schema";
import { verifySession } from "@/lib/verify";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const userMerchants = await db.select().from(merchants);
  const merchant = userMerchants.find((m: any) => m.id === session.userId);
  const adminConfigs = await db.select().from(adminConfig);
  const admin = adminConfigs[0] || { starterPrice: "299", proPrice: "599", businessPrice: "999", trialDaysDefault: 7 };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Paramètres</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Gérez votre entreprise, votre agent commercial et votre abonnement.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subscription */}
        <div className="rounded-[24px] border border-[#eaeaea] bg-white p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <h2 className="text-[16px] font-extrabold text-[#0a0a0a]">Abonnement</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[#fafafa] px-4 py-3 border border-[#eaeaea]">
              <span className="text-[13px] text-[#6b6b6b]">Statut</span>
              <span className="text-[13px] font-extrabold text-[#c2185b]">{merchant?.status}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#fafafa] px-4 py-3 border border-[#eaeaea]">
              <span className="text-[13px] text-[#6b6b6b]">Forfait</span>
              <span className="text-[13px] font-extrabold text-[#0a0a0a]">{merchant?.subscriptionPlan}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#fafafa] px-4 py-3 border border-[#eaeaea]">
              <span className="text-[13px] text-[#6b6b6b]">Jours restants</span>
              <span className="text-[13px] font-extrabold text-emerald-600">{merchant?.trialDaysRemaining}</span>
            </div>
          </div>
          <a href="/dashboard/subscription" className="mt-6 block w-full rounded-full bg-[#c2185b] py-3 text-center text-[13px] font-extrabold text-white shadow-[0_2px_12px_rgba(194,24,91,0.2)] hover:bg-[#a8144a] transition hover:-translate-y-0.5">Gérer l'abonnement</a>
        </div>

        {/* Pricing config */}
        <div className="rounded-[24px] border border-[#eaeaea] bg-white p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <h2 className="text-[16px] font-extrabold text-[#0a0a0a]">Configuration des prix</h2>
          <p className="text-[12px] text-[#9a9a9a]">Les prix sont configurables par l'administration.</p>
          <div className="mt-5 space-y-3">
            {[
              { name: "Starter", price: admin.starterPrice },
              { name: "Pro", price: admin.proPrice },
              { name: "Business", price: admin.businessPrice },
            ].map((plan) => (
              <div key={plan.name} className="flex items-center justify-between rounded-xl bg-[#fafafa] px-4 py-3 border border-[#eaeaea]">
                <span className="text-[13px] text-[#6b6b6b]">{plan.name}</span>
                <span className="text-[13px] font-extrabold text-[#0a0a0a]">{plan.price} MAD/mois</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gemini integration info */}
      <div className="mt-8 rounded-[24px] border border-[#eaeaea] bg-white p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <h2 className="text-[16px] font-extrabold text-[#0a0a0a]">Agent commercial — Gemini</h2>
        <p className="mt-2 text-[13px] text-[#6b6b6b]">Votre agent commercial est connecté à Google Gemini. Il répond en français, darija et arabe en fonction du contexte de vos produits et paramètres.</p>
        <div className="mt-4 flex items-center gap-2 text-[12px] font-medium text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Connexion Gemini active
        </div>
      </div>
    </div>
  );
}
