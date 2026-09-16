/** Types et libellés produits (français, §29). */
import type { products } from "@/db/schema";

export const PRODUCT_STATUSES = ["active", "draft", "archived", "out_of_stock"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS_FR: Record<ProductStatus, string> = {
  active: "Actif",
  draft: "Brouillon",
  archived: "Archivé",
  out_of_stock: "Rupture de stock",
};

/** Formate des centimes MAD en texte : 34900 → « 349 DH ». */
export function formatMad(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const value = cents / 100;
  const text = Number.isInteger(value)
    ? value.toLocaleString("fr-FR")
    : value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${text} DH`;
}

export function productIsAvailable(
  product: Pick<typeof products.$inferSelect, "status" | "trackStock" | "stock">,
): boolean {
  return product.status === "active" && (!product.trackStock || product.stock > 0);
}

export function effectivePrice(
  product: Pick<typeof products.$inferSelect, "price" | "salePrice">,
): number {
  return product.salePrice ?? product.price;
}
