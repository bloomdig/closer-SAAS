/**
 * Réponse de l’agent de vente IA (§6, §7, §9).
 * =====================================================================
 * Remplace l’ancienne route qui :
 *  - n’envoyait QUE le dernier message au modèle (aucune mémoire, B1) ;
 *  - n’enregistrait rien en base (B2) ;
 *  - ignorait `conversationId` (B3) ;
 *  - chargeait toutes les tables sans filtre (S2).
 *
 * Désormais tout passe par `handleInboundMessage`, le même pipeline que
 * WhatsApp et Instagram : contexte chargé, historique relu, outils exécutés,
 * réponse persistée.
 */
import { handleInboundMessage } from "@/lib/conversation-service";
import { requireMerchantApi, requireFeatureAccess } from "@/lib/auth/guards";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  ApiError,
  ok,
  readJson,
  withErrorHandling,
} from "@/lib/api/respond";
import { str, throwIfInvalid, type FieldErrors } from "@/lib/validation";
import { getConversation } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { message?: unknown; conversationId?: unknown };

export const POST = withErrorHandling("ai.respond", async (request: Request) => {
  const authed = await requireMerchantApi();
  requireFeatureAccess(authed, "aiReplies");
  enforceRateLimit(
    clientKey(request, "ai", authed.session.merchantId),
    RATE_LIMITS.aiRespond,
  );

  const body = await readJson<Body>(request);
  const errors: FieldErrors = {};

  const message = str(body.message, "message", { label: "Message", min: 1, max: 4000 }, errors);
  const conversationId = str(body.conversationId, "conversationId", {
    label: "Conversation",
    max: 64,
  }, errors);

  throwIfInvalid(errors);

  // La conversation doit appartenir au marchand (jamais de confiance côté client).
  const conversation = await getConversation(authed.session.merchantId, conversationId!);
  if (!conversation) {
    throw new ApiError(404, "conversation_not_found", "Conversation introuvable.");
  }

  const result = await handleInboundMessage({
    merchantId: authed.session.merchantId,
    source: conversation.source,
    conversationId: conversation.id,
    customerId: conversation.customerId,
    content: message!,
  });

  if (result.error === "gemini_not_configured") {
    throw new ApiError(
      503,
      "ai_not_configured",
      "L’agent de vente n’est pas encore activé : la clé GEMINI_API_KEY doit être configurée.",
    );
  }

  return ok({
    conversationId: result.conversationId,
    reply: result.reply,
    language: result.language,
    handoffMode: result.handoffMode,
    aiUsed: result.aiUsed,
    escalatedToHuman: result.escalatedToHuman,
    draftMessageId: result.draftMessageId,
    toolResults: result.toolResults,
    degraded: result.degraded,
    ...(result.error ? { error: result.error } : {}),
  });
});
