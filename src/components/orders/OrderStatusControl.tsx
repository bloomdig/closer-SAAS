"use client";

/**
 * Mise à jour du statut d’une commande (§11).
 * Les transitions proposées viennent du serveur (machine à états) : aucune
 * transition invalide n’est seulement masquée, elle est refusée côté API.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { ORDER_STATUS_FR, ORDER_STATUS_TONE } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders/status";
import type { BadgeTone } from "@/components/ui";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone: BadgeTone = ORDER_STATUS_TONE[status] ?? "neutral";
  return (
    <span className={`badge badge-${tone}`}>{ORDER_STATUS_FR[status] ?? status}</span>
  );
}

export function OrderStatusControl({
  orderId,
  current,
  allowed,
}: {
  orderId: string;
  current: OrderStatus;
  allowed: OrderStatus[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (status: OrderStatus) => {
    setPending(status);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: status }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(json.error?.message ?? "Modification impossible.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setPending(null);
    }
  };

  if (allowed.length === 0) {
    return <OrderStatusBadge status={current} />;
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="badge badge-neutral cursor-pointer hover:border-[var(--color-line-strong)]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {ORDER_STATUS_FR[current] ?? current}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Fermer"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute right-0 z-20 mt-1 w-[210px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-canvas)] shadow-lg"
          >
            <p className="meta-label border-b border-[var(--color-line)] px-3 py-1.5">
              Changer le statut
            </p>
            <ul className="max-h-[260px] overflow-y-auto py-1">
              {allowed.map((status) => (
                <li key={status}>
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => void apply(status)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[var(--text-sm)] text-[var(--color-ink-secondary)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-50"
                  >
                    {ORDER_STATUS_FR[status] ?? status}
                    {pending === status ? (
                      <span className="meta-label">…</span>
                    ) : (
                      <Check className="h-3 w-3 opacity-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {error ? (
              <p className="border-t border-[var(--color-line)] px-3 py-2 text-[var(--text-xs)] text-[var(--color-negative)]">
                {error}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Filtres de statut fonctionnels (corrige D3 : la grille était en `href="#"`). */
export function OrderStatusFilters({
  counts,
  active,
}: {
  counts: Record<string, number>;
  active: string;
}) {
  const router = useRouter();
  const statuses = Object.keys(ORDER_STATUS_FR) as OrderStatus[];

  const select = (status: string) => {
    const next = status === active ? "" : status;
    router.push(next ? `/dashboard/orders?status=${next}` : "/dashboard/orders");
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => router.push("/dashboard/orders")}
        className={`h-7 rounded-[var(--radius-md)] border px-2.5 text-[var(--text-xs)] transition-colors ${
          active === ""
            ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
            : "border-[var(--color-line-strong)] bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
        }`}
      >
        Toutes
      </button>
      {statuses.map((status) => {
        const count = counts[status] ?? 0;
        const isActive = active === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => select(status)}
            disabled={count === 0 && !isActive}
            className={`h-7 rounded-[var(--radius-md)] border px-2.5 text-[var(--text-xs)] transition-colors disabled:opacity-40 ${
              isActive
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                : "border-[var(--color-line-strong)] bg-[var(--color-canvas)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {ORDER_STATUS_FR[status]}
            {count > 0 ? <span className="ml-1 tabular-nums">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export { buttonClass };
