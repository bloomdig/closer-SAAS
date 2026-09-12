import { db } from "@/db";
import { merchants, adminConfig } from "@/db/schema";
import { verifySession } from "@/lib/verify";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";

export default async function SubscriptionPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const userMerchants = await db.select().from(merchants);
  const merchant = userMerchants.find((m: any) => m.id === session.userId);
  const adminConfigs = await db.select().from(adminConfig);
  const admin = adminConfigs[0] || { starterPrice: "299", proPrice: "599", businessPrice: "999", trialDaysDefault: 7 };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Abonnement</h1>
        <p className="mt-1 text-[14px] text-[#6b6b6b]">Gérez votre forfait et votre facturation.</p>
      </div>

      <div className="rounded-[24px] border border-[#eaeaea] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <h2 className="text-[18px] font-extrabold text-[#0a0a0a]">Forfait actuel : {merchant?.subscriptionPlan || "Starter"}</h2>
        <p className="mt-2 text-[14px] text-[#6b6b6b]">Statut : <span className="font-extrabold text-[#c2185b]">{merchant?.status}</span> — Essai : <span className="font-extrabold text-emerald-600">{merchant?.trialDaysRemaining} jours</span></p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { name: "Starter", price: admin.starterPrice, desc: "Agent de base, WhatsApp, 200 conversations/mois", popular: false },
            { name: "Pro", price: admin.proPrice, desc: "WhatsApp + Instagram, 1 000 conversations/mois, analytics", popular: true },
            { name: "Business", price: admin.businessPrice, desc: "Illimité, tous canaux, support dédié", popular: false },
          ].map((plan) => (
            <div key={plan.name} className={`rounded-[20px] border p-6 transition ${plan.popular ? "border-[#c2185b]/30 bg-[#fafafa] shadow-[0_8px_30px_rgba(194,24,91,0.06)]" : "border-[#eaeaea] bg-white"}`}>
              <h3 className="text-[16px] font-extrabold text-[#0a0a0a]">{plan.name}</h3>
              <div className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{plan.price} MAD <span className="text-[13px] font-medium text-[#9a9a9a]">/mois</span></div>
              <p className="mt-3 text-[12px] text-[#6b6b6b]">{plan.desc}</p>
              <a href="#" className={`mt-5 block w-full rounded-full py-3 text-center text-[12px] font-extrabold transition ${plan.popular ? "bg-[#c2185b] text-white shadow-[0_2px_10px_rgba(194,24,91,0.2)] hover:bg-[#a8144a] hover:-translate-y-0.5" : "border border-[#eaeaea] bg-white text-[#0a0a0a] hover:border-[#0a0a0a]/20 hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:-translate-y-0.5"}`}>Sélectionner</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
