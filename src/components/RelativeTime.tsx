"use client";

/**
 * Date relative en français.
 * Composant client isolé : `Date.now()` est capturé dans un état initial
 * puis rafraîchi par intervalle — jamais appelé directement pendant le
 * rendu (pureté React, SSR cohérent).
 */
import { useEffect, useState } from "react";

export function RelativeTime({ date }: { date: string | Date | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!date) return <span className="text-[var(--color-ink-faint)]">—</span>;

  const target = new Date(date);
  const diffMs = now - target.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  let label: string;
  if (diffMs < 0) label = "à venir";
  else if (diffMin < 1) label = "à l’instant";
  else if (diffMin < 60) label = `il y a ${diffMin} min`;
  else if (diffMin < 1440) label = `il y a ${Math.round(diffMin / 60)} h`;
  else if (diffMin < 10080) label = `il y a ${Math.round(diffMin / 1440)} j`;
  else
    label = target.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: target.getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined,
    });

  return (
    <time dateTime={target.toISOString()} title={target.toLocaleString("fr-FR")}>
      {label}
    </time>
  );
}
