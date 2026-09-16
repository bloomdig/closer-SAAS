/**
 * WhatsApp Cloud API — canal officiel (§16).
 * =====================================================================
 * Uniquement l’API officielle Meta (graph.facebook.com). Aucun scraping
 * WhatsApp Web, aucune automatisation de navigateur, aucun détournement de
 * session.
 *
 * Si les identifiants ne sont pas configurés, `sendText` renvoie un échec
 * explicite : aucun envoi n’est simulé (§41).
 */
import {
  DisconnectedChannel,
  verifyMetaSignature,
  type ChannelConnectionState,
  type DeliveryStatus,
  type InboundMessage,
  type OutboundResult,
} from "./types";
import { decryptCredentials } from "@/lib/security/encryption";
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { channelConnections } from "@/db/schema";

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export type WhatsAppCredentials = {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  wabaId?: string;
};

/** Résout les identifiants : ceux du marchand d’abord, sinon ceux de la plateforme. */
export async function resolveWhatsAppCredentials(
  merchantId?: string | null,
): Promise<WhatsAppCredentials | null> {
  if (merchantId) {
    const row = await db.query.channelConnections.findFirst({
      where: and(
        eq(channelConnections.merchantId, merchantId),
        eq(channelConnections.provider, "whatsapp"),
      ),
    });
    if (row?.encryptedCredentials) {
      const credentials = decryptCredentials(row.encryptedCredentials);
      if (credentials.WHATSAPP_ACCESS_TOKEN && credentials.WHATSAPP_PHONE_NUMBER_ID) {
        return {
          phoneNumberId:
            credentials.WHATSAPP_PHONE_NUMBER_ID ?? row.phoneNumberId ?? "",
          accessToken: credentials.WHATSAPP_ACCESS_TOKEN,
          appSecret: credentials.WHATSAPP_APP_SECRET ?? "",
          wabaId: credentials.WHATSAPP_WABA_ID ?? row.wabaId ?? undefined,
        };
      }
    }
  }

  if (process.env.WHATSAPP_ENABLED !== "true") return null;

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!phoneNumberId || !accessToken || !appSecret) return null;

  return {
    phoneNumberId,
    accessToken,
    appSecret,
    wabaId: process.env.WHATSAPP_WABA_ID,
  };
}

function graphUrl(phoneNumberId: string, path: string): string {
  return `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/${path}`;
}

export class WhatsAppChannel {
  readonly provider = "whatsapp" as const;

  async getConnectionState(merchantId: string): Promise<ChannelConnectionState> {
    const credentials = await resolveWhatsAppCredentials(merchantId);
    if (!credentials) {
      return new DisconnectedChannel("whatsapp").getConnectionState(merchantId);
    }
    return {
      provider: "whatsapp",
      connected: true,
      missing: [],
      displayName: `+${credentials.phoneNumberId}`,
    };
  }

  /** Vérification GET du webhook Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`). */
  verifyWebhook(mode: string, token: string, challenge: string): boolean {
    if (mode !== "subscribe") return false;
    const expected =
      process.env.WHATSAPP_VERIFY_TOKEN?.trim() ??
      process.env.INSTAGRAM_VERIFY_TOKEN?.trim() ??
      "";
    if (!expected) return false;
    return token === expected && challenge.length > 0;
  }

  /**
   * Vérifie la signature `X-Hub-Signature-256` puis normalise la charge utile.
   * La signature est vérifiée AVANT toute lecture du contenu.
   */
  async parseWebhook(
    rawBody: string,
    signature: string | null,
    appSecretOverride?: string,
  ): Promise<{ events: InboundMessage[]; statuses: DeliveryStatus[] }> {
    const appSecret =
      appSecretOverride ?? process.env.WHATSAPP_APP_SECRET ?? "";

    if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
      throw new Error("Signature de webhook WhatsApp invalide.");
    }

    const payload = JSON.parse(rawBody) as {
      entry?: {
        id?: string;
        changes?: {
          value?: {
            messaging_contact?: unknown;
            contacts?: { wa_id?: string; profile?: { name?: string } }[];
            messages?: {
              from: string;
              id: string;
              timestamp: string;
              type: string;
              text?: { body?: string };
              image?: { caption?: string; mime_type?: string; url?: string };
              audio?: { mime_type?: string; url?: string };
              video?: { caption?: string; mime_type?: string };
              document?: { filename?: string; mime_type?: string };
              sticker?: { mime_type?: string };
              location?: { latitude?: number; longitude?: number };
              errors?: { code?: number; title?: string }[];
            }[];
            statuses?: {
              id: string;
              status: string;
              errors?: { code?: number; title?: string }[];
            }[];
          };
        }[];
      }[];
    };

