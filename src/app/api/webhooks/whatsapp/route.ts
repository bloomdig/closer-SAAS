/**
 * Webhook WhatsApp Cloud API (§16).
 * =====================================================================
 *  - GET  : vérification Meta (`hub.challenge`)
 *  - POST : signature `X-Hub-Signature-256` vérifiée AVANT tout traitement,
 *           puis mapping marchand → conversation → pipeline IA → renvoi
 *
 * Le marchand est identifié par le `phone_number_id` de la charge utile :
 * c’est la seule manière fiable de router un message entrant vers le bon
 * tenant. Aucun identifiant de marchand n’est accepté depuis le client.
 *
 * Toujours répondre 200 rapidement à Meta pour éviter les renvois.
 */
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channelConnections, messages } from "@/db/schema";
import { parseWhatsAppWebhook, resolveWhatsAppMerchant } from "@/lib/channels/webhook";
import { handleInboundMessage } from "@/lib/conversation-service";
import { whatsAppChannel } from "@/lib/channels/whatsapp";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Vérification du webhook par Meta. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode") ?? "";
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";

  if (whatsAppChannel.verifyWebhook(mode, token, challenge)) {
    return new NextResponse(challenge, { status: 200 });
  }

  // Canal non configuré ou jeton invalide : refus explicite, jamais de succès simulé.
  return NextResponse.json(
    { error: "WhatsApp non connecté ou jeton de vérification invalide." },
    { status: 403 },
  );
}

/** Réception des messages entrants. */
export async function POST(request: NextRequest) {
  enforceRateLimit(clientKey(request, "webhook-whatsapp"), RATE_LIMITS.webhook);

  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  let events;
  let statuses;
  try {
    ({ events, statuses } = await parseWhatsAppWebhook(rawBody, signature));
  } catch (error) {
    console.warn("[webhook:whatsapp] rejeté :", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  // Accusés de réception (envoyés/lus) : mise à jour du statut des messages.
  for (const status of statuses) {
    try {
      await db
        .update(messages)
        .set({ status: status.status })
        .where(eq(messages.externalId, status.externalMessageId));
    } catch (error) {
      console.error("[webhook:whatsapp] statut non mis à jour:", error);
    }
  }

  // Messages entrants
  for (const event of events.slice(0, 10)) {
    const merchantId = await resolveWhatsAppMerchant(event.to);
    if (!merchantId) {
      console.warn(
        `[webhook:whatsapp] aucun marchand pour le numéro destinataire — message ignoré`,
      );
      continue;
    }

    try {
      const result = await handleInboundMessage({
        merchantId,
        source: "whatsapp",
        externalConversationId: event.externalConversationId,
        externalMessageId: event.externalMessageId,
        content: event.text,
        from: { phone: `+${event.from.replace(/^\+/, "")}` },
      });

      // Renvoi de la réponse au client via l’API officielle.
      if (result.reply) {
        const sent = await whatsAppChannel.sendText(
          merchantId,
          event.from,
          result.reply,
          event.externalMessageId,
        );

        if (sent.ok && result.replyMessageId) {
          await db
            .update(messages)
            .set({ externalId: sent.messageId, status: "sent" })
            .where(
              and(
                eq(messages.id, result.replyMessageId),
                eq(messages.merchantId, merchantId),
              ),
            );
        }
      }
    } catch (error) {
      console.error("[webhook:whatsapp] échec de traitement:", error);
    }
  }

  // Toujours 200 : Meta renverrait indéfiniment le même événement sinon.
  return NextResponse.json({ received: true }, { status: 200 });
}
