"use client";

/**
 * Gestion du catalogue (§13).
 * Remplace le tableau statique du prototype : création, modification,
 * suppression, activation, rupture de stock — le tout contre l’API réelle.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Search } from "lucide-react";
import { Badge, EmptyState, Money, Panel } from "@/components/ui";
import { ProductForm, type ProductFormValues } from "./ProductForm";
import { PRODUCT_STATUS_FR, PRODUCT_STATUS_TONE } from "@/lib/format";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  salePrice: number | null;
  sku: string | null;
  stock: number;
  trackStock: boolean;
  lowStockThreshold: number;
  status: string;
  sizes: string[];
  colors: string[];
  searchKeywords: string[];
  images: string[];
  weightGrams: number | null;
};

export function ProductsManager({
  products,
  total,
  canManage,
  limit,
  used,
}: {
  products: ProductRow[];
  total: number;
  canManage: boolean;
  limit: number;
  used: number;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  // Incrémenté à chaque ouverture : force le remontage du formulaire (état neuf).
  const [formNonce, setFormNonce] = useState(0);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    if (used >= limit) {
      setError(
        `Limite atteinte : votre offre permet ${limit} produits. Passez à l’offre supérieure pour en ajouter.`,
      );
      return;
    }
    setEditing(null);
    setFormNonce((n) => n + 1);
    setFormOpen(true);
  };

  const openEdit = (product: ProductRow) => {
    setError(null);
    setEditing({
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      price: String(product.price / 100),
      salePrice: product.salePrice ? String(product.salePrice / 100) : "",
      sku: product.sku ?? "",
      stock: String(product.stock),
      trackStock: product.trackStock,
      status: product.status,
      sizes: (product.sizes ?? []).join(", "),
      colors: (product.colors ?? []).join(", "),
      searchKeywords: (product.searchKeywords ?? []).join(", "),
      images: (product.images ?? []).join(", "),
      weightGrams: product.weightGrams ? String(product.weightGrams) : "",
    });
    setFormNonce((n) => n + 1);
    setFormOpen(true);
  };

  const toggleAvailability = async (product: ProductRow) => {
    setBusyId(product.id);
    setError(null);
    try {
      const next = product.status === "active" ? "draft" : "active";
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(json.error?.message ?? "Modification impossible.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = query.trim()
    ? products.filter((product) =>
        `${product.name} ${product.sku ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : products;

  return (
    <>
      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[var(--color-ink-faint)]"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un produit…"
            className="field h-8 pl-8 text-[var(--text-sm)]"
            aria-label="Rechercher un produit"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="meta-label">
            {used} / {limit} produits
          </span>
          {canManage ? (
            <button type="button" onClick={openCreate} className="btn btn-primary btn-sm cursor-pointer">
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Ajouter un produit
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}

      <Panel flush>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="h-4 w-4" strokeWidth={1.8} />}
            title={products.length === 0 ? "Votre catalogue est vide" : "Aucun produit ne correspond"}
            description={
              products.length === 0
                ? "Ajoutez vos produits pour que CLOSER puisse les recommander, en indiquer le prix réel et vérifier le stock."
                : "Modifiez votre recherche."
            }
            action={
              products.length === 0 && canManage ? (
                <button type="button" onClick={openCreate} className="btn btn-primary btn-sm cursor-pointer">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  Ajouter un produit
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="table-numeric">Prix</th>
                  <th className="table-numeric">Stock</th>
                  <th>Options</th>
                  <th>Statut</th>
                  {canManage ? <th className="text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <span className="block font-medium text-[var(--color-ink)]">{product.name}</span>
                      {product.sku ? (
                        <span className="meta-label block font-mono">{product.sku}</span>
                      ) : null}
                    </td>
                    <td className="table-numeric">
                      {product.salePrice !== null && product.salePrice < product.price ? (
                        <>
                          <Money cents={product.salePrice} className="font-medium text-[var(--color-ink)]" />
                          <span className="meta-label ml-1.5 line-through">
                            {(product.price / 100).toLocaleString("fr-FR")} DH
                          </span>
                        </>
                      ) : (
                        <Money cents={product.price} className="font-medium text-[var(--color-ink)]" />
                      )}
                    </td>
                    <td className="table-numeric">
                      {product.trackStock ? (
                        product.stock === 0 ? (
                          <Badge tone="warning">Rupture</Badge>
                        ) : product.stock <= product.lowStockThreshold ? (
                          <span className="text-[var(--color-warning)]">{product.stock}</span>
                        ) : (
                          product.stock
                        )
                      ) : (
                        <span className="meta-label">Non suivi</span>
                      )}
                    </td>
                    <td className="meta-label">
                      {product.sizes?.length ? product.sizes.join(", ") : "—"}
                      {product.colors?.length ? (
                        <span className="block">{product.colors.join(", ")}</span>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={PRODUCT_STATUS_TONE[product.status] ?? "neutral"}>
                        {PRODUCT_STATUS_FR[product.status] ?? product.status}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleAvailability(product)}
                          disabled={busyId === product.id}
                          className="btn btn-ghost btn-sm cursor-pointer disabled:opacity-50"
                        >
                          {product.status === "active" ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="btn btn-ghost btn-sm cursor-pointer"
                        >
                          Modifier
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-2 flex items-center justify-between">
        <span className="meta-label">{total} produit{total > 1 ? "s" : ""} au total</span>
      </div>

      <ProductForm
        key={`${formOpen ? "open" : "closed"}-${editing?.id ?? "new"}-${formNonce}`}
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
      />
    </>
  );
}
