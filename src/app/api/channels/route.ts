/**
 * Canaux de messagerie — état réel de connexion (§16, §17, §41).
 * =====================================================================
 * Aucun état simulé : si les identifiants Meta du marchand ne sont pas saisis,
 * la réponse indique `connected: false` avec la liste exacte de ce qui manque.
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import { listChannelConnections } from "@/lib/repositories";
import { ok, withErrorHandling } from "@/lib/api/validation-bridge";
import { getChannelStatus } from "@/lib/channels/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("channels.list", async () => {
  const authed = await requireMerchantApi();

  const [connections, whatsapp, instagram] = await Promise.all([
    listChannelConnections(authed.session.merchantId),
    getChannelStatus("whatsapp", authed.session.merchantId),
    getChannelStatus("instagram", authed.session.merchantId),
  ]);

  return ok([whatsapp, instagram].map((status) => ({
    ...status,
    connection: connections.find((c) => c.provider === status.provider) ?? null,
  })));
});
