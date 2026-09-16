/**
 * Routage des webhooks Meta vers le bon marchand (§16, §17).
 * =====================================================================
 * Le tenant est résolu depuis la charge utile SIGNÉE de Meta — jamais depuis un
 * paramètre fourni par le client. Sans correspondance, le message est ignoré
 * et journalisé : aucune fuite entre marchands.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channelConnections } from "@/db/schema";
import { whatsAppChannel } from "./whatsapp";
import { instagramChannel } from "./instagram";
import type { DeliveryStatus, InboundMessage } from "./types";

export async function parseWhatsAppWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ events: InboundMessage[]; statuses: DeliveryStatus[] }> {
  // L’app secret peut venir de la configuration plateforme ; pour un
  // déploiement multi-marchand avec des apps distinctes, le résoudre depuis
  // l’entrée `entry[0].id` (WABA ID) avant vérification.
  const payload = safeParse(rawBody) as {
    entry?: { id?: string; changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[];
  };

  const wabaId = payload?.entry?.[0]?.id ?? null;
  const appSecret = await resolveWhatsAppAppSecret(wabaId);

  return whatsAppChannel.parseWebhook(rawBody, signature, appSecret);
}

export async function parseInstagramWebhook(
  rawBody: string,
  signature: string | null,
): Promise<{ events: InboundMessage[]; statuses: DeliveryStatus[] }> {
  const payload = safeParse(rawBody) as { entry?: { id?: string }[] };
  const igAccountId = payload?.entry?.[0]?.id ?? null;
  const appSecret = await resolveInstagramAppSecret(igAccountId);

  return instagramChannel.parseWebhook(rawBody, signature, appSecret);
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Résout le marchand destinataire d’un message WhatsApp.
 * `to` est l’identifiant du numéro de téléphone côté Meta (phone_number_id).
 */
export async function resolveWhatsAppMerchant(
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  if (!phoneNumberId) {
    // Repli sur la configuration plateforme si un seul compte global est branché.
    return resolveGlobalWhatsAppMerchant();
  }

  const row = await db.query.channelConnections.findFirst({
    where: and(
      eq(channelConnections.provider, "whatsapp"),
      eq(channelConnections.phoneNumberId, phoneNumberId),
      eq(channelConnections.status, "connected"),
    ),
    columns: { merchantId: true },
  });

  return row?.merchantId ?? resolveGlobalWhatsAppMerchant();
}

/** Résout le marchand destinataire d’un message Instagram (PSID → compte IG). */
export async function resolveInstagramMerchant(
  recipientId: string | null | undefined,
): Promise<string | null> {
  if (!recipientId) {
    return resolveGlobalInstagramMerchant();
  }

  const row = await db.query.channelConnections.findFirst({
    where: and(
      eq(channelConnections.provider, "instagram"),
      eq(channelConnections.externalAccountId, recipientId),
      eq(channelConnections.status, "connected"),
    ),
    columns: { merchantId: true },
  });

  return row?.merchantId ?? resolveGlobalInstagramMerchant();
}

/**
 * Si les identifiants sont fournis par variables d’environnement (une seule
 * app Meta pour toute la plateforme), on ne peut pas deviner le marchand :
 * on utilise le marchand unique connecté, sinon on refuse.
 */
async function resolveGlobalWhatsAppMerchant(): Promise<string | null> {
  if (process.env.WHATSAPP_ENABLED !== "true") return null;
  return singleConnectedMerchant("whatsapp");
}

async function resolveGlobalInstagramMerchant(): Promise<string | null> {
  if (process.env.INSTAGRAM_ENABLED !== "true") return null;
  return singleConnectedMerchant("instagram");
}

async function singleConnectedMerchant(
  provider: "whatsapp" | "instagram",
): Promise<string | null> {
  const rows = await db
    .select({ merchantId: channelConnections.merchantId })
    .from(channelConnections)
    .where(
      and(
        eq(channelConnections.provider, provider),
        eq(channelConnections.status, "connected"),
      ),
    )
    .limit(2);

  // Ambiguïté = refus : on ne route jamais un message vers le mauvais marchand.
  return rows.length === 1 ? rows[0].merchantId : null;
}

async function resolveWhatsAppAppSecret(wabaId: string | null): Promise<string | undefined> {
  if (wabaId) {
    const row = await db.query.channelConnections.findFirst({
      where: and(
        eq(channelConnections.provider, "whatsapp"),
        eq(channelConnections.wabaId, wabaId),
      ),
      columns: { encryptedCredentials: true },
    });
    if (row?.encryptedCredentials) {
      const { decryptCredentials } = await import("@/lib/security/encryption");
      const credentials = decryptCredentials(row.encryptedCredentials);
      if (credentials.WHATSAPP_APP_SECRET) return credentials.WHATSAPP_APP_SECRET;
    }
  }
  return process.env.WHATSAPP_APP_SECRET ?? undefined;
}

async function resolveInstagramAppSecret(accountId: string | null): Promise<string | undefined> {
  if (accountId) {
    const row = await db.query.channelConnections.findFirst({
      where: and(
        eq(channelConnections.provider, "instagram"),
        eq(channelConnections.externalAccountId, accountId),
      ),
      columns: { encryptedCredentials: true },
    });
    if (row?.encryptedCredentials) {
      const { decryptCredentials } = await import("@/lib/security/encryption");
      const credentials = decryptCredentials(row.encryptedCredentials);
      if (credentials.INSTAGRAM_APP_SECRET) return credentials.INSTAGRAM_APP_SECRET;
    }
  }
  return process.env.INSTAGRAM_APP_SECRET ?? undefined;
}
