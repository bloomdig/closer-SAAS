/**
 * Administration — forfaits de la plateforme (§22, §42).
 * Les prix affichés côté marchand viennent de cette table : l’administration
 * les modifie ici, jamais en dur dans le front-end.
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth/guards";
import { ApiError, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { logAudit, listPlans } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("admin.plans.list", async () => {
  await requireAdminApi();
  return ok({ plans: await listPlans() });
});

export const PATCH = withErrorHandling("admin.plans.update", async (request: Request) => {
  const admin = await requireAdminApi();
  const body = await readJson<{
    slug?: unknown;
    priceMonthly?: unknown;
    priceYearly?: unknown;
    trialDays?: unknown;
    isActive?: unknown;
    limits?: unknown;
    features?: unknown;
    position?: unknown;
  }>(request);

  const slug = String(body.slug ?? "");
  if (!["starter", "pro", "business"].includes(slug)) {
    throw new ApiError(400, "invalid_slug", "Forfait invalide.");
  }

  const existing = await db.query.plans.findFirst({ where: eq(plans.slug, slug as "starter") });
  if (!existing) throw new ApiError(404, "not_found", "Forfait introuvable. Lancez le seed plateforme.");

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.priceMonthly !== undefined) {
    const cents = Math.round(Number(body.priceMonthly) * 100);
    if (!Number.isFinite(cents) || cents < 0) throw new ApiError(400, "invalid_price", "Prix mensuel invalide.");
    patch.priceMonthly = cents;
  }
  if (body.priceYearly !== undefined) {
    patch.priceYearly =
      body.priceYearly === null ? null : Math.max(0, Math.round(Number(body.priceYearly) * 100));
  }
  if (body.trialDays !== undefined) {
    const days = Math.round(Number(body.trialDays));
    if (!Number.isFinite(days) || days < 0 || days > 90) {
      throw new ApiError(400, "invalid_trial", "Durée d’essai invalide (0 à 90 jours).");
    }
    patch.trialDays = days;
  }
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  if (body.position !== undefined) patch.position = Math.max(0, Math.round(Number(body.position) || 0));
  if (body.limits !== undefined && typeof body.limits === "object" && body.limits !== null) {
    patch.limits = body.limits;
  }
  if (body.features !== undefined && typeof body.features === "object" && body.features !== null) {
    patch.features = body.features;
  }

  await db.update(plans).set(patch).where(eq(plans.slug, slug as "starter"));

  await logAudit({
    actorId: admin.adminId,
    actorRole: null,
    action: "admin.plan.update",
    entityType: "plan",
    entityId: slug,
    metadata: patch,
  });

  const updated = await db.select().from(plans).orderBy(asc(plans.position));
  return ok({ plans: updated });
});
