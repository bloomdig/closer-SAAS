"use client";

/** Connexion à l’administration de la plateforme CLOSER (§22). */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Connexion impossible.");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-sunken)] px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-accent)]">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h1 className="text-[var(--text-lg)] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            Administration CLOSER
          </h1>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
            Accès réservé à l’équipe de la plateforme.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]"
        >
          <div className="space-y-3.5">
            <div>
              <label className="field-label" htmlFor="admin-email">
                E-mail
              </label>
              <input
                id="admin-email"
                type="email"
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="admin-password">
                Mot de passe
              </label>
              <input
                id="admin-password"
                type="password"
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error ? (
            <p className="mt-3 rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className={`${buttonClass("primary", "md")} mt-4 w-full cursor-pointer`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Se connecter
          </button>

          <p className="meta-label mt-3 text-center">
            Les comptes marchands n’ont pas accès à cette interface.
          </p>
        </form>
      </div>
    </div>
  );
}
