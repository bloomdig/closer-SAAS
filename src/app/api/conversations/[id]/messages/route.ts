/**
 * Messages — envoi manuel par le marchand et message de test web.
 * =====================================================================
 * Répond au §12 : quand un humain écrit, la conversation passe en mode manuel
 * et l’IA se met en pause automatiquement.
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import { getConversation } from "@/lib/repositories";
import { handleInboundMessage, sendAgentMessage } from "@/lib/conversation-service";
import { ApiError, created, notFound, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { str, throwIfInvalid, type FieldErrors } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const POST = withErrorHandling("conversations.messages", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const conversation = await getConversation(authed.session.merchantId, id);
  if (!conversation) throw notFound("Conversation introuvable.");

  const body = await readJson<{ content?: unknown; as?: unknown }>(request);
  const errors: FieldErrors = {};
  const content = str(body.content, "content", { label: "Message", min: 1, max: 4000 }, errors);
  throwIfInvalid(errors);

  // `as: "customer"` sert uniquement au simulateur de chat web intégré
  // (aucun canal réel n’est branché) — jamais accessible depuis un webhook.
  if (body.as === "customer" && conversation.source === "web") {
    const result = await handleInboundMessage({
      merchantId: authed.session.merchantId,
      source: "web",
      conversationId: conversation.id,
      customerId: conversation.customerId,
      content: content!,
    });

    if (result.error === "gemini_not_configured") {
      throw new ApiError(
        503,
        "ai_not_configured",
        "L’agent de vente n’est pas activé : la clé GEMINI_API_KEY doit être configurée côté serveur.",
      );
    }

    return created({
      inboundMessageId: result.inboundMessageId,
      reply: result.reply,
      replyMessageId: result.replyMessageId,
      draftMessageId: result.draftMessageId,
      handoffMode: result.handoffMode,
      escalatedToHuman: result.escalatedToHuman,
      toolResults: result.toolResults,
      degraded: result.degraded,
    });
  }

  const message = await sendAgentMessage({
    merchantId: authed.session.merchantId,
    conversationId: conversation.id,
    authorId: authed.session.userId,
    content: content!,
  });
  if (!message) throw notFound("Conversation introuvable.");

  return created(message);
});
