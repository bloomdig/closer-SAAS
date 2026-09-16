"use client";

/**
 * Connexion d’un canal officiel (§16, §17, §41).
 * Les jetons sont transmis au serveur puis chiffrés ; ils ne sont jamais
 * renvoyés au navigateur. L’état affiché reflète toujours la réalité :
 * aucune connexion n’est simulée.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plug, Unplug } from "lucide-react";
import { Badge, buttonClass } from "@/components/ui";

const FIELDS: Record<
  string,
  { key: string; label: string; hint: string; placeholder: string }[]
> = {
  whatsapp: [
    {
      key: "WHATSAPP_PHONE_NUMBER_ID",
      label: "Identifiant du numéro (Phone Number ID)",
      hint: "WhatsApp › Configuration de l’API dans la console Meta.",
      placeholder: "109876543210987",
    },
    {
      key: "WHATSAPP_WABA_ID",
      label: "Identifiant du compte WhatsApp Business (WABA ID)",
      hint: "Visible en haut de la page Configuration de l’API.",
      placeholder: "102290129340398",
    },
    {
      key: "WHATSAPP_ACCESS_TOKEN",
      label: "Jeton d’accès permanent",
      hint: "Utilisez un jeton système longue durée, pas le jeton temporaire de 24 h.",
      placeholder: "EAAG…",
    },
    {
      key: "WHATSAPP_APP_SECRET",
      label: "App Secret",
      hint: "Paramètres de l’application › Base › App Secret. Sert à vérifier la signature des webhooks.",
      placeholder: "••••••••••",
    },
  ],
  instagram: [
    {
      key: "INSTAGRAM_APP_ID",
      label: "App ID",
      hint: "Tableau de bord de votre application Meta.",
      placeholder: "123456789012345",
    },
    {
      key: "INSTAGRAM_APP_SECRET",
      label: "App Secret",
      hint: "Paramètres de l’application › Base › App Secret.",
      placeholder: "••••••••••",
    },
    {
      key: "INSTAGRAM_ACCESS_TOKEN",
      label: "Jeton d’accès longue durée",
      hint: "Permission instagram_manage_messages requise.",
      placeholder: "EAAG…",
    },
  ],
};

export function ChannelConnector({
  provider,
  connected,
  scope,
  missing,
  reason,
  displayName,
  canManage,
  featureBlocked,
}: {
  provider: "whatsapp" | "instagram";
  connected: boolean;
  scope: "merchant" | "platform" | "none";
  missing: string[];
  reason: string | null;
  displayName: string | null;
  canManage: boolean;
  featureBlocked: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState(displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fields = FIELDS[provider] ?? [];

  const connect = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/channels/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, displayName: name || null }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        data?: { message?: string; missing?: string[] };
      };
      if (!response.ok) throw new Error(json.error?.message ?? "Connexion impossible.");

      setSuccess(json.data?.message ?? "Configuration enregistrée.");
      setValues({});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm(`Déconnecter ${provider === "whatsapp" ? "WhatsApp" : "Instagram"} ? Les identifiants seront supprimés.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/channels/${provider}`, { method: "DELETE" });
      const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Déconnexion impossible.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Déconnexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  // Canal configuré au niveau plateforme : le marchand ne peut pas le modifier.
  if (connected && scope === "platform") {
    return (
      <div className="flex items-start gap-3">
        <Badge tone="positive" dot>
          Connecté par la plateforme
        </Badge>
        <p className="flex-1 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          Ce canal est partagé. Contactez l’équipe CLOSER pour brancher votre propre
          numéro WhatsApp Business ou compte Instagram.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[#bbf7d0] bg-[var(--color-positive-soft)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Badge tone="positive" dot>
              Connecté
            </Badge>
            {displayName ? (
              <span className="text-[var(--text-sm)] text-[var(--color-ink-secondary)]">{displayName}</span>
            ) : null}
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className={`${buttonClass("danger", "sm")} cursor-pointer`}
            >
              <Unplug className="h-3.5 w-3.5" strokeWidth={1.8} />
              Déconnecter
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-2.5">
          <p className="text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
            {provider === "whatsapp" ? "WhatsApp non connecté" : "Instagram non connecté"}
          </p>
          {reason ? (
            <p className="mt-0.5 text-[var(--text-sm)] text-[var(--color-ink-muted)]">{reason}</p>
          ) : null}
          {missing.length > 0 ? (
            <p className="mt-1.5 font-mono text-[var(--text-xs)] text-[var(--color-ink-muted)]">
              Requis : {missing.join(", ")}
            </p>
          ) : null}
        </div>
      )}

      {featureBlocked ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
          La connexion de canaux nécessite un abonnement actif.
        </p>
      ) : null}

      {canManage && !featureBlocked ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] p-3.5">
          <p className="mb-3 text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
            {connected ? "Mettre à jour les identifiants" : "Renseigner les identifiants"}
          </p>

          <div className="space-y-3">
            <div>
              <label className="field-label" htmlFor={`${provider}-name`}>
                Nom affiché (facultatif)
              </label>
              <input
                id={`${provider}-name`}
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={provider === "whatsapp" ? "Boutique WhatsApp" : "Compte Instagram"}
                maxLength={160}
              />
            </div>

            {fields.map((field) => (
              <div key={field.key}>
                <label className="field-label" htmlFor={`${provider}-${field.key}`}>
                  {field.label}
                </label>
                <input
                  id={`${provider}-${field.key}`}
                  className="field font-mono text-[var(--text-xs)]"
                  type={field.key.includes("SECRET") || field.key.includes("TOKEN") ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                  }
                  placeholder={connected ? "•••• inchangé si vide" : field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="field-hint">{field.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy || Object.values(values).every((value) => !value.trim())}
              className={`${buttonClass("primary", "md")} cursor-pointer`}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" strokeWidth={1.8} />}
              {connected ? "Mettre à jour" : "Connecter"}
            </button>
            <span className="meta-label">
              Les jetons sont chiffrés avant stockage et ne sont jamais renvoyés au navigateur.
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-[var(--radius-md)] border border-[#bbf7d0] bg-[var(--color-positive-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-positive)]">
          {success}
        </p>
      ) : null}
    </div>
  );
}
