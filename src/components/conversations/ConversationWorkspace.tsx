"use client";

/**
 * Espace de travail des conversations (§28, §31).
 * =====================================================================
 * Trois zones sur grand écran : liste | fil | contexte client.
 * Sur mobile, une seule zone à la fois avec navigation retour.
 *
 * Tout est réel : la liste vient de la base, les messages sont envoyés via
 * l’API, les brouillons IA sont validés ou écartés, la reprise en main
 * modifie effectivement le mode de traitement de la conversation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Check,
  Filter,
  MessageSquare,
  Package,
  Phone,
  Search,
  Send,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { Badge, EmptyState, Money, RelativeTime, MessageTime, buttonClass } from "@/components/ui";
import {
  CHANNEL_FR,
  HANDOFF_MODE_DESCRIPTION_FR,
  HANDOFF_MODE_FR,
  ORDER_STATUS_FR,
  ORDER_STATUS_TONE,
  formatMoroccanPhone,
  initials,
} from "@/lib/format";

/* --------------------------------- Types --------------------------------- */

export type ConversationListItem = {
  id: string;
  status: string;
  source: string;
  handoffMode: string;
  aiEnabled: boolean;
  needsHumanReview: boolean;
  reviewReason: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerCity: string | null;
};

export type MessageItem = {
  id: string;
  senderType: "customer" | "ai" | "agent" | "system";
  content: string;
  status: string;
  aiGenerated: boolean;
  createdAt: string;
};

export type CustomerItem = {
  id: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  status: string;
  ordersCount: number;
  totalSpent: number;
  notes: string | null;
} | null;

export type OrderItem = {
  id: string;
  reference: string;
  orderStatus: string;
  total: number;
  city: string | null;
  createdAt: string;
  items: { name: string; quantity: number; variant?: string | null }[];
};

export type ConversationDetail = {
  id: string;
  status: string;
  source: string;
  handoffMode: string;
  aiEnabled: boolean;
  needsHumanReview: boolean;
  reviewReason: string | null;
};

type ApiError = { error?: { message?: string; code?: string } };

/* --------------------------------- Utilitaires --------------------------------- */

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const text = await response.text();
  const json = (text ? JSON.parse(text) : {}) as T & ApiError;

  if (!response.ok) {
    throw new Error(json.error?.message ?? `Erreur ${response.status}`);
  }
  return json as T;
}

function displayName(item: ConversationListItem): string {
  return item.customerName ?? item.customerPhone ?? "Client inconnu";
}

/* --------------------------------- Composant --------------------------------- */

