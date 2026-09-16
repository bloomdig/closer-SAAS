/**
 * Connexion / déconnexion d’un canal officiel (§16, §17).
 * Les jetons sont chiffrés au repos et ne ressortent jamais en clair.
 */
import { requireMerchantApi, requireFeatureAccess, requireRole } from "@/lib/auth/guards";
import { logAudit } from "@/lib/repositories";
import {
  ApiError,
  notFound,
  ok,
  readJson,
  str,
  throwIfInvalid,
  withErrorHandling,
  type FieldErrors,
} from "@/lib/api/validation-bridge";
import {
  disconnectChannel,
  ENV_REQUIREMENTS,
  getChannelStatus,
  saveChannelCredentials,
} from "@/lib/channels/registry";
import { maskSecret } from "@/lib/security/encryption";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ provider: string }> };

const PROVIDERS = ["whatsapp", "instagram"] as const;
type Provider = (typeof PROVIDERS)[number];

function parseProvider(value: string): Provider {
  if (!(PROVIDERS as readonly string[]).includes(value)) {
    throw new ApiError(404, "unknown_channel", "Canal inconnu. Valeurs possibles : whatsapp, instagram.");
  }
  return value as Provider;
}

export const GET = withErrorHandling("channels.get", async (_request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { provider: raw } = await ctx.params;
  const provider = parseProvider(raw);

  const status = await getChannelStatus(provider, authed.session.merchantId);
  return ok(status);
});

export const POST = withErrorHandling("channels.connect", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "channels:manage");
  requireFeatureAccess(authed, "channels");

  const { provider: raw } = await ctx.params;
  const provider = parseProvider(raw);

  const body = await readJson<Record<string, unknown>>(request);
  const errors: FieldErrors = {};
  const credentials: Record<string, string> = {};

  for (const key of ENV_REQUIREMENTS[provider]) {
    const value = str(body[key], key, { label: key, max: 512, optional: true }, errors);
    if (value) credentials[key] = value;
  }

  const displayName = str(body.displayName, "displayName", { label: "Nom affiché", max: 160, optional: true }, errors);
  throwIfInvalid(errors);

  if (Object.keys(credentials).length === 0) {
    throw new ApiError(
      422,
      "missing_credentials",
      `Renseignez au moins un identifiant : ${ENV_REQUIREMENTS[provider].join(", ")}.`,
    );
  }

  const result = await saveChannelCredentials(
    authed.session.merchantId,
    provider,
    credentials,
    displayName ?? null,
  );

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "channel.connect",
    entityType: "channel_connection",
    entityId: result.id,
    // Aucun secret dans le journal : seulement les noms de champs.
    metadata: { provider, fields: Object.keys(credentials), status: result.status },
  });

  return ok({
    ...result,
    connected: result.status === "connected",
    message:
      result.status === "connected"
        ? provider === "whatsapp"
          ? "WhatsApp connecté."
          : "Instagram connecté."
        : `Configuration incomplète. Champs manquants : ${result.missing.join(", ")}.`,
  });
});

export const DELETE = withErrorHandling("channels.disconnect", async (_request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "channels:manage");

  const { provider: raw } = await ctx.params;
  const provider = parseProvider(raw);

  const status = await getChannelStatus(provider, authed.session.merchantId);
  if (status.scope === "platform") {
    throw new ApiError(
      409,
      "platform_channel",
      "Ce canal est configuré au niveau de la plateforme. Contactez l’équipe CLOSER.",
    );
  }

  const removed = await disconnectChannel(authed.session.merchantId, provider);
  if (!removed) throw notFound("Aucune connexion enregistrée pour ce canal.");

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "channel.disconnect",
    entityType: "channel_connection",
    metadata: { provider },
  });

  return ok({ disconnected: true, provider, masked: maskSecret(null) });
});
