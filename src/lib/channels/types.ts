/**
 * Abstraction canaux de messagerie — WhatsApp Cloud API & Instagram Messaging API.
 * =====================================================================
 * Officiel uniquement : aucun scraping WhatsApp Web, aucune automatisation de
 * navigateur, aucun détournement de session.
 *
 * Contrat :
 *  - `isConnected()` reflète la réalité (credentials valides). Sinon l’UI
 *    affiche « WhatsApp non connecté » / « Instagram non connecté ».
 *  - Le webhook vérifie la signature Meta (`X-Hub-Signature-256`) avant tout
 *    traitement, puis délègue au pipeline `handleInbound`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type ChannelProvider = "whatsapp" | "instagram";

export type InboundMessage = {
  provider: ChannelProvider;
  /** Identifiant externe du fil (à mapper sur conversations.external_id). */
  externalConversationId: string;
  externalMessageId: string;
  /** Numéro / PSID de l’expéditeur côté client. */
  from: string;
  to: string;
  text: string;
  /** Contenu non-textuel normalisé (image, audio, document…). */
  attachment?: {
    type: "image" | "audio" | "video" | "document" | "sticker" | "location";
    url?: string;
    mimeType?: string;
    caption?: string;
  } | null;
  timestamp: string;
  raw: unknown;
};

export type OutboundResult = {
  provider: ChannelProvider;
  messageId?: string | null;
  ok: boolean;
  error?: string | null;
};

export type DeliveryStatus = {
  provider: ChannelProvider;
  externalMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errors?: string[];
};

export type ChannelConnectionState = {
  provider: ChannelProvider;
  connected: boolean;
  /** Pourquoi ce n’est pas connecté (à afficher tel quel dans les réglages). */
  reason?: string | null;
  missing: string[];
  displayName?: string | null;
  lastSyncAt?: string | null;
};

export interface MessagingChannel {
  readonly provider: ChannelProvider;
  getConnectionState(merchantId: string): Promise<ChannelConnectionState>;
  /** Vérification GET du webhook Meta (hub.challenge). */
  verifyWebhook(mode: string, token: string, challenge: string): boolean;
  /** Vérifie la signature et normalise la charge utile entrante. */
  parseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<{ events: InboundMessage[]; statuses: DeliveryStatus[] }>;
  sendText(
    merchantId: string,
    to: string,
    text: string,
    replyToMessageId?: string | null,
  ): Promise<OutboundResult>;
  markAsRead?(
    merchantId: string,
    messageId: string,
  ): Promise<{ ok: boolean }>;
}

export class ChannelNotConnectedError extends Error {
  readonly status = 503;
  readonly code = "channel_not_connected";
  constructor(provider: ChannelProvider) {
    super(
      provider === "whatsapp"
        ? "WhatsApp non connecté."
        : "Instagram non connecté.",
    );
    this.name = "ChannelNotConnectedError";
  }
}

/**
 * Vérification constante en temps de la signature HMAC-SHA256 Meta.
 * `X-Hub-Signature-256: sha256=<hex>` calculé avec l’app secret.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;

  const received = signatureHeader.replace(/^sha256=/, "").trim();
  if (received.length === 0) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const REGISTRY = new Map<ChannelProvider, MessagingChannel>();

export function registerChannel(channel: MessagingChannel): void {
  REGISTRY.set(channel.provider, channel);
}

export function getChannel(
  provider: ChannelProvider,
): MessagingChannel | undefined {
  return REGISTRY.get(provider);
}

/**
 * Canal « non connecté » : état honnête, aucun envoi simulé.
 * Utilisé tant que les identifiants Meta du marchand ne sont pas saisis.
 */
export class DisconnectedChannel implements MessagingChannel {
  constructor(readonly provider: ChannelProvider) {}

  async getConnectionState(_merchantId?: string): Promise<ChannelConnectionState> {
    return {
      provider: this.provider,
      connected: false,
      reason:
        this.provider === "whatsapp"
          ? "Renseignez l’identifiant du numéro, le WABA ID et le jeton d’accès WhatsApp Cloud API."
          : "Renseignez l’App ID, l’App Secret et le jeton d’accès Instagram.",
      missing:
        this.provider === "whatsapp"
          ? [
              "WHATSAPP_PHONE_NUMBER_ID",
              "WHATSAPP_WABA_ID",
              "WHATSAPP_ACCESS_TOKEN",
              "WHATSAPP_APP_SECRET",
            ]
          : [
              "INSTAGRAM_APP_ID",
              "INSTAGRAM_APP_SECRET",
              "INSTAGRAM_ACCESS_TOKEN",
            ],
    };
  }

  verifyWebhook(): boolean {
    return false;
  }

  async parseWebhook(): Promise<{
    events: InboundMessage[];
    statuses: DeliveryStatus[];
  }> {
    throw new ChannelNotConnectedError(this.provider);
  }

  async sendText(): Promise<OutboundResult> {
    return {
      provider: this.provider,
      ok: false,
      error:
        this.provider === "whatsapp"
          ? "WhatsApp non connecté."
          : "Instagram non connecté.",
    };
  }
}
