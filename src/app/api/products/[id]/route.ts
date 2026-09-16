/** Produits — lecture, modification, suppression (§13). */
import { requireMerchantApi, requireRole } from "@/lib/auth/guards";
import { deleteProduct, getProduct, logAudit, updateProduct } from "@/lib/repositories";
import { ApiError, notFound, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import {
  arrayField,
  bool,
  int,
  isRecord,
  madAmount,
  oneOf,
  str,
  throwIfInvalid,
  type FieldErrors,
} from "@/lib/validation";
import { PRODUCT_STATUSES, productIsAvailable } from "@/lib/products/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling("products.get", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const product = await getProduct(authed.session.merchantId, id);
  if (!product) throw notFound("Produit introuvable.");

  return ok({ ...product, available: productIsAvailable(product) });
});

export const PATCH = withErrorHandling("products.update", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "products:manage");
  const { id } = await ctx.params;

  const existing = await getProduct(authed.session.merchantId, id);
  if (!existing) throw notFound("Produit introuvable.");

  const body = await readJson<Record<string, unknown>>(request);
  const errors: FieldErrors = {};
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) patch.name = str(body.name, "name", { label: "Nom du produit", min: 2, max: 200 }, errors);
  if (body.description !== undefined) patch.description = str(body.description, "description", { label: "Description", max: 5000, optional: true }, errors) ?? null;
  if (body.price !== undefined) patch.price = madAmount(body.price, "price", "Prix", errors);
  if (body.salePrice !== undefined) patch.salePrice = madAmount(body.salePrice, "salePrice", "Prix promotionnel", errors, { optional: true }) ?? null;
  if (body.sku !== undefined) patch.sku = str(body.sku, "sku", { label: "SKU", max: 64, optional: true }, errors) ?? null;
  if (body.stock !== undefined) patch.stock = int(body.stock, "stock", { label: "Stock", min: 0, max: 1_000_000 }, errors);
  if (body.trackStock !== undefined) patch.trackStock = bool(body.trackStock);
  if (body.categoryId !== undefined) patch.categoryId = str(body.categoryId, "categoryId", { label: "Catégorie", max: 64, optional: true }, errors) ?? null;
  if (body.weightGrams !== undefined) patch.weightGrams = int(body.weightGrams, "weightGrams", { label: "Poids", min: 0, max: 100000, optional: true }, errors) ?? null;
  if (body.status !== undefined) patch.status = oneOf(body.status, PRODUCT_STATUSES, "status", "Statut", errors);

  if (body.images !== undefined) {
    patch.images = arrayField(body.images, "images", "Images", errors, (raw) => (typeof raw === "string" && raw ? raw : undefined), { max: 10 }) ?? [];
  }
  if (body.sizes !== undefined) {
    patch.sizes = arrayField(body.sizes, "sizes", "Tailles", errors, (raw) => str(raw, "size", { label: "Taille", max: 40 }, {}), { max: 30 }) ?? [];
  }
  if (body.colors !== undefined) {
    patch.colors = arrayField(body.colors, "colors", "Coloris", errors, (raw) => str(raw, "color", { label: "Coloris", max: 40 }, {}), { max: 30 }) ?? [];
  }
  if (body.searchKeywords !== undefined) {
    patch.searchKeywords = arrayField(body.searchKeywords, "searchKeywords", "Mots-clés", errors, (raw) => str(raw, "keyword", { label: "Mot-clé", max: 60 }, {}), { max: 40 }) ?? [];
  }
  if (body.variants !== undefined) {
    patch.variants = arrayField(body.variants, "variants", "Variantes", errors, (raw) => (isRecord(raw) ? raw : undefined), { max: 10 }) ?? [];
  }

  throwIfInvalid(errors);
  if (Object.keys(patch).length === 0) {
    throw new ApiError(422, "no_changes", "Aucune modification à enregistrer.");
  }

  const nextPrice = (patch.price as number | undefined) ?? existing.price;
  const nextSale = (patch.salePrice as number | undefined | null) ?? existing.salePrice;
  if (nextSale !== null && nextSale !== undefined && nextSale >= nextPrice) {
    throw new ApiError(422, "invalid_sale_price", "Le prix promotionnel doit être inférieur au prix normal.");
  }

  // Un produit actif sans stock passe automatiquement en rupture.
  const nextStock = (patch.stock as number | undefined) ?? existing.stock;
  const nextTrack = (patch.trackStock as boolean | undefined) ?? existing.trackStock;
  const nextStatus = (patch.status as string | undefined) ?? existing.status;
  if (nextStatus === "active" && nextTrack && nextStock === 0) {
    patch.status = "out_of_stock";
  } else if (nextStatus === "out_of_stock" && (!nextTrack || nextStock > 0)) {
    patch.status = "active";
  }

  const updated = await updateProduct(authed.session.merchantId, id, patch);

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "product.update",
    entityType: "product",
    entityId: id,
    metadata: { fields: Object.keys(patch) },
  });

  return ok(updated);
});

export const DELETE = withErrorHandling("products.delete", async (_request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "products:manage");
  const { id } = await ctx.params;

  const deleted = await deleteProduct(authed.session.merchantId, id);
  if (!deleted) throw notFound("Produit introuvable.");

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "product.delete",
    entityType: "product",
    entityId: id,
  });

  return ok({ deleted: true });
});
