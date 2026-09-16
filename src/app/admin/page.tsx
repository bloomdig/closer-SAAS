import { sql, desc } from "drizzle-orm";
import { requireAdminPage } from "@/lib/auth/guards";
import { db } from "@/db";
import { merchants, conversations, orders, products, plans } from "@/db/schema";
import { AdminDashboard, type AdminMerchantRow, type AdminPlanRow } from "@/components/admin/AdminDashboard";
import { DEFAULT_PLANS, type PlanDefinition } from "@/lib/subscriptions/plans";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administration — CLOSER",
  robots: { index: false, follow: false },
};

/**
 * Administration de la plateforme CLOSER (§22).
 * Accès réservé aux comptes `platform_admins` (cookie distinct, audience
 * distincte) : un jeton marchand est systématiquement redirigé vers
 * /admin/login.
 */
export default async function AdminPage() {
  const session = await requireAdminPage();

  const merchantRows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      businessName: merchants.businessName,
      email: merchants.email,
      status: merchants.status,
      subscriptionPlan: merchants.subscriptionPlan,
      subscriptionStatus: merchants.subscriptionStatus,
      trialEndsAt: merchants.trialEndsAt,
      isDemo: merchants.isDemo,
      createdAt: merchants.createdAt,
      conversationCount: sql<number>`(select count(*)::int from ${conversations} c where c.merchant_id = ${merchants.id})`,
      orderCount: sql<number>`(select count(*)::int from ${orders} o where o.merchant_id = ${merchants.id})`,
      productCount: sql<number>`(select count(*)::int from ${products} p where p.merchant_id = ${merchants.id})`,
    })
    .from(merchants)
    .orderBy(desc(merchants.createdAt))
    .limit(200);

  const merchantList: AdminMerchantRow[] = merchantRows.map((row) => ({
    ...row,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }));

  const planRows = await db.select().from(plans);
  const source: PlanDefinition[] = planRows.length
    ? planRows.map((plan) => ({
        slug: plan.slug as PlanDefinition["slug"],
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly ?? null,
        currency: "MAD",
        trialDays: plan.trialDays,
        limits: plan.limits as PlanDefinition["limits"],
        features: plan.features as unknown as string[],
        position: plan.position,
      }))
    : DEFAULT_PLANS;

  const planList: AdminPlanRow[] = source
    .map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly ?? null,
      trialDays: plan.trialDays,
      isActive: true,
      position: plan.position,
    }))
    .sort((a, b) => a.position - b.position);

  return (
    <AdminDashboard
      merchants={merchantList}
      plans={planList}
      adminName={session.name ?? session.email}
    />
  );
}

