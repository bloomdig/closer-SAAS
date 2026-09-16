/**
 * Webhook Instagram Messaging API (§17).
 * Même contrat que WhatsApp : vérification GET, signature HMAC vérifiée avant
 * traitement, routage du tenant depuis la charge utile signée, réponse 200.
 */
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { parseInstagramWebhook, resolveInstagramMerchant } from "@/lib/channels/webhook";
import { handleInboundMessage } from "@/lib/conversation-service";
import { instagramChannel } from "@/lib/channels/instagram";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode") ?? "";
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";

  if (instagramChannel.verifyWebhook(mode, token, challenge)) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { error: "Instagram non connecté ou jeton de vérification invalide." },
    { status: 403 },
  );
}

export async function POST(request: NextRequest) {
  enforceRateLimit(clientKey(request, "webhook-instagram"), RATE_LIMITS.webhook);

  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  let events;
  let statuses;
  try {
    ({ events, statuses } = await parseInstagramWebhook(rawBody, signature));
  } catch (error) {
    console.warn(
      "[webhook:instagram] rejeté :",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  for (const status of statuses) {
    try {
      await db
        .update(messages)
        .set({ status: status.status })
        .where(eq(messages.externalId, status.externalMessageId));
    } catch (error) {
      console.error("[webhook:instagram] statut non mis à jour:", error);
    }
  }

  for (const event of events.slice(0, 10)) {
    const merchantId = await resolveInstagramMerchant(event.to);
    if (!merchantId) {
      console.warn("[webhook:instagram] aucun marchand correspondant — message ignoré");
      continue;
    }

    try {
      const result = await handleInboundMessage({
        merchantId,
        source: "instagram",
        externalConversationId: event.externalConversationId,
        externalMessageId: event.externalMessageId,
        content: event.text,
      });

      if (result.reply) {
        const sent = await instagramChannel.sendText(
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
      console.error("[webhook:instagram] échec de traitement:", error);
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
