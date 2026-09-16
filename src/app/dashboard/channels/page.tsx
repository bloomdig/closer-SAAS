import { requireMerchantPage } from "@/lib/auth/guards";
import { getChannelStatus } from "@/lib/channels/registry";
import { Badge, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { ChannelConnector } from "@/components/channels/ChannelConnector";
import { can } from "@/lib/security/tenant";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Canaux (§16, §17, §41).
 * WhatsApp et Instagram via leurs API officielles Meta uniquement — aucun
 * scraping WhatsApp Web, aucune automatisation de navigateur.
 * Sans identifiants : état « non connecté » explicite, jamais simulé.
 */
export default async function ChannelsPage() {
  const authed = await requireMerchantPage();
  const merchantId = authed.session.merchantId;

  const [whatsapp, instagram] = await Promise.all([
    getChannelStatus("whatsapp", merchantId),
    getChannelStatus("instagram", merchantId),
  ]);

  const canManage = can(authed.session.role, "channels:manage");

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        title="Canaux"
        subtitle="Connectez WhatsApp et Instagram pour que CLOSER réponde à vos clients là où ils écrivent."
      />

      <div className="space-y-4">
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                WhatsApp Business
                {whatsapp.connected ? (
                  <Badge tone="positive" dot>
                    Connecté
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>
                    Non connecté
                  </Badge>
                )}
              </span>
            }
            description="WhatsApp Cloud API officielle de Meta."
          />
          <div className="px-4 py-4">
            <ChannelConnector
              provider="whatsapp"
              connected={whatsapp.connected}
              scope={whatsapp.scope}
              missing={whatsapp.missing}
              reason={whatsapp.reason ?? null}
              displayName={whatsapp.displayName ?? null}
              canManage={canManage}
              featureBlocked={!authed.access.features.channels}
            />
            <ol className="mt-4 space-y-1.5 border-t border-[var(--color-line)] pt-3 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
              <li>1. Créez une application sur developers.facebook.com et activez WhatsApp.</li>
              <li>2. Ajoutez votre numéro professionnel et obtenez l’identifiant du numéro et le WABA ID.</li>
              <li>3. Générez un jeton d’accès permanent et récupérez l’App Secret.</li>
              <li>
                4. Renseignez l’URL de rappel :{" "}
                <code className="font-mono text-[var(--color-ink-secondary)]">
                  {process.env.APP_URL ?? "https://votre-domaine"}/api/webhooks/whatsapp
                </code>
              </li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api"
              target="_blank"
              rel="noopener noreferrer"
              className="link mt-3 inline-flex items-center gap-1 text-[var(--text-sm)]"
            >
              Documentation WhatsApp Cloud API
              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
            </a>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                Instagram
                {instagram.connected ? (
                  <Badge tone="positive" dot>
                    Connecté
                  </Badge>
                ) : (
                  <Badge tone="neutral" dot>
                    Non connecté
                  </Badge>
                )}
              </span>
            }
            description="Instagram Messaging API officielle de Meta."
          />
          <div className="px-4 py-4">
            <ChannelConnector
              provider="instagram"
              connected={instagram.connected}
              scope={instagram.scope}
              missing={instagram.missing}
              reason={instagram.reason ?? null}
              displayName={instagram.displayName ?? null}
              canManage={canManage}
              featureBlocked={!authed.access.features.channels}
            />
            <ol className="mt-4 space-y-1.5 border-t border-[var(--color-line)] pt-3 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
              <li>1. Passez votre compte Instagram en compte professionnel et liez-le à une page Facebook.</li>
              <li>2. Dans votre application Meta, activez le produit Instagram et demandez la permission <code className="font-mono">instagram_manage_messages</code>.</li>
              <li>3. Renseignez l’App ID, l’App Secret et générez un jeton d’accès longue durée.</li>
              <li>
                4. Renseignez l’URL de rappel :{" "}
                <code className="font-mono text-[var(--color-ink-secondary)]">
                  {process.env.APP_URL ?? "https://votre-domaine"}/api/webhooks/instagram
                </code>
              </li>
            </ol>
            <a
              href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations"
              target="_blank"
              rel="noopener noreferrer"
              className="link mt-3 inline-flex items-center gap-1 text-[var(--text-sm)]"
            >
              Documentation Instagram Messaging API
              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
            </a>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Chat web" description="Intégré par défaut, aucune configuration requise." />
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[var(--text-sm)] text-[var(--color-ink-muted)]">
              Le simulateur de conversation web est disponible dans l’onglet Conversations :
              il vous permet de tester CLOSER avant de brancher WhatsApp ou Instagram.
            </p>
            <Badge tone="positive" dot>
              Disponible
            </Badge>
          </div>
        </Panel>
      </div>
    </div>
  );
}
