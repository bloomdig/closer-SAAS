import { db } from "@/db";
import { merchants, orders, conversations, products } from "@/db/schema";
import { verifySession } from "@/lib/verify";
import Link from "next/link";
import { ShoppingBag, Users, MessageCircle, TrendingUp, ArrowUpRight, ShieldCheck, Clock, Zap, Package as PackageIcon } from "lucide-react";

export default async function DashboardPage() {
  const session = await verifySession();
  if (!session) return null;

  const userMerchants = await db.select().from(merchants);
  const merchant = userMerchants.find((m: any) => m.id === session.userId);
  const merchantOrders = await db.select().from(orders);
  const merchantOrdersFiltered = merchantOrders.filter((o: any) => o.merchantId === session.userId);
  const merchantConversations = await db.select().from(conversations);
  const merchantConversationsFiltered = merchantConversations.filter((c: any) => c.merchantId === session.userId);
  const merchantProducts = await db.select().from(products);
  const merchantProductsFiltered = merchantProducts.filter((p: any) => p.merchantId === session.userId);

  const trialDays = merchant?.trialDaysRemaining ?? 7;
  const status = merchant?.status ?? "trial";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">Vue d'ensemble</h1>
        <p className="mt-1.5 text-[15px] text-[#6b6b6b]">Bonjour, <span className="font-extrabold text-[#0a0a0a]">{merchant?.businessName || "Commerçant"}</span>. Voici votre activité.</p>
      </div>

      {/* Trial banner */}
      <div className={`mb-8 rounded-[20px] border p-6 md:p-7 ${trialDays > 0 ? "border-[#c2185b]/20 bg-[#c2185b]/[0.03]" : "border-red-200 bg-red-50"}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#0a0a0a]">{trialDays > 0 ? `Essai : ${trialDays} jours restants` : "Essai expiré"}</h2>
            <p className="mt-1 text-[13px] text-[#6b6b6b]">{trialDays > 0 ? "Utilisez toutes les fonctionnalités pendant votre essai gratuit." : "Souscrivez pour continuer à utiliser les fonctionnalités premium."}</p>
          </div>
          <Link href="/dashboard/subscription" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c2185b] px-6 py-3 text-[13px] font-extrabold text-white shadow-[0_2px_12px_rgba(194,24,91,0.2)] transition hover:bg-[#a8144a] hover:shadow-[0_4px_16px_rgba(194,24,91,0.3)] hover:-translate-y-0.5">
            {trialDays > 0 ? "Souscrire" : "Mettre à niveau"}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/orders" className="group rounded-[20px] border border-[#eaeaea] bg-white p-6 transition hover:border-[#c2185b]/15 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">Commandes aujourd'hui</span>
            <ShoppingBag className="h-4 w-4 text-[#c2185b]" strokeWidth={2} />
          </div>
          <div className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{merchantOrdersFiltered.length}</div>
        </Link>
        <Link href="/dashboard/chat" className="group rounded-[20px] border border-[#eaeaea] bg-white p-6 transition hover:border-[#c2185b]/15 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">Conversations actives</span>
            <Users className="h-4 w-4 text-[#c2185b]" strokeWidth={2} />
          </div>
          <div className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{merchantConversationsFiltered.length}</div>
        </Link>
        <Link href="/dashboard/products" className="group rounded-[20px] border border-[#eaeaea] bg-white p-6 transition hover:border-[#c2185b]/15 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">Produits</span>
            <PackageIcon className="h-4 w-4 text-[#c2185b]" strokeWidth={2} />
          </div>
          <div className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{merchantProductsFiltered.length}</div>
        </Link>
        <div className="rounded-[20px] border border-[#eaeaea] bg-white p-6">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">Statut</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" strokeWidth={2} />
          </div>
          <div className="mt-3 text-[18px] font-extrabold text-emerald-600">{status === "trial" ? "Essai actif" : status}</div>
        </div>
      </div>

      {/* Recent conversations */}
      <div className="rounded-[24px] border border-[#eaeaea] bg-white p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-extrabold text-[#0a0a0a]">Conversations récentes</h3>
          <Link href="/dashboard/chat" className="flex items-center gap-1 text-[11px] font-extrabold text-[#c2185b] hover:underline">Tout voir <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
        <div className="mt-6 space-y-2">
          {[
            { name: "Karim Idrissi", msg: "Bghiti nconfirmi lik wa7da ?", time: "2 min", source: "WhatsApp" },
            { name: "Sara Benali", msg: "Salam, had robe kayna ?", time: "15 min", source: "Instagram" },
            { name: "Amine El Fassi", msg: "Livraison à Marrakech bch7al ?", time: "32 min", source: "WhatsApp" },
          ].map((c) => (
            <Link key={c.name + c.time} href="/dashboard/chat" className="flex items-start gap-4 rounded-xl bg-[#fafafa] border border-[#eaeaea] p-4 transition hover:border-[#c2185b]/15 hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:-translate-y-0.5">
              <div className="h-10 w-10 shrink-0 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-[11px] font-extrabold">{c.name.split(" ").map((n: string) => n[0]).join("")}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-[#0a0a0a]">{c.name}</p>
                  <span className="text-[10px] font-medium text-[#9a9a9a]">{c.time}</span>
                </div>
                <p className="text-[13px] text-[#6b6b6b] truncate">{c.msg}</p>
                <span className="mt-1.5 inline-block rounded-full bg-white border border-[#eaeaea] px-2 py-0.5 text-[10px] font-bold text-[#9a9a9a]">{c.source}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
