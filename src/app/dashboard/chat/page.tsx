import { requireMerchantPage } from "@/lib/auth/guards";
import { listConversations } from "@/lib/repositories";
import { isAiConfigured } from "@/lib/ai/engine";
import { getChannelStatus } from "@/lib/channels/registry";
import {
  ConversationWorkspace,
  type ConversationListItem,
} from "@/components/conversations/ConversationWorkspace";
import { PageHeader, Badge } from "@/components/ui";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Conversations — l’écran le plus important de CLOSER (§28).
 * Les données viennent de la base ; aucune conversation fictive n’est affichée.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; needsReview?: string }>;
}) {
  const authed = await requireMerchantPage();
  const params = await searchParams;

  const [result, whatsapp, instagram] = await Promise.all([
    listConversations(authed.session.merchantId, {
      pageSize: 60,
      needsHumanReview: params.needsReview === "true" ? true : undefined,
    }),
    getChannelStatus("whatsapp", authed.session.merchantId),
    getChannelStatus("instagram", authed.session.merchantId),
  ]);

  const conversations = result.rows as ConversationListItem[];
  const aiConfigured = isAiConfigured();

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title="Conversations"
        subtitle="Suivez les échanges clients, validez les propositions de CLOSER et reprenez la main quand c’est nécessaire."
        actions={
          <>
            <Badge tone={aiConfigured ? "positive" : "warning"} dot>
              {aiConfigured ? "Agent de vente actif" : "Agent de vente non configuré"}
            </Badge>
            <Badge tone={whatsapp.connected || instagram.connected ? "positive" : "neutral"} dot>
              {[whatsapp.connected ? "WhatsApp" : null, instagram.connected ? "Instagram" : null]
                .filter(Boolean)
                .join(" + ") || "Aucun canal connecté"}
            </Badge>
          </>
        }
      />

      {!aiConfigured ? (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5">
          <Sparkles className="mt-px h-4 w-4 shrink-0 text-[var(--color-ink-muted)]" strokeWidth={1.8} />
          <p className="text-[var(--text-sm)] text-[var(--color-ink-muted)]">
            L’agent de vente n’est pas encore activé : définissez{" "}
            <code className="font-mono text-[var(--color-ink-secondary)]">GEMINI_API_KEY</code>{" "}
            dans les variables d’environnement du serveur. Vous pouvez déjà répondre
            manuellement à vos clients.
          </p>
        </div>
      ) : null}

      <ConversationWorkspace
        conversations={conversations}
        initialConversationId={params.id ?? null}
        aiConfigured={aiConfigured}
        channelStatuses={[
          { provider: "whatsapp", connected: whatsapp.connected },
          { provider: "instagram", connected: instagram.connected },
        ]}
      />
    </div>
  );
}
