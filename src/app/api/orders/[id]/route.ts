/**
 * Commande — détail, modification et transition de statut (§11).
 * Les transitions invalides sont refusées par la machine à états côté serveur.
 */
import { requireMerchantApi, requireRole } from "@/lib/auth/guards";
import {
  appendOrderStatusHistory,
  getCustomer,
  getOrder,
  logAudit,
  updateOrder,
} from "@/lib/repositories";
import { ApiError, notFound, ok, readJson, withErrorHandling } from "@/lib/api/respond";
import { city as cityField, phone as phoneField, str, throwIfInvalid, type FieldErrors } from "@/lib/validation";
import {
  allowedTransitions,
  assertTransition,
  isOrderStatus,
  ORDER_STATUSES,
} from "@/lib/orders/status";
import { computeTotals, type OrderLine } from "@/lib/orders/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling("orders.get", async (_request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;

  const order = await getOrder(authed.session.merchantId, id);
  if (!order) throw notFound("Commande introuvable.");

  const customer = order.customerId
    ? await getCustomer(authed.session.merchantId, order.customerId)
    : null;

  return ok({
    ...order,
    customer,
    allowedTransitions: allowedTransitions(order.orderStatus),
  });
});

export const PATCH = withErrorHandling("orders.update", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "orders:manage");
  const { id } = await ctx.params;

  const order = await getOrder(authed.session.merchantId, id);
  if (!order) throw notFound("Commande introuvable.");

  const body = await readJson<Record<string, unknown>>(request);
  const errors: FieldErrors = {};
  const patch: Record<string, unknown> = {};

  if (body.customerName !== undefined) patch.customerName = str(body.customerName, "customerName", { label: "Nom du client", min: 2, max: 160 }, errors);
  if (body.customerPhone !== undefined) patch.customerPhone = phoneField(body.customerPhone, "customerPhone", "Téléphone", errors);
  if (body.city !== undefined) patch.city = cityField(body.city, "city", errors);
  if (body.address !== undefined) patch.address = str(body.address, "address", { label: "Adresse", min: 5, max: 400 }, errors);
  if (body.notes !== undefined) patch.notes = str(body.notes, "notes", { label: "Notes", max: 500, optional: true }, errors) ?? null;
  if (body.deliveryFee !== undefined) {
    const fee = Number(body.deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) errors.deliveryFee = "Frais de livraison invalides.";
    else patch.deliveryFee = Math.round(fee);
  }

  throwIfInvalid(errors);

  // Transition de statut
  const nextStatus = body.orderStatus;
  let transitioned = false;
  if (nextStatus !== undefined) {
    if (!isOrderStatus(nextStatus)) {
      throw new ApiError(422, "invalid_status", `Statut invalide. Valeurs possibles : ${ORDER_STATUSES.join(", ")}.`);
    }
    assertTransition(order.orderStatus, nextStatus);

    patch.orderStatus = nextStatus;
    transitioned = true;

    if (nextStatus === "confirmed") {
      patch.confirmedAt = new Date();
      if (order.paymentMethod === "cod") patch.paymentStatus = "pending";
    }
    if (nextStatus === "delivered") {
      patch.deliveredAt = new Date();
      patch.paymentStatus = order.paymentMethod === "cod" ? "paid" : order.paymentStatus;
    }
    if (nextStatus === "cancelled" || nextStatus === "refused") {
      patch.cancelledAt = new Date();
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new ApiError(422, "no_changes", "Aucune modification à enregistrer.");
  }

  // Recalcule le total si les frais de livraison changent.
  if (patch.deliveryFee !== undefined) {
    const totals = computeTotals({
      lines: (order.items as OrderLine[]).map((l) => ({ ...l, lineTotal: l.unitPrice * l.quantity })),
      deliveryFee: patch.deliveryFee as number,
      discount: order.discount,
    });
    patch.subtotal = totals.subtotal;
    patch.total = totals.total;
  }

  const updated = await updateOrder(authed.session.merchantId, id, patch);

  if (transitioned) {
    await appendOrderStatusHistory(authed.session.merchantId, id, {
      from: order.orderStatus,
      to: String(patch.orderStatus),
      by: `user:${authed.session.userId}`,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 280) : null,
    });
  }

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: transitioned ? "order.status_change" : "order.update",
    entityType: "order",
    entityId: id,
    metadata: transitioned
      ? { from: order.orderStatus, to: patch.orderStatus, reference: order.reference }
      : { fields: Object.keys(patch) },
  });

  return ok({ ...updated, allowedTransitions: allowedTransitions(updated?.orderStatus ?? order.orderStatus) });
});
