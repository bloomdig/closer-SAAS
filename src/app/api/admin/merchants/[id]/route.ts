/**
 * Administration — détail d’un marchand (§22).
 * Permet de consulter un compte, le suspendre (accès coupé immédiatement
 * car la session est revalidée en base) ou le réactiver.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants } from "@/db/schema";
import { requireAdminApi } from "@/lib/auth/guards";
import { ApiError, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { logAudit } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_ACTIONS = ["suspend", "reactivate", "extend_trial", "change_plan"] as const;
type AdminAction = (typeof ALLOWED_ACTIONS)[number];

export const GET = withErrorHandling("admin.merchants.get", async (_request: Request, context: Params) => {
  await requireAdminApi();
  const { id } = await context.params;

  const merchant = await db.query.merchants.findFirst({ where: eq(merchants.id, id) });
  if (!merchant) throw new ApiError(404, "not_found", "Marchand introuvable.");

  const { passwordHash: _passwordHash, ...safe } = merchant;
  return ok(safe);
});

export const PATCH = withErrorHandling("admin.merchants.update", async (request: Request, context: Params) => {
  const admin = await requireAdminApi();
  const { id } = await context.params;

  const merchant = await db.query.merchants.findFirst({ where: eq(merchants.id, id) });
  if (!merchant) throw new ApiError(404, "not_found", "Marchand introuvable.");

  const body = await readJson<{
    action?: unknown;
    plan?: unknown;
    trialDays?: unknown;
    reason?: unknown;
  }>(request);

  const action = String(body.action ?? "") as AdminAction;
  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new ApiError(400, "invalid_action", `Action invalide. Attendu : ${ALLOWED_ACTIONS.join(", ")}.`);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (action === "suspend") {
    patch.status = "suspended";
    patch.subscriptionStatus = "past_due";
  } else if (action === "reactivate") {
    patch.status = "active";
    patch.subscriptionStatus = "active";
  } else if (action === "extend_trial") {
    const days = Math.min(90, Math.max(1, Number(body.trialDays ?? 7) || 0));
    const base = merchant.trialEndsAt && merchant.trialEndsAt > new Date() ? merchant.trialEndsAt : new Date();
    patch.status = "trial";
    patch.subscriptionStatus = "trialing";
    patch.trialStartedAt = merchant.trialStartedAt ?? new Date();
    patch.trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  } else if (action === "change_plan") {
    const plan = String(body.plan ?? "");
    if (!["starter", "pro", "business"].includes(plan)) {
      throw new ApiError(400, "invalid_plan", "Forfait invalide.");
    }
    patch.subscriptionPlan = plan;
    if (merchant.status !== "suspended") {
      patch.status = "active";
      patch.subscriptionStatus = "active";
    }
  }

  const [updated] = await db
    .update(merchants)
    .set(patch)
    .where(eq(merchants.id, id))
    .returning({
      id: merchants.id,
      businessName: merchants.businessName,
      status: merchants.status,
      subscriptionPlan: merchants.subscriptionPlan,
      subscriptionStatus: merchants.subscriptionStatus,
      trialEndsAt: merchants.trialEndsAt,
    });

  await logAudit({
    actorId: admin.adminId,
    actorRole: null,
    action: `admin.merchant.${action}`,
    entityType: "merchant",
    entityId: id,
    metadata: {
      plan: body.plan ?? null,
      trialDays: body.trialDays ?? null,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
    },
  });

  return ok(updated);
});