    const events: InboundMessage[] = [];
    const statuses: DeliveryStatus[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        for (const message of value.messages ?? []) {
          const attachment = buildAttachment(message);
          events.push({
            provider: "whatsapp",
            externalConversationId: message.from,
            externalMessageId: message.id,
            from: message.from,
            to: "",
            text:
              message.text?.body ??
              attachment?.caption ??
              (attachment ? `[${attachment.type}]` : ""),
            attachment,
            timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
            raw: message,
          });
        }

        for (const status of value.statuses ?? []) {
          const mapped = mapDeliveryStatus(status.status);
          if (!mapped) continue;
          statuses.push({
            provider: "whatsapp",
            externalMessageId: status.id,
            status: mapped,
            errors: status.errors?.map((e) => `${e.code}: ${e.title}`),
          });
        }
      }
    }

    return { events, statuses };
  }

  /** Envoi d’un message texte via l’API officielle. */
  async sendText(
    merchantId: string,
    to: string,
    text: string,
    replyToMessageId?: string | null,
  ): Promise<OutboundResult> {
    const credentials = await resolveWhatsAppCredentials(merchantId);
    if (!credentials) {
      return {
        provider: "whatsapp",
        ok: false,
        error: "WhatsApp non connecté.",
      };
    }

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: false, body: text },
    };
    if (replyToMessageId) body.context = { message_id: replyToMessageId };

    try {
      const response = await fetch(graphUrl(credentials.phoneNumberId, "messages"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      const json = (await response.json().catch(() => ({}))) as {
        messages?: { id: string }[];
        error?: { message?: string; code?: number };
      };

      if (!response.ok) {
        const message = json.error?.message ?? `HTTP ${response.status}`;
        await recordError(merchantId, message);
        return { provider: "whatsapp", ok: false, error: message };
      }

      return {
        provider: "whatsapp",
        ok: true,
        messageId: json.messages?.[0]?.id ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur réseau WhatsApp.";
      await recordError(merchantId, message);
      return { provider: "whatsapp", ok: false, error: message };
    }
  }

  /** Marque un message entrant comme lu (accusé de réception bleu). */
  async markAsRead(
    merchantId: string,
    messageId: string,
  ): Promise<{ ok: boolean }> {
    const credentials = await resolveWhatsAppCredentials(merchantId);
    if (!credentials) return { ok: false };

    try {
      const response = await fetch(graphUrl(credentials.phoneNumberId, "messages"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
        cache: "no-store",
      });
      return { ok: response.ok };
    } catch {
      return { ok: false };
    }
  }
}

function buildAttachment(message: {
  type: string;
  image?: { caption?: string; mime_type?: string };
  audio?: { mime_type?: string };
  video?: { caption?: string; mime_type?: string };
  document?: { filename?: string; mime_type?: string };
  sticker?: { mime_type?: string };
  location?: { latitude?: number; longitude?: number };
}): InboundMessage["attachment"] {
  switch (message.type) {
    case "image":
      return { type: "image", caption: message.image?.caption, mimeType: message.image?.mime_type };
    case "audio":
      return { type: "audio", mimeType: message.audio?.mime_type };
    case "video":
      return { type: "video", caption: message.video?.caption, mimeType: message.video?.mime_type };
    case "document":
      return { type: "document", caption: message.document?.filename, mimeType: message.document?.mime_type };
    case "sticker":
      return { type: "sticker", mimeType: message.sticker?.mime_type };
    case "location":
      return {
        type: "location",
        caption: message.location
          ? `${message.location.latitude},${message.location.longitude}`
          : undefined,
      };
    default:
      return null;
  }
}

function mapDeliveryStatus(
  status: string,
): DeliveryStatus["status"] | null {
  switch (status) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

/** Journalise la dernière erreur de canal sans jamais exposer le jeton. */
async function recordError(merchantId: string, message: string): Promise<void> {
  try {
    await db
      .update(channelConnections)
      .set({
        status: "error",
        lastError: message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelConnections.merchantId, merchantId),
          eq(channelConnections.provider, "whatsapp"),
        ),
      );
  } catch (error) {
    console.error("[whatsapp] échec de journalisation d’erreur:", error);
  }
}

export const whatsAppChannel = new WhatsAppChannel();