export function ConversationWorkspace({
  conversations,
  initialConversationId,
  aiConfigured,
  channelStatuses,
}: {
  conversations: ConversationListItem[];
  initialConversationId: string | null;
  aiConfigured: boolean;
  channelStatuses: { provider: string; connected: boolean }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId ?? conversations[0]?.id ?? null,
  );
  const [items, setItems] = useState(conversations);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [drafts, setDrafts] = useState<MessageItem[]>([]);
  const [customer, setCustomer] = useState<CustomerItem>(null);
  const [customerOrders, setCustomerOrders] = useState<OrderItem[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">(
    selectedId ? "thread" : "list",
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const whatsappConnected = channelStatuses.find((c) => c.provider === "whatsapp")?.connected ?? false;
  const anyChannelConnected = channelStatuses.some((c) => c.connected);

  /* ------------------------- chargement du fil ------------------------- */

  const loadThread = useCallback(
    async (conversationId: string, options: { silent?: boolean } = {}) => {
      if (!options.silent) setLoadingThread(true);
      setError(null);
      try {
        const data = await api<{
          conversation: ConversationDetail;
          customer: CustomerItem;
          messages: MessageItem[];
          drafts: MessageItem[];
          customerOrders: OrderItem[];
        }>(`/api/conversations/${conversationId}`);

        setDetail(data.conversation);
        setCustomer(data.customer);
        setMessages(data.messages);
        setDrafts(data.drafts);
        setCustomerOrders(data.customerOrders);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger la conversation.");
      } finally {
        setLoadingThread(false);
      }
    },
    [],
  );

  // Réinitialisation quand aucune conversation n’est sélectionnée
  // (ajustement d’état pendant le rendu, sans setState dans un effet).
  const [previousSelectedId, setPreviousSelectedId] = useState<string | null>(selectedId);
  if (selectedId !== previousSelectedId) {
    setPreviousSelectedId(selectedId);
    if (!selectedId) {
      setMessages([]);
      setDrafts([]);
      setCustomer(null);
      setCustomerOrders([]);
      setDetail(null);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    // Chargement de données au changement de sélection : le setState initial
    // (indicateur de chargement) fait partie du motif de fetch, pas d’une
    // cascade de rendus évitable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThread(selectedId);
  }, [selectedId, loadThread]);

  // Synchronise l’URL pour qu’un lien direct ouvre la bonne conversation.
  useEffect(() => {
    const current = searchParams.get("id");
    if (selectedId && current !== selectedId) {
      router.replace(`/dashboard/chat?id=${selectedId}`, { scroll: false });
    }
    if (!selectedId && current) {
      router.replace("/dashboard/chat", { scroll: false });
    }
  }, [selectedId, searchParams, router]);

  // Défilement vers le dernier message.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, selectedId]);

  // Rafraîchissement léger toutes les 20 s pour rester à jour.
  useEffect(() => {
    if (!selectedId) return;
    const timer = setInterval(() => {
      void loadThread(selectedId, { silent: true });
    }, 20_000);
    return () => clearInterval(timer);
  }, [selectedId, loadThread]);

  /* ------------------------------ actions ------------------------------ */

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setMobilePane("thread");
    setDraft("");
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, unreadCount: 0 } : item)),
    );
  };

  const sendCustomerSimulation = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: draft.trim(), as: "customer" }),
      });
      setDraft("");
      await loadThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const sendAgentMessage = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: draft.trim() }),
      });
      setDraft("");
      await loadThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  const decideDraft = async (messageId: string, action: "approve" | "reject") => {
    if (!selectedId) return;
    setError(null);
    try {
      await api(`/api/conversations/${selectedId}/drafts`, {
        method: "POST",
        body: JSON.stringify({ messageId, action }),
      });
      await loadThread(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const changeMode = async (handoffMode: "ai" | "approval" | "manual") => {
    if (!selectedId) return;
    setError(null);
    try {
      await api(`/api/conversations/${selectedId}/takeover`, {
        method: "POST",
        body: JSON.stringify({ handoffMode, clearReview: handoffMode !== "manual" }),
      });
      await loadThread(selectedId);
      setItems((previous) =>
        previous.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                handoffMode,
                aiEnabled: handoffMode !== "manual",
                needsHumanReview: handoffMode === "manual" ? item.needsHumanReview : false,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    }
  };

  /* ------------------------------ filtres ------------------------------ */

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "review" && !item.needsHumanReview) return false;
      if (statusFilter === "open" && item.status !== "open") return false;
      if (statusFilter === "manual" && item.handoffMode !== "manual") return false;
      if (!needle) return true;
      return (
        displayName(item).toLowerCase().includes(needle) ||
        (item.lastMessagePreview ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, query, statusFilter]);

  const isManual = detail?.handoffMode === "manual" || !detail?.aiEnabled;

  /* ------------------------------- rendu ------------------------------- */

  const listPane = (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--color-line)] p-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[var(--color-ink-faint)]"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un client, un message…"
            className="field h-8 pl-8 text-[var(--text-sm)]"
            aria-label="Rechercher une conversation"
          />
        </div>
        <div className="mt-2 flex items-center gap-1 overflow-x-auto">
          {[
            { value: "all", label: "Toutes" },
            { value: "open", label: "Ouvertes" },
            { value: "review", label: "À traiter" },
            { value: "manual", label: "Manuelles" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={`h-6 shrink-0 rounded-[var(--radius-sm)] px-2 text-[var(--text-xs)] transition-colors ${
                statusFilter === option.value
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-4 w-4" strokeWidth={1.8} />}
            title={items.length === 0 ? "Aucune conversation" : "Aucun résultat"}
            description={
              items.length === 0
                ? anyChannelConnected
                  ? "Les messages de vos clients apparaîtront ici."
                  : "Connectez WhatsApp ou Instagram pour recevoir des messages clients."
                : "Modifiez votre recherche ou vos filtres."
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {filtered.map((item) => {
              const active = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(item.id)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-[var(--color-surface-sunken)]" : "hover:bg-[var(--color-surface)]"
                    }`}
                    aria-current={active}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[10px] font-medium text-[var(--color-ink-secondary)]">
                      {initials(displayName(item))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[var(--text-sm)] ${
                            item.unreadCount > 0
                              ? "font-semibold text-[var(--color-ink)]"
                              : "font-medium text-[var(--color-ink)]"
                          }`}
                        >
                          {displayName(item)}
                        </span>
                        <span className="meta-label shrink-0">
                          <RelativeTime date={item.lastMessageAt} />
                        </span>
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[var(--text-xs)] ${
                          item.unreadCount > 0
                            ? "text-[var(--color-ink-secondary)]"
                            : "text-[var(--color-ink-muted)]"
                        }`}
                      >
                        {item.lastMessagePreview ?? "—"}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <span className="meta-label">{CHANNEL_FR[item.source] ?? item.source}</span>
                        {item.needsHumanReview ? (
                          <Badge tone="warning">À traiter</Badge>
                        ) : item.handoffMode === "manual" ? (
                          <Badge tone="neutral">Manuel</Badge>
                        ) : item.handoffMode === "approval" ? (
                          <Badge tone="info">Validation</Badge>
                        ) : null}
                        {item.unreadCount > 0 ? (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)] px-1 text-[10px] font-medium text-white">
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const threadPane = selectedId ? (
    <div className="flex h-full flex-col">
      {/* En-tête du fil */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--color-line)] px-3 py-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm lg:hidden"
          onClick={() => setMobilePane("list")}
          aria-label="Retour à la liste"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
            {customer?.name ?? customer?.phone ?? "Client"}
          </p>
          <p className="meta-label truncate">
            {detail ? CHANNEL_FR[detail.source] ?? detail.source : ""}
            {customer?.city ? ` · ${customer.city}` : ""}
            {detail?.needsHumanReview ? " · à traiter" : ""}
          </p>
        </div>

        {/* Bascule de mode (§12) */}
        <div className="hidden items-center gap-px rounded-[var(--radius-md)] border border-[var(--color-line-strong)] p-px sm:flex">
          {(["ai", "approval", "manual"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeMode(mode)}
              disabled={!aiConfigured && mode === "ai"}
              title={aiConfigured ? HANDOFF_MODE_DESCRIPTION_FR[mode] : "IA non configurée"}
              className={`h-[26px] rounded-[var(--radius-sm)] px-2.5 text-[var(--text-xs)] transition-colors ${
                detail?.handoffMode === mode
                  ? "bg-[var(--color-ink)] text-white"
                  : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
              } disabled:opacity-40`}
            >
              {HANDOFF_MODE_FR[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Alerte reprise en main */}
      {detail?.needsHumanReview ? (
        <div className="flex shrink-0 items-start gap-2 border-b border-[#fde68a] bg-[var(--color-warning-soft)] px-3 py-2">
          <UserRound className="mt-px h-[14px] w-[14px] shrink-0 text-[var(--color-warning)]" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <p className="text-[var(--text-xs)] text-[var(--color-ink-secondary)]">
              {detail.reviewReason ?? "Cette conversation nécessite votre intervention."}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => changeMode("manual")}>
            Prendre la main
          </button>
        </div>
      ) : null}

      {!aiConfigured ? (
        <div className="shrink-0 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-[var(--text-xs)] text-[var(--color-ink-muted)]">
            Agent de vente non configuré : la clé <code className="font-mono">GEMINI_API_KEY</code>{" "}
            doit être définie côté serveur pour que CLOSER réponde automatiquement.
          </p>
        </div>
      ) : null}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[var(--color-surface)] px-3 py-3">
        {loadingThread && messages.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-12 w-2/3" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-4 w-4" strokeWidth={1.8} />}
            title="Aucun message"
            description="Envoyez un premier message pour démarrer la conversation."
          />
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </ul>
        )}

        {/* Brouillons IA en attente de validation (§12) */}
        {drafts.length > 0 ? (
          <div className="mt-3 space-y-2">
            {drafts.map((item) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] p-3"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Bot className="h-[14px] w-[14px] text-[var(--color-accent)]" strokeWidth={1.8} />
                  <span className="text-[var(--text-xs)] font-medium text-[var(--color-accent)]">
                    Réponse proposée par CLOSER — validation requise
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[var(--text-sm)] text-[var(--color-ink)]">
                  {item.content}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    className={`${buttonClass("accent", "sm")} cursor-pointer`}
                    onClick={() => decideDraft(item.id, "approve")}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    Envoyer
                  </button>
                  <button
                    type="button"
                    className={`${buttonClass("secondary", "sm")} cursor-pointer`}
                    onClick={() => decideDraft(item.id, "reject")}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                    Écarter
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="shrink-0 border-t border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2">
          <p className="text-[var(--text-xs)] text-[var(--color-negative)]">{error}</p>
        </div>
      ) : null}

      {/* Zone de saisie */}
      <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-canvas)] p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void (isManual ? sendAgentMessage() : sendCustomerSimulation());
              }
            }}
            rows={1}
            placeholder={
              isManual
                ? "Répondre au client…"
                : "Simuler un message client pour tester CLOSER…"
            }
            className="field field-area max-h-32 min-h-[36px] flex-1 py-2"
            aria-label="Message"
          />
          <button
            type="button"
            onClick={() => void (isManual ? sendAgentMessage() : sendCustomerSimulation())}
            disabled={sending || !draft.trim()}
            className={`${buttonClass(isManual ? "primary" : "secondary", "md")} h-[36px] w-[36px] shrink-0 !px-0 cursor-pointer`}
            title={isManual ? "Envoyer au client" : "Envoyer comme message client"}
          >
            <Send className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between sm:hidden">
          <select
            value={detail?.handoffMode ?? "ai"}
            onChange={(event) => changeMode(event.target.value as "ai" | "approval" | "manual")}
            className="field h-7 w-auto text-[var(--text-xs)]"
            aria-label="Mode de traitement"
          >
            <option value="ai">IA active</option>
            <option value="approval">Validation requise</option>
            <option value="manual">Mode manuel</option>
          </select>
          <span className="meta-label">Entrée pour envoyer</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<MessageSquare className="h-4 w-4" strokeWidth={1.8} />}
        title="Sélectionnez une conversation"
        description={
          anyChannelConnected
            ? "Choisissez un client dans la liste pour afficher l’échange."
            : "Connectez d’abord WhatsApp ou Instagram pour recevoir des messages."
        }
      />
    </div>
  );

  const contextPane = selectedId ? (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-[var(--color-line)] p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--text-xs)] font-medium text-[var(--color-ink-secondary)]">
            {initials(customer?.name ?? customer?.phone)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
              {customer?.name ?? "Client sans nom"}
            </p>
            <p className="meta-label truncate">{customer ? formatMoroccanPhone(customer.phone) : "—"}</p>
          </div>
        </div>
        {customer ? (
          <dl className="mt-3 space-y-1.5 text-[var(--text-xs)]">
            <Row label="Ville" value={customer.city ?? "—"} icon={<Package className="h-3 w-3" strokeWidth={1.8} />} />
            <Row label="Adresse" value={customer.address ?? "—"} />
            <Row label="Commandes" value={String(customer.ordersCount)} icon={<ShoppingCart className="h-3 w-3" strokeWidth={1.8} />} />
            <Row
              label="Total dépensé"
              value={`${(customer.totalSpent / 100).toLocaleString("fr-FR")} DH`}
            />
            <Row label="Statut" value={customer.status} />
          </dl>
        ) : (
          <p className="meta-label mt-3">
            Les informations du client seront renseignées automatiquement par CLOSER
            pendant la conversation.
          </p>
        )}
        {customer?.id ? (
          <a
            href={`/dashboard/customers?id=${customer.id}`}
            className="link mt-2.5 inline-block text-[var(--text-xs)]"
          >
            Voir la fiche client
          </a>
        ) : null}
      </div>

      <div className="border-b border-[var(--color-line)] p-3.5">
        <h3 className="meta-label mb-2">Traitement</h3>
        <div className="space-y-1.5">
          {(["ai", "approval", "manual"] as const).map((mode) => (
            <label
              key={mode}
              className={`flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 transition-colors ${
                detail?.handoffMode === mode
                  ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)]"
                  : "border-[var(--color-line)] hover:bg-[var(--color-surface)]"
              }`}
            >
              <input
                type="radio"
                name="handoff"
                className="mt-0.5 accent-[var(--color-accent)]"
                checked={detail?.handoffMode === mode}
                disabled={!aiConfigured && mode === "ai"}
                onChange={() => changeMode(mode)}
              />
              <span className="min-w-0">
                <span className="block text-[var(--text-xs)] font-medium text-[var(--color-ink)]">
                  {HANDOFF_MODE_FR[mode]}
                </span>
                <span className="mt-0.5 block text-[var(--text-xs)] leading-snug text-[var(--color-ink-muted)]">
                  {HANDOFF_MODE_DESCRIPTION_FR[mode]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="p-3.5">
        <h3 className="meta-label mb-2">Commandes du client</h3>
        {customerOrders.length === 0 ? (
          <p className="text-[var(--text-xs)] text-[var(--color-ink-muted)]">Aucune commande.</p>
        ) : (
          <ul className="space-y-2">
            {customerOrders.map((order) => (
              <li key={order.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[var(--text-xs)] text-[var(--color-ink-secondary)]">
                    {order.reference}
                  </span>
                  <Badge tone={ORDER_STATUS_TONE[order.orderStatus as keyof typeof ORDER_STATUS_TONE] ?? "neutral"}>
                    {ORDER_STATUS_FR[order.orderStatus as keyof typeof ORDER_STATUS_FR] ?? order.orderStatus}
                  </Badge>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {order.items.slice(0, 3).map((line, index) => (
                    <li key={index} className="text-[var(--text-xs)] text-[var(--color-ink-muted)]">
                      {line.quantity} × {line.name}
                      {line.variant ? ` (${line.variant})` : ""}
                    </li>
                  ))}
                </ul>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="meta-label">
                    <RelativeTime date={order.createdAt} />
                  </span>
                  <Money cents={order.total} className="text-[var(--text-xs)] font-medium text-[var(--color-ink)]" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="panel-flush flex h-[calc(100vh-140px)] min-h-[460px] lg:h-[calc(100vh-104px)]">
      {/* Liste */}
      <div
        className={`w-full shrink-0 border-r border-[var(--color-line)] lg:block lg:w-[268px] xl:w-[300px] ${
          mobilePane === "list" ? "block" : "hidden"
        }`}
      >
        {listPane}
      </div>

      {/* Fil */}
      <div
        className={`min-w-0 flex-1 lg:block ${mobilePane === "thread" ? "block" : "hidden"}`}
      >
        {threadPane}
      </div>

      {/* Contexte */}
      {contextPane ? (
        <div className="hidden w-[280px] shrink-0 border-l border-[var(--color-line)] xl:block">
          {contextPane}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- Sous-éléments ------------------------------- */

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="meta-label flex shrink-0 items-center gap-1">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-right text-[var(--color-ink-secondary)]">{value}</dd>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageItem }) {
  const fromCustomer = message.senderType === "customer";
  const fromAi = message.senderType === "ai";

  if (message.senderType === "system") {
    return (
      <li className="flex justify-center">
        <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] px-2 py-1 text-[var(--text-xs)] text-[var(--color-ink-muted)]">
          {message.content}
        </span>
      </li>
    );
  }

  return (
    <li className={`flex gap-2 ${fromCustomer ? "" : "flex-row-reverse"}`}>
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          fromAi
            ? "bg-[var(--color-ink)] text-white"
            : fromCustomer
              ? "bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)]"
              : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
        }`}
      >
        {fromAi ? (
          <Bot className="h-3 w-3" strokeWidth={2} />
        ) : fromCustomer ? (
          <UserRound className="h-3 w-3" strokeWidth={2} />
        ) : (
          <Phone className="h-3 w-3" strokeWidth={2} />
        )}
      </span>

      <div className={`min-w-0 max-w-[78%] sm:max-w-[68%] ${fromCustomer ? "" : "text-right"}`}>
        <div
          className={`inline-block whitespace-pre-wrap rounded-[var(--radius-lg)] px-3 py-2 text-left text-[var(--text-sm)] leading-relaxed ${
            fromCustomer
              ? "rounded-tl-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-canvas)] text-[var(--color-ink)]"
              : fromAi
                ? "rounded-tr-[var(--radius-sm)] bg-[var(--color-ink)] text-[var(--color-ink-inverse)]"
                : "rounded-tr-[var(--radius-sm)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
          }`}
        >
          {message.content}
        </div>
        <div className={`mt-0.5 flex items-center gap-1.5 ${fromCustomer ? "" : "justify-end"}`}>
          <span className="meta-label">
            {fromAi ? "CLOSER" : fromCustomer ? "Client" : "Conseiller"}
          </span>
          <MessageTime date={message.createdAt} />
          {message.status === "failed" ? <Badge tone="negative">Échec</Badge> : null}
          {!fromCustomer && message.status === "read" ? (
            <span className="meta-label">lu</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
