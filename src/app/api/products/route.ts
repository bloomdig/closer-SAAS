/**
 * Produits — liste paginée + création (§13).
 * Chaque requête est périmétrée sur le marchand authentifié (§4).
 */
import { requireMerchantApi, requireFeatureAccess, requireRole } from "@/lib/auth/guards";
import {
  countProducts,
  createProduct,
  listProducts,
  logAudit,
} from "@/lib/repositories";
import { ApiError, created, ok, parsePagination, paginationMeta, readJson, withErrorHandling } from "@/lib/api/respond";
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
import { DEFAULT_PLANS } from "@/lib/subscriptions/plans";
import { PRODUCT_STATUSES } from "@/lib/products/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("products.list", async (request: Request) => {
  const authed = await requireMerchantApi();
  const url = new URL(request.url);
  const { page, pageSize } = parsePagination(url.searchParams);

  const result = await listProducts(authed.session.merchantId, {
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page,
    pageSize,
  });

  return ok(result.rows, paginationMeta({ page: result.page, pageSize: result.pageSize, total: result.total }));
});

type ProductBody = {
  name?: unknown;
  description?: unknown;
  price?: unknown;
  salePrice?: unknown;
  sku?: unknown;
  stock?: unknown;
  trackStock?: unknown;
  categoryId?: unknown;
  images?: unknown;
  variants?: unknown;
  sizes?: unknown;
  colors?: unknown;
  weightGrams?: unknown;
  searchKeywords?: unknown;
  status?: unknown;
};

export const POST = withErrorHandling("products.create", async (request: Request) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "products:manage");
  requireFeatureAccess(authed, "newProducts");

  // Limite d’offre appliquée côté serveur, jamais dans l’interface seule.
  const plan = DEFAULT_PLANS.find((p) => p.slug === authed.merchant.subscriptionPlan);
  const limit = plan?.limits.products ?? 30;
  const current = await countProducts(authed.session.merchantId);
  if (current >= limit) {
    throw new ApiError(
      402,
      "product_limit_reached",
      `Votre offre ${plan?.name ?? ""} permet ${limit} produits. Passez à l’offre supérieure pour en ajouter.`,
    );
  }

  const body = await readJson<ProductBody>(request);
  const errors: FieldErrors = {};

  const name = str(body.name, "name", { label: "Nom du produit", min: 2, max: 200 }, errors);
  const description = str(body.description, "description", { label: "Description", max: 5000, optional: true }, errors);
  const price = madAmount(body.price, "price", "Prix", errors);
  const salePrice = madAmount(body.salePrice, "salePrice", "Prix promotionnel", errors, { optional: true });
  const sku = str(body.sku, "sku", { label: "SKU", max: 64, optional: true }, errors);
  const stock = int(body.stock, "stock", { label: "Stock", min: 0, max: 1_000_000, fallback: 0 }, errors);
  const categoryId = str(body.categoryId, "categoryId", { label: "Catégorie", max: 64, optional: true }, errors);
  const weightGrams = int(body.weightGrams, "weightGrams", { label: "Poids", min: 0, max: 100000, optional: true }, errors);
  const status = oneOf(body.status, PRODUCT_STATUSES, "status", "Statut", errors, { fallback: "active" });

  const images = arrayField(
    body.images,
    "images",
    "Images",
    errors,
    (raw) => (typeof raw === "string" && raw.length > 0 ? raw : undefined),
    { max: 10, optional: true },
  );
  const sizes = arrayField(
    body.sizes,
    "sizes",
    "Tailles",
    errors,
    (raw) => str(raw, "size", { label: "Taille", max: 40 }, {}),
    { max: 30, optional: true },
  );
  const colors = arrayField(
    body.colors,
    "colors",
    "Coloris",
    errors,
    (raw) => str(raw, "color", { label: "Coloris", max: 40 }, {}),
    { max: 30, optional: true },
  );
  const searchKeywords = arrayField(
    body.searchKeywords,
    "searchKeywords",
    "Mots-clés",
    errors,
    (raw) => str(raw, "keyword", { label: "Mot-clé", max: 60 }, {}),
    { max: 40, optional: true },
  );
  const variants = arrayField(
    body.variants,
    "variants",
    "Variantes",
    errors,
    (raw) => (isRecord(raw) ? (raw as Record<string, unknown>) : undefined),
    { max: 10, optional: true },
  );

  throwIfInvalid(errors);

  if (salePrice !== undefined && price !== undefined && salePrice >= price) {
    throw new ApiError(422, "invalid_sale_price", "Le prix promotionnel doit être inférieur au prix normal.");
  }

  const trackStock = bool(body.trackStock, true);
  const effectiveStatus =
    trackStock && (stock ?? 0) === 0 && status === "active" ? "out_of_stock" : status;

  const product = await createProduct(authed.session.merchantId, {
    name: name!,
    description: description ?? null,
    price: price!,
    salePrice: salePrice ?? null,
    sku: sku ?? null,
    stock: stock ?? 0,
    trackStock,
    lowStockThreshold: 5,
    categoryId: categoryId ?? null,
    images: images ?? [],
    variants: variants ?? [],
    sizes: sizes ?? [],
    colors: colors ?? [],
    weightGrams: weightGrams ?? null,
    searchKeywords: searchKeywords ?? [],
    status: (effectiveStatus ?? "active") as never,
  });

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "product.create",
    entityType: "product",
    entityId: product.id,
  });

  return created(product);
});
