/**
 * Instagram Messaging API — canal officiel (§17).
 * =====================================================================
 * API officielle Meta (Instagram Platform / Messenger Platform for Instagram).
 * Aucune automatisation non officielle.
 *
 * Sans identifiants configurés : `connected: false` et l’interface affiche
 * « Instagram non connecté ». Aucun envoi simulé (§41).
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

const API_VERSION = process.env.INSTAGRAM_API_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export type InstagramCredentials = {
  appId: string;
  appSecret: string;
  accessToken: string;
  igId?: string;
};

export async function resolveInstagramCredentials(
  merchantId?: string | null,
): Promise<InstagramCredentials | null> {
  if (merchantId) {
    const row = await db.query.channelConnections.findFirst({
      where: and(
        eq(channelConnections.merchantId, merchantId),
        eq(channelConnections.provider, "instagram"),
      ),
    });
    if (row?.encryptedCredentials) {
      const credentials = decryptCredentials(row.encryptedCredentials);
      if (credentials.INSTAGRAM_ACCESS_TOKEN && credentials.INSTAGRAM_APP_SECRET) {
        return {
          appId: credentials.INSTAGRAM_APP_ID ?? row.externalAccountId ?? "",
          appSecret: credentials.INSTAGRAM_APP_SECRET,
          accessToken: credentials.INSTAGRAM_ACCESS_TOKEN,
          igId: row.externalAccountId ?? undefined,
        };
      }
    }
  }

  if (process.env.INSTAGRAM_ENABLED !== "true") return null;

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!appId || !appSecret || !accessToken) return null;

  return { appId, appSecret, accessToken };
}

export class InstagramChannel {
  readonly provider = "instagram" as const;

  async getConnectionState(merchantId: string): Promise<ChannelConnectionState> {
    const credentials = await resolveInstagramCredentials(merchantId);
    if (!credentials) {
      return new DisconnectedChannel("instagram").getConnectionState(merchantId);
    }
    return {
      provider: "instagram",
      connected: true,
      missing: [],
      displayName: credentials.igId ?? "Compte Instagram",
    };
  }

  verifyWebhook(mode: string, token: string, challenge: string): boolean {
    if (mode !== "subscribe") return false;
    const expected = process.env.INSTAGRAM_VERIFY_TOKEN?.trim() ?? "";
    if (!expected) return false;
    return token === expected && challenge.length > 0;
  }

  async parseWebhook(
    rawBody: string,
    signature: string | null,
    appSecretOverride?: string,
  ): Promise<{ events: InboundMessage[]; statuses: DeliveryStatus[] }> {
    const appSecret = appSecretOverride ?? process.env.INSTAGRAM_APP_SECRET ?? "";
    if (!appSecret || !verifyMetaSignature(rawBody, signature, appSecret)) {
      throw new Error("Signature de webhook Instagram invalide.");
    }

    const payload = JSON.parse(rawBody) as {
      entry?: {
        id?: string;
        messaging?: {
          sender?: { id?: string };
          recipient?: { id?: string };
          message?: {
            mid: string;
            text?: string;
            attachments?: { type: string; payload?: { url?: string } }[];
            is_echo?: boolean;
          };
          read?: { mid: string };
          delivery?: { mids?: string[] };
        }[];
      }[];
    };

    const events: InboundMessage[] = [];
    const statuses: DeliveryStatus[] = [];

    for (const entry of payload.entry ?? []) {
      for (const item of entry.messaging ?? []) {
        const message = item.message;

        if (message && !message.is_echo) {
          const attachment = message.attachments?.[0];
          events.push({
            provider: "instagram",
            externalConversationId: item.sender?.id ?? "",
            externalMessageId: message.mid,
            from: item.sender?.id ?? "",
            to: item.recipient?.id ?? "",
            text: message.text ?? (attachment ? `[${attachment.type}]` : ""),
            attachment: attachment
              ? {
                  type:
                    attachment.type === "image"
                      ? "image"
                      : attachment.type === "audio"
                        ? "audio"
                        : attachment.type === "video"
                          ? "video"
                          : attachment.type === "file"
                            ? "document"
                            : "sticker",
                  url: attachment.payload?.url,
                }
              : null,
            timestamp: new Date().toISOString(),
            raw: message,
          });
        }

        if (item.read?.mid) {
          statuses.push({
            provider: "instagram",
            externalMessageId: item.read.mid,
            status: "read",
          });
        }
        for (const mid of item.delivery?.mids ?? []) {
          statuses.push({ provider: "instagram", externalMessageId: mid, status: "delivered" });
        }
      }
    }

    return { events, statuses };
  }

  async sendText(
    merchantId: string,
    to: string,
    text: string,
    replyToMessageId?: string | null,
  ): Promise<OutboundResult> {
    const credentials = await resolveInstagramCredentials(merchantId);
    if (!credentials) {
      return { provider: "instagram", ok: false, error: "Instagram non connecté." };
    }

    const payload: Record<string, unknown> = {
      recipient: { id: to },
      message: { text },
      messaging_type: "RESPONSE",
    };
    if (replyToMessageId) {
      payload.message = { text, reply_to: { mid: replyToMessageId } };
    }

    try {
      const response = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(credentials.accessToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const json = (await response.json().catch(() => ({}))) as {
        message_id?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        const message = json.error?.message ?? `HTTP ${response.status}`;
        await recordError(merchantId, message);
        return { provider: "instagram", ok: false, error: message };
      }

      return { provider: "instagram", ok: true, messageId: json.message_id ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur réseau Instagram.";
      await recordError(merchantId, message);
      return { provider: "instagram", ok: false, error: message };
    }
  }
}

async function recordError(merchantId: string, message: string): Promise<void> {
  try {
    await db
      .update(channelConnections)
      .set({ status: "error", lastError: message.slice(0, 500), updatedAt: new Date() })
      .where(
        and(
          eq(channelConnections.merchantId, merchantId),
          eq(channelConnections.provider, "instagram"),
        ),
      );
  } catch (error) {
    console.error("[instagram] échec de journalisation d’erreur:", error);
  }
}

export const instagramChannel = new InstagramChannel();
