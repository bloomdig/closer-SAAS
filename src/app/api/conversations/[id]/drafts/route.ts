/**
 * Validation d’un brouillon IA — mode APPROVAL (§12).
 * `action: "approve"` envoie (avec correction éventuelle), `action: "reject"`
 * écarte la proposition.
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import { getConversation } from "@/lib/repositories";
import { approveDraft, rejectDraft } from "@/lib/conversation-service";
import { ApiError, notFound, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { oneOf, str, throwIfInvalid, type FieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandling("conversations.drafts", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const conversation = await getConversation(authed.session.merchantId, id);
  if (!conversation) throw notFound("Conversation introuvable.");

  const body = await readJson<{
    messageId?: unknown;
    action?: unknown;
    editedContent?: unknown;
    reason?: unknown;
  }>(request);
  const errors: FieldErrors = {};

  const messageId = str(body.messageId, "messageId", { label: "Message", max: 64 }, errors);
  const action = oneOf(body.action, ["approve", "reject"] as const, "action", "Action", errors);
  const editedContent = str(body.editedContent, "editedContent", { label: "Message corrigé", max: 4000, optional: true }, errors);
  const reason = str(body.reason, "reason", { label: "Motif", max: 280, optional: true }, errors);

  throwIfInvalid(errors);

  if (action === "approve") {
    const message = await approveDraft({
      merchantId: authed.session.merchantId,
      conversationId: id,
      messageId: messageId!,
      editedContent: editedContent ?? null,
    });
    if (!message) throw new ApiError(404, "draft_not_found", "Ce brouillon n’existe plus ou a déjà été traité.");
    return ok(message);
  }

  const message = await rejectDraft({
    merchantId: authed.session.merchantId,
    conversationId: id,
    messageId: messageId!,
    reason: reason ?? null,
  });
  if (!message) throw new ApiError(404, "draft_not_found", "Ce brouillon n’existe plus ou a déjà été traité.");
  return ok(message);
});
