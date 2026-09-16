/**
 * Administration de la plateforme — liste des marchands (§22).
 * Réservé aux administrateurs de la table `platform_admins` : tout jeton
 * marchand est rejeté (audience distincte).
 */
import { sql, desc, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { merchants, conversations, orders, products } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth/guards";
import { ApiError, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { logAudit } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("admin.merchants.list", async (request: Request) => {
  await requireAdminApi();

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25) || 25));

  const filters = [];
  if (search) {
    filters.push(
      or(
        ilike(merchants.businessName, `%${search}%`),
        ilike(merchants.email, `%${search}%`),
        ilike(merchants.name, `%${search}%`),
      ),
    );
  }
  if (status) filters.push(sql`${merchants.status} = ${status}`);
  const where = filters.length ? sql.join(filters, sql` AND `) : undefined;

  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      businessName: merchants.businessName,
      email: merchants.email,
      phone: merchants.phone,
      status: merchants.status,
      subscriptionPlan: merchants.subscriptionPlan,
      subscriptionStatus: merchants.subscriptionStatus,
      trialEndsAt: merchants.trialEndsAt,
      isDemo: merchants.isDemo,
      lastLoginAt: merchants.lastLoginAt,
      createdAt: merchants.createdAt,
      conversationCount: sql<number>`(select count(*)::int from ${conversations} c where c.merchant_id = ${merchants.id})`,
      orderCount: sql<number>`(select count(*)::int from ${orders} o where o.merchant_id = ${merchants.id})`,
      productCount: sql<number>`(select count(*)::int from ${products} p where p.merchant_id = ${merchants.id})`,
    })
    .from(merchants)
    .where(where)
    .orderBy(desc(merchants.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const totalResult = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(merchants)
    .where(where);

  return ok({
    merchants: rows,
    pagination: { page, pageSize, total: totalResult[0]?.total ?? 0 },
  });
});

/**
 * Création manuelle d’un marchand par l’administration (onboarding assisté).
 * Le mot de passe initial est haché côté serveur et jamais renvoyé.
 */
export const POST = withErrorHandling("admin.merchants.create", async (request: Request) => {
  const admin = await requireAdminApi();
  const body = await readJson<{
    businessName?: unknown;
    email?: unknown;
    password?: unknown;
    phone?: unknown;
    plan?: unknown;
    trialDays?: unknown;
  }>(request);

  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const plan = ["starter", "pro", "business"].includes(String(body.plan)) ? (String(body.plan) as "starter" | "pro" | "business") : "starter";
  const trialDays = Math.min(90, Math.max(0, Number(body.trialDays ?? 7) || 0));

  if (businessName.length < 2) throw new ApiError(400, "invalid_name", "Nom de boutique requis.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "invalid_email", "E-mail invalide.");
  if (password.length < 8) throw new ApiError(400, "invalid_password", "Mot de passe : 8 caractères minimum.");

  const existing = await db.query.merchants.findFirst({ where: sql`lower(${merchants.email}) = ${email}` });
  if (existing) throw new ApiError(409, "email_taken", "Un compte existe déjà avec cet e-mail.");

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(merchants)
    .values({
      name: businessName,
      businessName,
      email,
      phone,
      passwordHash,
      status: "active",
      trialStartedAt: trialDays > 0 ? now : null,
      trialEndsAt: trialDays > 0 ? trialEndsAt : null,
      subscriptionStatus: trialDays > 0 ? "trialing" : "active",
      subscriptionPlan: plan,
    })
    .returning({ id: merchants.id, businessName: merchants.businessName, email: merchants.email });

  await logAudit({
    actorId: admin.adminId,
    actorRole: null,
    action: "admin.merchant.create",
    entityType: "merchant",
    entityId: created.id,
  });

  return ok(created, { status: 201 });
});
