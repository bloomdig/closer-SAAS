/**
 * Registre des canaux et état de connexion réel (§16, §17, §41).
 * =====================================================================
 * Un canal est « connecté » UNIQUEMENT si :
 *   1. les identifiants du marchand sont enregistrés et chiffrés en base, OU
 *   2. à défaut, les variables d’environnement globales sont renseignées.
 *
 * Dans tous les autres cas, l’état renvoyé est `not_configured` et l’interface
 * affiche « WhatsApp non connecté » / « Instagram non connecté ». Aucune
 * connexion n’est jamais simulée.
 *
 * Officiel uniquement : WhatsApp Cloud API et Instagram Messaging API.
 * Aucun scraping, aucune automatisation de navigateur.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channelConnections } from "@/db/schema";
import {
  DisconnectedChannel,
  type ChannelConnectionState,
  type ChannelProvider,
  type MessagingChannel,
  registerChannel,
} from "./types";
import { decryptCredentials, encryptCredentials } from "@/lib/security/encryption";

const ENV_REQUIREMENTS: Record<ChannelProvider, string[]> = {
  whatsapp: [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_WABA_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
  ],
  instagram: [
    "INSTAGRAM_APP_ID",
    "INSTAGRAM_APP_SECRET",
    "INSTAGRAM_ACCESS_TOKEN",
  ],
};

const CHANNELS = new Map<ChannelProvider, MessagingChannel>();

/** Enregistre les canaux « non connectés » par défaut (comportement honnête). */
registerChannel(new DisconnectedChannel("whatsapp"));
registerChannel(new DisconnectedChannel("instagram"));

export function getChannelImpl(provider: ChannelProvider): MessagingChannel {
  return (
    CHANNELS.get(provider) ??
    (() => {
      const channel = new DisconnectedChannel(provider);
      CHANNELS.set(provider, channel);
      return channel;
    })()
  );
}

export function setChannelImpl(channel: MessagingChannel): void {
  CHANNELS.set(channel.provider, channel);
  registerChannel(channel);
}

function missingEnv(provider: ChannelProvider): string[] {
  return ENV_REQUIREMENTS[provider].filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });
}

/**
 * État de connexion pour un marchand donné.
 * Priorité aux identifiants spécifiques du marchand, sinon à la configuration
 * globale de la plateforme.
 */
export async function getChannelStatus(
  provider: ChannelProvider,
  merchantId: string,
): Promise<ChannelConnectionState & { scope: "merchant" | "platform" | "none" }> {
  const row = await db.query.channelConnections.findFirst({
    where: and(
      eq(channelConnections.merchantId, merchantId),
      eq(channelConnections.provider, provider),
    ),
  });

  // 1. Identifiants saisis par le marchand
  if (row?.encryptedCredentials) {
    const credentials = decryptCredentials(row.encryptedCredentials);
    const missing = ENV_REQUIREMENTS[provider].filter(
      (key) => !credentials[key],
    );

    if (missing.length === 0 && row.status === "connected") {
      return {
        provider,
        connected: true,
        missing: [],
        displayName: row.displayName,
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        scope: "merchant",
      };
    }

    return {
      provider,
      connected: false,
      reason:
        row.status === "error" && row.lastError
          ? row.lastError
          : `Configuration incomplète : ${missing.join(", ")}`,
      missing,
      displayName: row.displayName,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      scope: "merchant",
    };
  }

  // 2. Configuration globale de la plateforme
  const missing = missingEnv(provider);
  const globallyEnabled =
    provider === "whatsapp"
      ? process.env.WHATSAPP_ENABLED === "true"
      : process.env.INSTAGRAM_ENABLED === "true";

  if (globallyEnabled && missing.length === 0) {
    return {
      provider,
      connected: true,
      missing: [],
      displayName: row?.displayName ?? null,
      lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
      scope: "platform",
    };
  }

  return {
    provider,
    connected: false,
    reason:
      provider === "whatsapp"
        ? "WhatsApp non connecté. Renseignez les identifiants WhatsApp Cloud API de votre boutique."
        : "Instagram non connecté. Renseignez les identifiants Instagram Messaging API de votre boutique.",
    missing: missing.length > 0 ? missing : ENV_REQUIREMENTS[provider],
    displayName: row?.displayName ?? null,
    lastSyncAt: null,
    scope: "none",
  };
}

/**
 * Enregistre les identifiants d’un canal pour un marchand.
 * Les jetons sont chiffrés avant écriture ; ils ne sont jamais renvoyés au
 * client en clair (seuls les 4 derniers caractères sont affichés).
 */
export async function saveChannelCredentials(
  merchantId: string,
  provider: ChannelProvider,
  credentials: Record<string, string>,
  displayName?: string | null,
) {
  const missing = ENV_REQUIREMENTS[provider].filter(
    (key) => !credentials[key] || credentials[key].trim().length === 0,
  );

  const status =
    missing.length === 0 ? "connected" : ("pending_verification" as const);

  const encrypted = encryptCredentials(credentials);

  const [row] = await db
    .insert(channelConnections)
    .values({
      merchantId,
      provider,
      status,
      displayName: displayName ?? null,
      encryptedCredentials: encrypted,
      phoneNumberId: credentials.WHATSAPP_PHONE_NUMBER_ID ?? null,
      wabaId: credentials.WHATSAPP_WABA_ID ?? null,
      externalAccountId:
        credentials.INSTAGRAM_APP_ID ?? credentials.WHATSAPP_WABA_ID ?? null,
      lastError: missing.length > 0 ? `Champs manquants : ${missing.join(", ")}` : null,
    })
    .onConflictDoUpdate({
      target: [channelConnections.merchantId, channelConnections.provider],
      set: {
        status,
        displayName: displayName ?? null,
        encryptedCredentials: encrypted,
        phoneNumberId: credentials.WHATSAPP_PHONE_NUMBER_ID ?? null,
        wabaId: credentials.WHATSAPP_WABA_ID ?? null,
        externalAccountId:
          credentials.INSTAGRAM_APP_ID ?? credentials.WHATSAPP_WABA_ID ?? null,
        lastError: missing.length > 0 ? `Champs manquants : ${missing.join(", ")}` : null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    missing,
  };
}

/** Déconnecte un canal : les identifiants sont supprimés, pas seulement masqués. */
export async function disconnectChannel(
  merchantId: string,
  provider: ChannelProvider,
) {
  const [row] = await db
    .update(channelConnections)
    .set({
      status: "not_configured",
      encryptedCredentials: null,
      phoneNumberId: null,
      wabaId: null,
      externalAccountId: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelConnections.merchantId, merchantId),
        eq(channelConnections.provider, provider),
      ),
    )
    .returning();

  return row ?? null;
}

export { ENV_REQUIREMENTS };
