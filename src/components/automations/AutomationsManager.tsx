"use client";

/**
 * Automatisations (§15).
 * Remplace la page statique du prototype : chaque règle est réellement
 * activable, avec délai et message configurables, persistés en base.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Badge, Panel } from "@/components/ui";
import { formatDurationMinutes } from "@/lib/format";

export type AutomationRow = {
  type: string;
  label: string;
  description: string;
  defaultDelayMinutes: number;
  defaultTemplate: string;
  enabled: boolean;
  delayMinutes: number;
  configuration: {
    messageTemplate?: string;
    language?: string;
    maxSendsPerCustomerPerDay?: number;
    quietHoursStart?: number;
    quietHoursEnd?: number;
  };
};

export function AutomationsManager({
  automations,
  canManage,
  activeLimit,
  activeCount,
  featureBlocked,
  featureMessage,
}: {
  automations: AutomationRow[];
  canManage: boolean;
  activeLimit: number;
  activeCount: number;
  featureBlocked: boolean;
  featureMessage: string | null;
}) {
  const router = useRouter();
  const [openType, setOpenType] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { delayMinutes: number; messageTemplate: string }>>({});

  const draftFor = (automation: AutomationRow) =>
    drafts[automation.type] ?? {
      delayMinutes: automation.delayMinutes,
      messageTemplate: automation.configuration.messageTemplate ?? automation.defaultTemplate,
    };

  const setDraft = (type: string, patch: Partial<{ delayMinutes: number; messageTemplate: string }>) => {
    setDrafts((previous) => ({
      ...previous,
      [type]: { ...draftFor(automations.find((a) => a.type === type)!), ...patch },
    }));
  };

  const save = async (automation: AutomationRow, enabled: boolean) => {
    setBusy(automation.type);
    setError(null);
    const draft = draftFor(automation);

    try {
      const response = await fetch(`/api/automations/${automation.type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          delayMinutes: draft.delayMinutes,
          messageTemplate: draft.messageTemplate,
        }),
      });

      const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Enregistrement impossible.");

      router.refresh();
      if (enabled) setOpenType(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="meta-label">
          {activeCount} / {activeLimit} automatisations actives
        </span>
        {featureBlocked ? <Badge tone="warning">Fonctionnalité limitée par votre offre</Badge> : null}
      </div>

      {featureBlocked && featureMessage ? (
        <p className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
          {featureMessage}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}

      <div className="space-y-2.5">
        {automations.map((automation) => {
          const open = openType === automation.type;
          const draft = draftFor(automation);

          return (
            <Panel key={automation.type}>
              <div className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border ${
                    automation.enabled
                      ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-faint)]"
                  }`}
                >
                  <Zap className="h-[14px] w-[14px]" strokeWidth={1.8} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
                      {automation.label}
                    </h3>
                    {automation.enabled ? (
                      <Badge tone="positive" dot>
                        Active · après {formatDurationMinutes(automation.delayMinutes)}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Désactivée</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
                    {automation.description}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOpenType(open ? null : automation.type)}
                      className="btn btn-secondary btn-sm cursor-pointer"
                    >
                      {open ? "Fermer" : "Configurer"}
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={automation.enabled}
                      aria-label={automation.enabled ? `Désactiver ${automation.label}` : `Activer ${automation.label}`}
                      disabled={busy === automation.type || (featureBlocked && !automation.enabled)}
                      onClick={() => void save(automation, !automation.enabled)}
                      className={`relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
                        automation.enabled
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                          : "border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)]"
                      }`}
                    >
                      <span
                        className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-all ${
                          automation.enabled ? "left-[19px]" : "left-[2px]"
                        }`}
                      />
                    </button>
                  </div>
                ) : null}
              </div>

              {open ? (
                <div className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                    <div>
                      <label className="field-label" htmlFor={`delay-${automation.type}`}>
                        Délai avant envoi (minutes)
                      </label>
                      <input
                        id={`delay-${automation.type}`}
                        type="number"
                        min={1}
                        max={43200}
                        className="field"
                        value={draft.delayMinutes}
                        onChange={(event) =>
                          setDraft(automation.type, { delayMinutes: Number(event.target.value) || 1 })
                        }
                      />
                      <p className="field-hint">{formatDurationMinutes(draft.delayMinutes)}</p>
                    </div>

                    <div>
                      <label className="field-label" htmlFor={`template-${automation.type}`}>
                        Message envoyé
                      </label>
                      <textarea
                        id={`template-${automation.type}`}
                        className="field field-area"
                        rows={3}
                        value={draft.messageTemplate}
                        onChange={(event) =>
                          setDraft(automation.type, { messageTemplate: event.target.value })
                        }
                      />
                      <p className="field-hint">
                        Variables disponibles :{" "}
                        <code className="font-mono">{"{{customer_name}}"}</code>,{" "}
                        <code className="font-mono">{"{{product_name}}"}</code>,{" "}
                        <code className="font-mono">{"{{order_reference}}"}</code>,{" "}
                        <code className="font-mono">{"{{order_total}}"}</code>,{" "}
                        <code className="font-mono">{"{{business_name}}"}</code>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="meta-label">
                      Heures calmes : aucun envoi entre {automation.configuration.quietHoursStart ?? 22} h et{" "}
                      {automation.configuration.quietHoursEnd ?? 9} h (fuseau de votre boutique).
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft(automation.type, {
                            delayMinutes: automation.defaultDelayMinutes,
                            messageTemplate: automation.defaultTemplate,
                          })
                        }
                        className="btn btn-ghost btn-sm cursor-pointer"
                      >
                        Réinitialiser
                      </button>
                      <button
                        type="button"
                        onClick={() => void save(automation, automation.enabled)}
                        disabled={busy === automation.type}
                        className="btn btn-primary btn-sm cursor-pointer"
                      >
                        {busy === automation.type ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </Panel>
          );
        })}
      </div>

      <p className="meta-label mt-4">
        Chaque envoi est journalisé et limité : une seule relance par conversation,
        dans la limite quotidienne de votre offre. Si le canal n’est pas connecté,
        l’automatisation est ignorée — aucun message n’est envoyé en simulation.
      </p>
    </>
  );
}
