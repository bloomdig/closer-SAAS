import { requireMerchantPage } from "@/lib/auth/guards";
import { countProducts, listProducts } from "@/lib/repositories";
import { PageHeader } from "@/components/ui";
import { ProductsManager, type ProductRow } from "@/components/products/ProductsManager";
import { can } from "@/lib/security/tenant";
import { DEFAULT_PLANS } from "@/lib/subscriptions/plans";

export const dynamic = "force-dynamic";

/**
 * Produits — catalogue dynamique alimentant réellement l’agent de vente (§13).
 */
export default async function ProductsPage() {
  const authed = await requireMerchantPage();
  const merchantId = authed.session.merchantId;

  const [result, used] = await Promise.all([
    listProducts(merchantId, { pageSize: 100 }),
    countProducts(merchantId),
  ]);

  const plan = DEFAULT_PLANS.find((p) => p.slug === authed.merchant.subscriptionPlan);
  const limit = plan?.limits.products ?? 30;

  const products: ProductRow[] = result.rows.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice,
    sku: product.sku,
    stock: product.stock,
    trackStock: product.trackStock,
    lowStockThreshold: product.lowStockThreshold,
    status: product.status,
    sizes: (product.sizes ?? []) as string[],
    colors: (product.colors ?? []) as string[],
    searchKeywords: (product.searchKeywords ?? []) as string[],
    images: (product.images ?? []) as string[],
    weightGrams: product.weightGrams,
  }));

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeader
        title="Produits"
        subtitle="CLOSER utilise ce catalogue pour répondre : prix, stock, tailles et coloris ne sont jamais inventés."
      />
      <ProductsManager
        products={products}
        total={result.total}
        used={used}
        limit={limit}
        canManage={can(authed.session.role, "products:manage")}
      />
    </div>
  );
}
