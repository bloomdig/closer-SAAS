/**
 * Commandes — liste filtrée/paginée + création manuelle par le marchand (§10, §11).
 * La création par l’IA passe par l’outil `create_order` (même validation serveur).
 */
import { requireMerchantApi, requireRole } from "@/lib/auth/guards";
import { createOrder, findOrCreateCustomerByPhone, listOrders, logAudit } from "@/lib/repositories";
import {
  ApiError,
  created,
  ok,
  parsePagination,
  paginationMeta,
  readJson,
  withErrorHandling,
} from "@/lib/api/respond";
import {
  arrayField,
  city as cityField,
  int,
  isRecord,
  oneOf,
  phone as phoneField,
  str,
  throwIfInvalid,
  type FieldErrors,
} from "@/lib/validation";
import { computeTotals, isOrderStatus, ORDER_STATUSES } from "@/lib/orders/status";
import { getProduct } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("orders.list", async (request: Request) => {
  const authed = await requireMerchantApi();
  const url = new URL(request.url);
  const { page, pageSize } = parsePagination(url.searchParams);

  const statusParam = url.searchParams.get("status");
  const statusFilter =
    statusParam && statusParam !== "all"
      ? (statusParam.split(",").filter((s) => isOrderStatus(s)) as (typeof ORDER_STATUSES)[number][])
      : undefined;

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const result = await listOrders(authed.session.merchantId, {
    status: statusFilter,
    search: url.searchParams.get("search") ?? undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    page,
    pageSize,
  });

  return ok(result.rows, paginationMeta({ page: result.page, pageSize: result.pageSize, total: result.total }));
});

type OrderBody = {
  customerName?: unknown;
  customerPhone?: unknown;
  city?: unknown;
  address?: unknown;
  notes?: unknown;
  paymentMethod?: unknown;
  orderStatus?: unknown;
  items?: unknown;
};

export const POST = withErrorHandling("orders.create", async (request: Request) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "orders:manage");

  const body = await readJson<OrderBody>(request);
  const errors: FieldErrors = {};

  const customerName = str(body.customerName, "customerName", { label: "Nom du client", min: 2, max: 160 }, errors);
  const customerPhone = phoneField(body.customerPhone, "customerPhone", "Téléphone du client", errors);
  const cityValue = cityField(body.city, "city", errors, false);
  const address = str(body.address, "address", { label: "Adresse", min: 5, max: 400 }, errors);
  const notes = str(body.notes, "notes", { label: "Notes", max: 500, optional: true }, errors);
  const paymentMethod = oneOf(
    body.paymentMethod,
    ["cod", "card", "bank_transfer", "wallet"] as const,
    "paymentMethod",
    "Mode de paiement",
    errors,
    { fallback: "cod" },
  );
  const orderStatus = oneOf(
    body.orderStatus,
    ORDER_STATUSES,
    "orderStatus",
    "Statut",
    errors,
    { fallback: "new" },
  );

  const items = arrayField(
    body.items,
    "items",
    "Articles",
    errors,
    (raw) => {
      if (!isRecord(raw)) return undefined;
      const productId = str(raw.productId, "productId", { label: "Produit", max: 64 }, errors);
      const quantity = int(raw.quantity, "quantity", { label: "Quantité", min: 1, max: 100 }, errors);
      if (!productId || !quantity) return undefined;
      return { productId, quantity, variant: str(raw.variant, "variant", { label: "Variante", max: 120, optional: true }, errors) ?? null };
    },
    { max: 20 },
  );

  throwIfInvalid(errors);
  if (!items || items.length === 0) {
    throw new ApiError(422, "no_items", "Ajoutez au moins un article à la commande.");
  }

  // Prix et stock réels : jamais ceux envoyés par le client.
  const lines = [];
  for (const item of items) {
    const product = await getProduct(authed.session.merchantId, item.productId);
    if (!product) {
      throw new ApiError(422, "unknown_product", `Produit ${item.productId} introuvable.`);
    }
    if (product.trackStock && product.stock < item.quantity) {
      throw new ApiError(
        409,
        "insufficient_stock",
        `Stock insuffisant pour « ${product.name} » : ${product.stock} disponible(s).`,
      );
    }
    const unitPrice = product.salePrice ?? product.price;
    lines.push({
      productId: product.id,
      name: product.name,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totals = computeTotals({ lines, deliveryFee: 0 });

  const { customer } = await findOrCreateCustomerByPhone(authed.session.merchantId, {
    phone: customerPhone!,
    name: customerName!,
    city: cityValue ?? null,
    address: address!,
  });

  const order = await createOrder(authed.session.merchantId, {
    customerId: customer.id,
    conversationId: null,
    items: lines,
    subtotal: totals.subtotal,
    deliveryFee: 0,
    discount: 0,
    total: totals.total,
    currency: "MAD",
    paymentMethod: paymentMethod as never,
    paymentStatus: "unpaid",
    orderStatus: orderStatus as never,
    customerName: customerName!,
    customerPhone: customerPhone!,
    city: cityValue ?? null,
    address: address!,
    notes: notes ?? null,
    statusHistory: [
      { from: null, to: orderStatus, by: `user:${authed.session.userId}`, at: new Date().toISOString() },
    ],
    createdByAi: false,
  });

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    metadata: { reference: order.reference, total: order.total },
  });

  return created(order);
});
