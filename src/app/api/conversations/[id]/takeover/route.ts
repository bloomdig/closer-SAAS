/**
 * Reprise en main / mode de traitement d’une conversation (§12).
 * `ai` = l’IA répond, `approval` = l’IA prépare, le marchand valide,
 * `manual` = le marchand répond seul. L’état est persisté par conversation.
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import { getConversation, logAudit, updateConversation } from "@/lib/repositories";
import { notFound, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { bool, oneOf, str, throwIfInvalid, type FieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandling("conversations.takeover", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const conversation = await getConversation(authed.session.merchantId, id);
  if (!conversation) throw notFound("Conversation introuvable.");

  const body = await readJson<{
    handoffMode?: unknown;
    aiEnabled?: unknown;
    assignedToMe?: unknown;
    clearReview?: unknown;
    status?: unknown;
  }>(request);
  const errors: FieldErrors = {};

  const handoffMode = oneOf(
    body.handoffMode,
    ["ai", "approval", "manual"] as const,
    "handoffMode",
    "Mode de traitement",
    errors,
    { optional: true },
  );
  const status = oneOf(
    body.status,
    ["open", "pending", "resolved", "archived"] as const,
    "status",
    "Statut",
    errors,
    { optional: true },
  );
  const aiEnabled = body.aiEnabled !== undefined ? bool(body.aiEnabled) : undefined;
  const assignedToMe = body.assignedToMe === true;
  const clearReview = body.clearReview === true;

  throwIfInvalid(errors);

  const patch: Record<string, unknown> = {};
  if (handoffMode) patch.handoffMode = handoffMode;
  if (status) patch.status = status;
  if (assignedToMe) patch.assignedAgentId = authed.session.userId;
  if (clearReview) {
    patch.needsHumanReview = false;
    patch.reviewReason = null;
  }

  // Cohérence imposée côté serveur : mode manuel = IA coupée,
  // mode IA ou validation = IA activée.
  if (handoffMode === "manual") {
    patch.aiEnabled = false;
  } else if (handoffMode === "ai" || handoffMode === "approval") {
    patch.aiEnabled = aiEnabled ?? true;
  } else if (aiEnabled !== undefined) {
    patch.aiEnabled = aiEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return ok(conversation);
  }

  const updated = await updateConversation(authed.session.merchantId, id, patch);

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "conversation.takeover",
    entityType: "conversation",
    entityId: id,
    metadata: patch,
  });

  return ok(updated);
});
