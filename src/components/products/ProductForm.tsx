"use client";

/**
 * Formulaire produit — création et modification (§13).
 * Remplace le bouton « Ajouter un produit » qui pointait vers `href="#"`.
 * Les prix sont saisis en DH et convertis en centimes côté serveur.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { PRODUCT_STATUS_FR } from "@/lib/format";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  price: string;
  salePrice: string;
  sku: string;
  stock: string;
  trackStock: boolean;
  status: string;
  sizes: string;
  colors: string;
  searchKeywords: string;
  images: string;
  weightGrams: string;
};

const EMPTY: ProductFormValues = {
  name: "",
  description: "",
  price: "",
  salePrice: "",
  sku: "",
  stock: "0",
  trackStock: true,
  status: "active",
  sizes: "",
  colors: "",
  searchKeywords: "",
  images: "",
  weightGrams: "",
};

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProductForm({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: ProductFormValues | null;
  onClose: () => void;
}) {
  const router = useRouter();
  // Le parent remonte ce formulaire avec une `key` à chaque ouverture :
  // l’état initial vient donc directement du montage, sans effet.
  const [values, setValues] = useState<ProductFormValues>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  const set = (key: keyof ProductFormValues, value: string | boolean) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const isEdit = Boolean(values.id);
    const payload: Record<string, unknown> = {
      name: values.name,
      description: values.description || null,
      price: values.price,
      salePrice: values.salePrice || null,
      sku: values.sku || null,
      stock: Number(values.stock || 0),
      trackStock: values.trackStock,
      status: values.status,
      sizes: splitList(values.sizes),
      colors: splitList(values.colors),
      searchKeywords: splitList(values.searchKeywords),
      images: splitList(values.images),
      weightGrams: values.weightGrams ? Number(values.weightGrams) : null,
    };

    try {
      const response = await fetch(
        isEdit ? `/api/products/${values.id}` : "/api/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; details?: Record<string, string> };
      };

      if (!response.ok) {
        if (json.error?.details) setFieldErrors(json.error.details);
        throw new Error(json.error?.message ?? "Enregistrement impossible.");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!values.id) return;
    if (!window.confirm(`Supprimer « ${values.name} » ? Cette action est définitive.`)) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${values.id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "Suppression impossible.");
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-canvas)] sm:max-w-[560px] sm:rounded-[var(--radius-lg)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <h2 className="section-title">{values.id ? "Modifier le produit" : "Nouveau produit"}</h2>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3.5">
            <Field label="Nom du produit" error={fieldErrors.name} required>
              <input
                className="field"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Robe Noire Élégante"
                required
                maxLength={200}
              />
            </Field>

            <Field label="Description" error={fieldErrors.description} hint="Utilisée par CLOSER pour répondre aux questions clients.">
              <textarea
                className="field field-area"
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Matière, coupe, occasions…"
                rows={3}
              />
            </Field>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Prix (DH)" error={fieldErrors.price} required>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="349"
                  required
                />
              </Field>
              <Field label="Prix promotionnel (DH)" error={fieldErrors.salePrice} hint="Laisser vide si aucune promotion.">
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.salePrice}
                  onChange={(e) => set("salePrice", e.target.value)}
                  placeholder="299"
                />
              </Field>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label="Stock" error={fieldErrors.stock}>
                <input
                  className="field"
                  type="number"
                  min="0"
                  value={values.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  disabled={!values.trackStock}
                />
              </Field>
              <Field label="SKU / référence" error={fieldErrors.sku}>
                <input
                  className="field"
                  value={values.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="FM-001"
                />
              </Field>
              <Field label="Statut" error={fieldErrors.status}>
                <select
                  className="field"
                  value={values.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {Object.entries(PRODUCT_STATUS_FR).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
              <input
                type="checkbox"
                className="accent-[var(--color-accent)]"
                checked={values.trackStock}
                onChange={(e) => set("trackStock", e.target.checked)}
              />
              Suivre le stock (passage automatique en rupture à 0)
            </label>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Tailles" hint="Séparées par des virgules">
                <input
                  className="field"
                  value={values.sizes}
                  onChange={(e) => set("sizes", e.target.value)}
                  placeholder="S, M, L, XL"
                />
              </Field>
              <Field label="Coloris" hint="Séparés par des virgules">
                <input
                  className="field"
                  value={values.colors}
                  onChange={(e) => set("colors", e.target.value)}
                  placeholder="Noir, Bordeaux"
                />
              </Field>
            </div>

            <Field
              label="Mots-clés de recherche"
              hint="Ajoutez les termes en darija et en arabe que vos clients emploient : cela améliore les réponses de CLOSER."
            >
              <input
                className="field"
                value={values.searchKeywords}
                onChange={(e) => set("searchKeywords", e.target.value)}
                placeholder="robe, soria, فستان"
              />
            </Field>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="URL des images" hint="Une par ligne ou séparées par des virgules">
                <input
                  className="field"
                  value={values.images}
                  onChange={(e) => set("images", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Poids (grammes)">
                <input
                  className="field"
                  type="number"
                  min="0"
                  value={values.weightGrams}
                  onChange={(e) => set("weightGrams", e.target.value)}
                  placeholder="350"
                />
              </Field>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
              {error}
            </p>
          ) : null}
        </form>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--color-line)] px-4 py-3">
          {values.id ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              className={`${buttonClass("danger", "md")} cursor-pointer`}
            >
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className={`${buttonClass("secondary", "md")} cursor-pointer`}>
              Annuler
            </button>
            <button
              type="submit"
              onClick={submit}
              disabled={saving}
              className={`${buttonClass("primary", "md")} cursor-pointer`}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {values.id ? "Enregistrer" : "Créer le produit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
        {required ? <span className="text-[var(--color-accent)]"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field-error">{error}</p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}
