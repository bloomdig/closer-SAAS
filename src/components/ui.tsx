/**
 * Primitives d’interface CLOSER (§25–§27).
 * Surcharge visuelle minimale : pas d’ombres colorées, pas de dégradés,
 * rayons réduits, densité élevée.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

/* ------------------------------- Boutons ------------------------------- */

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  accent: "btn-accent",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  block = false,
): string {
  return ["btn", VARIANT_CLASS[variant], SIZE_CLASS[size], block ? "btn-block" : ""]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  block = false,
  loading = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      className={`${buttonClass(variant, size, block)} ${className}`.trim()}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "secondary",
  size = "md",
  block = false,
  className = "",
}: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant, size, block)} ${className}`.trim()}>
      {children}
    </Link>
  );
}

/* ------------------------------- Badges ------------------------------- */

export type BadgeTone = "neutral" | "positive" | "warning" | "negative" | "info" | "accent";

const BADGE_CLASS: Record<BadgeTone, string> = {
  neutral: "badge-neutral",
  positive: "badge-positive",
  warning: "badge-warning",
  negative: "badge-negative",
  info: "badge-info",
  accent: "badge-accent",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`badge ${BADGE_CLASS[tone]} ${className}`.trim()}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}

/* ------------------------------- Panneaux ------------------------------- */

export function Panel({
  children,
  className = "",
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return <div className={`${flush ? "panel-flush" : "panel"} ${className}`.trim()}>{children}</div>;
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-4 py-3">
      <div className="min-w-0">
        <h2 className="section-title truncate">{title}</h2>
        {description ? <p className="meta-label mt-0.5">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ------------------------------- En-tête de page ------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------- États ------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]">
          {icon}
        </div>
      ) : null}
      <p className="text-[var(--text-base)] font-medium text-[var(--color-ink)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--color-line)]">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-7 w-7 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-2.5 w-1/3" />
            <div className="skeleton h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Une erreur est survenue",
  description,
  retry,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-[var(--text-base)] font-medium text-[var(--color-negative)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          {description}
        </p>
      ) : null}
      {retry ? (
        <button type="button" className="btn btn-secondary mt-4" onClick={retry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------- Divers ------------------------------- */

/** Indicateur honnête « implémenté mais non configuré » (§41). */
export function NotConfigured({
  title,
  description,
  requirements,
  action,
}: {
  title: string;
  description?: string;
  requirements?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-4 py-5 rounded-[var(--radius-lg)]">
      <div className="flex items-start gap-2.5">
        <span className="dot mt-1.5 text-[var(--color-ink-faint)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[var(--text-sm)] font-medium text-[var(--color-ink)]">{title}</p>
          {description ? (
            <p className="mt-1 text-[var(--text-sm)] text-[var(--color-ink-muted)]">{description}</p>
          ) : null}
          {requirements?.length ? (
            <ul className="mt-2.5 space-y-1">
              {requirements.map((item) => (
                <li key={item} className="font-mono text-[var(--text-xs)] text-[var(--color-ink-muted)]">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Valeur monétaire — MAD par défaut, jamais de $ ou € (§30). */
export function Money({
  cents,
  className = "",
  muted = false,
}: {
  cents: number | null | undefined;
  className?: string;
  muted?: boolean;
}) {
  if (cents === null || cents === undefined) {
    return <span className={`text-[var(--color-ink-faint)] ${className}`}>—</span>;
  }
  const value = cents / 100;
  const text = Number.isInteger(value)
    ? value.toLocaleString("fr-FR")
    : value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <span className={muted ? `text-[var(--color-ink-muted)] ${className}` : className}>
      {text} <span className="text-[var(--color-ink-muted)]">DH</span>
    </span>
  );
}

// Date relative : implémentation dans un composant client dédié
// (rafraîchissement par intervalle, `Date.now()` jamais appelé pendant le rendu).
export { RelativeTime } from "@/components/RelativeTime";

/** Heure précise pour les bulles de conversation. */
export function MessageTime({ date }: { date: string | Date }) {
  const target = new Date(date);
  const today = new Date();
  const sameDay = target.toDateString() === today.toDateString();

  return (
    <span className="text-[10px] text-[var(--color-ink-faint)] tabular-nums">
      {sameDay
        ? target.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : target.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
          " " +
          target.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
