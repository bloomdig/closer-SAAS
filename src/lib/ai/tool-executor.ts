/**
 * Exécuteur des outils de l’agent de vente (§9, §10).
 * =====================================================================
 * Le modèle propose, le serveur dispose. Chaque action est :
 *   1. validée (types, bornes, format marocain),
 *   2. exécutée avec un `merchantId` qui vient de la SESSION serveur
 *      — jamais de la sortie du modèle (§4, §33),
 *   3. bornée par `TOOL_LIMITS`.
 *
 * Aucune écriture directe du modèle en base.
 */
import {
  TOOL_LIMITS,
  asInt,
  asString,
  isRecord,
  matchMoroccanCity,
  normalizeMoroccanPhone,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from "./tools";
import {
  computeTotals,
  generateOrderReference,
  type OrderLine,
} from "@/lib/orders/status";
import * as repo from "@/lib/repositories";
import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { conversations, customers, products } from "@/db/schema";
import { formatMad } from "./system-prompt";

const fail = (error: string): ToolExecutionResult => ({ ok: false, error });

type ItemInput = { productId: string; quantity: number; variant?: string | null };

/** Valide la liste d’articles et résout prix/stock réels depuis la base. */
async function resolveItems(
  merchantId: string,
  raw: unknown,
): Promise<
  | { ok: true; lines: OrderLine[]; products: typeof products.$inferSelect[] }
  | { ok: false; error: string }
> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Aucun article fourni." };
  }
  if (raw.length > TOOL_LIMITS.maxOrderItems) {
    return {
      ok: false,
      error: `Maximum ${TOOL_LIMITS.maxOrderItems} articles par commande.`,
    };
  }

  const lines: OrderLine[] = [];
  const resolved: (typeof products.$inferSelect)[] = [];

  for (const entry of raw) {
    if (!isRecord(entry)) return { ok: false, error: "Article invalide." };

    const productId = asString(entry.productId, "productId", 64);
    if (!productId) {
      return { ok: false, error: "Identifiant produit manquant." };
    }

    const quantity = asInt(
      entry.quantity,
      "quantity",
      1,
      TOOL_LIMITS.maxQuantityPerItem,
    );
    if (quantity === null) {
      return {
        ok: false,
        error: `Quantité invalide (1 à ${TOOL_LIMITS.maxQuantityPerItem}).`,
      };
    }

    const product = await repo.getProduct(merchantId, productId);
    if (!product) {
      return { ok: false, error: `Produit ${productId} introuvable.` };
    }
    if (product.status !== "active") {
      return {
        ok: false,
        error: `« ${product.name} » n’est pas disponible à la vente.`,
      };
    }
    if (product.trackStock && product.stock < quantity) {
      return {
        ok: false,
        error: `Stock insuffisant pour « ${product.name} » : ${product.stock} disponible(s).`,
      };
    }

    const unitPrice = product.salePrice ?? product.price;
    const variant = asString(entry.variant, "variant", 120);

    lines.push({
      productId: product.id,
      name: product.name,
      variant,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    });
    resolved.push(product);
  }

  return { ok: true, lines, products: resolved };
}

/** Frais de livraison depuis les zones configurées par le marchand. */
function resolveDeliveryFee(
  settings: Awaited<ReturnType<typeof repo.getSettings>>,
  city: string | null,
  subtotalCents: number,
): number {
  if (!settings) return 0;

  const threshold = settings.freeShippingThreshold;
  if (threshold && subtotalCents >= threshold) return 0;

  const zones = (settings.deliveryZones ?? []) as {
    city?: string;
    fee?: number;
    enabled?: boolean;
  }[];

  if (city && Array.isArray(zones)) {
    const target = city
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    for (const zone of zones) {
      if (!zone?.city || zone.enabled === false) continue;
      const candidate = zone.city
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (candidate === target || target.startsWith(candidate)) {
        return typeof zone.fee === "number" ? Math.max(0, Math.round(zone.fee)) : 0;
      }
    }
  }

  return Math.max(0, settings.deliveryFeeDefault ?? 0);
}

/* ------------------------------------------------------------------ */
/* Exécuteur                                                           */
/* ------------------------------------------------------------------ */

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const merchantId = ctx.merchantId;

  switch (name) {
    /* ------------------------- catalogue ------------------------- */
    case "search_products": {
      const query = asString(args.query, "query", 120) ?? "";
      const limit = asInt(args.limit, "limit", 1, TOOL_LIMITS.maxSearchResults) ?? 5;
      const maxPriceMad =
        typeof args.maxPrice === "number" || typeof args.maxPrice === "string"
          ? asInt(args.maxPrice, "maxPrice", 0, 1_000_000)
          : null;

      const { rows } = await repo.listProducts(merchantId, {
        search: query || undefined,
        status: args.inStockOnly === true ? "active" : undefined,
        pageSize: limit,
      });

      const filtered = rows
        .filter((p) => (maxPriceMad ? (p.salePrice ?? p.price) <= maxPriceMad * 100 : true))
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: formatMad(p.salePrice ?? p.price),
          available: p.status === "active" && (!p.trackStock || p.stock > 0),
          stock: p.trackStock ? p.stock : null,
          category: p.categoryId,
          sizes: p.sizes,
          colors: p.colors,
        }));

      return {
        ok: true,
        data: {
          count: filtered.length,
          products: filtered,
          note:
            filtered.length === 0
              ? "Aucun produit ne correspond. Ne rien inventer : proposer de vérifier."
              : undefined,
        },
      };
    }

    case "get_product_details": {
      const productId = asString(args.productId, "productId", 64);
      if (!productId) return fail("productId requis.");

      const product = await repo.getProduct(merchantId, productId);
      if (!product) return fail("Produit introuvable dans ce catalogue.");

      return {
        ok: true,
        data: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: formatMad(product.salePrice ?? product.price),
          salePrice: product.salePrice ? formatMad(product.salePrice) : null,
          regularPrice: formatMad(product.price),
          stock: product.trackStock ? product.stock : null,
          available: product.status === "active" && (!product.trackStock || product.stock > 0),
          sizes: product.sizes,
          colors: product.colors,
          variants: product.variants,
          weightGrams: product.weightGrams,
          sku: product.sku,
        },
      };
    }

    case "check_product_stock": {
      const productId = asString(args.productId, "productId", 64);
      if (!productId) return fail("productId requis.");

      const product = await repo.getProduct(merchantId, productId);
      if (!product) return fail("Produit introuvable dans ce catalogue.");

      const requested = asInt(args.quantity, "quantity", 1, TOOL_LIMITS.maxQuantityPerItem) ?? 1;
      const stock = product.trackStock ? product.stock : null;
      const size = asString(args.size, "size", 40);
      const color = asString(args.color, "color", 40);

      // Les variantes sont stockées en jsonb : on vérifie leur existence,
      // jamais leur stock individuel (non géré) → on le signale honnêtement.
      const sizes = (product.sizes ?? []) as string[];
      const colors = (product.colors ?? []) as string[];
      const sizeKnown = size ? sizes.some((s) => s.toLowerCase() === size.toLowerCase()) : null;
      const colorKnown = color
        ? colors.some((c) => c.toLowerCase() === color.toLowerCase())
        : null;

      return {
        ok: true,
        data: {
          name: product.name,
          inStock: product.status === "active" && (stock === null || stock >= requested),
          stock,
          requested,
          availableSizes: sizes,
          availableColors: colors,
          sizeRequested: size,
          sizeExists: sizeKnown,
          colorRequested: color,
          colorExists: colorKnown,
          note:
            sizeKnown === false
              ? `Taille ${size} non référencée pour ce produit.`
              : colorKnown === false
                ? `Coloris ${color} non référencé pour ce produit.`
                : stock !== null && stock < requested
                  ? `Seulement ${stock} pièce(s) disponible(s).`
                  : undefined,
        },
      };
    }

    /* ------------------------- totaux ------------------------- */
    case "calculate_order_total": {
      const items = await resolveItems(merchantId, args.items);
      if (!items.ok) return fail(items.error);

      const cityRaw = asString(args.city, "city", 120);
      const city = cityRaw ? matchMoroccanCity(cityRaw) : null;
      const settings = await repo.getSettings(merchantId);

      const subtotal = items.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const promoCode = asString(args.promoCode, "promoCode", 40);

      // Une remise n’est appliquée que si elle existe réellement dans les
      // promotions configurées — jamais inventée (§8).
      let discount = 0;
      let appliedPromotion: string | null = null;
      const promotions = ((settings?.promotions ?? []) as {
        code?: string;
        title?: string;
        active?: boolean;
        discountCents?: number;
      }[]).filter((p) => p.active !== false);

      if (promoCode) {
        const found = promotions.find(
          (p) => (p.code ?? "").toLowerCase() === promoCode.toLowerCase(),
        );
        if (found) {
          discount = Math.max(0, Math.round(found.discountCents ?? 0));
          appliedPromotion = found.title ?? found.code ?? null;
        }
      }

      const deliveryFee = resolveDeliveryFee(settings, city, subtotal);
      const totals = computeTotals({ lines: items.lines, deliveryFee, discount });

      return {
        ok: true,
        data: {
          lines: items.lines.map((l) => ({
            name: l.name,
            variant: l.variant,
            quantity: l.quantity,
            unitPrice: formatMad(l.unitPrice),
            lineTotal: formatMad(l.lineTotal),
          })),
          subtotal: formatMad(totals.subtotal),
          deliveryFee: formatMad(totals.deliveryFee),
          discount: formatMad(totals.discount),
          total: formatMad(totals.total),
          totalCents: totals.total,
          currency: totals.currency,
          city: city ?? cityRaw ?? null,
          cityDeliverable: city !== null,
          promoApplied: appliedPromotion,
          paymentMethod: settings?.defaultPaymentMethod ?? "cod",
          deliveryEtaDays:
            settings?.deliveryEtaDaysMin && settings?.deliveryEtaDaysMax
              ? `${settings.deliveryEtaDaysMin}-${settings.deliveryEtaDaysMax}`
              : null,
          note:
            promoCode && !appliedPromotion
              ? `Le code ${promoCode} n’existe pas. Ne pas appliquer de remise.`
              : undefined,
        },
      };
    }

    /* ------------------------- clients ------------------------- */
    case "create_customer": {
      const phone = normalizeMoroccanPhone(args.phone);
      if (!phone) {
        return fail("Numéro de téléphone marocain invalide. Demandez-le au format 06XXXXXXXX.");
      }

      const name = asString(args.name, "name", TOOL_LIMITS.maxCustomerNameLength);
      const city = asString(args.city, "city", 120);
      const address = asString(args.address, "address", 400);
      const notes = asString(args.notes, "notes", TOOL_LIMITS.maxNoteLength);

      const { customer, created } = await repo.findOrCreateCustomerByPhone(merchantId, {
        phone,
        name,
        city: city ? matchMoroccanCity(city) : null,
        address,
        notes,
      });

      // Rattache le client à la conversation en cours.
      if (ctx.conversationId && created) {
        await db
          .update(conversations)
          .set({ customerId: customer.id })
          .where(
            and(
              eq(conversations.id, ctx.conversationId),
              eq(conversations.merchantId, merchantId),
            ),
          );
      }

      return {
        ok: true,
        data: {
          customerId: customer.id,
          name: customer.name,
          phone: customer.phone,
          city: customer.city,
          created,
          ordersCount: customer.ordersCount,
        },
      };
    }

    case "update_customer": {
      const customerId = asString(args.customerId, "customerId", 64) ?? ctx.customerId;
      if (!customerId) return fail("customerId requis.");

      const existing = await repo.getCustomer(merchantId, customerId);
      if (!existing) return fail("Client introuvable pour cette boutique.");

      const patch: Record<string, unknown> = {};
      const name = asString(args.name, "name", TOOL_LIMITS.maxCustomerNameLength);
      const city = asString(args.city, "city", 120);
      const address = asString(args.address, "address", 400);
      const notes = asString(args.notes, "notes", TOOL_LIMITS.maxNoteLength);
      const phone = args.phone !== undefined ? normalizeMoroccanPhone(args.phone) : null;

      if (name) patch.name = name;
      if (city) patch.city = matchMoroccanCity(city);
      if (address) patch.address = address;
      if (notes) patch.notes = notes;
      if (phone) patch.phone = phone;

      if (Object.keys(patch).length === 0) {
        return fail("Aucune information à mettre à jour.");
      }

      const customer = await repo.updateCustomer(merchantId, customerId, patch);
      return {
        ok: true,
        data: {
          customerId: customer?.id,
          updated: Object.keys(patch),
          phone: customer?.phone ?? null,
          city: customer?.city ?? null,
        },
      };
    }

    /* ------------------------- commandes ------------------------- */
    case "create_order": {
      const items = await resolveItems(merchantId, args.items);
      if (!items.ok) return fail(items.error);

      const customerName = asString(
        args.customerName,
        "customerName",
        TOOL_LIMITS.maxCustomerNameLength,
      );
      const phone = normalizeMoroccanPhone(args.customerPhone);
      const cityRaw = asString(args.city, "city", 120);
      const address = asString(args.address, "address", 400);

      if (!customerName) return fail("Nom complet du client requis avant de créer la commande.");
      if (!phone) return fail("Téléphone marocain valide requis (06XXXXXXXX).");
      if (!cityRaw) return fail("Ville de livraison requise.");
      if (!address) return fail("Adresse de livraison requise.");

      const city = matchMoroccanCity(cityRaw) ?? cityRaw;
      const settings = await repo.getSettings(merchantId);
      const subtotal = items.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const deliveryFee = resolveDeliveryFee(settings, city, subtotal);
      const totals = computeTotals({ lines: items.lines, deliveryFee });

      if (totals.total > TOOL_LIMITS.maxOrderTotalCents) {
        return {
          ok: false,
          error: `Montant trop élevé (${formatMad(totals.total)}) : un vendeur humain doit valider.`,
          sideEffects: {
            setHandoffMode: "manual",
            flagForHumanReview: true,
            reviewReason: `Commande de ${formatMad(totals.total)} créée par l’IA — validation humaine requise.`,
          },
        };
      }

      // Client : retrouve ou crée, puis rattache.
      const { customer } = await repo.findOrCreateCustomerByPhone(merchantId, {
        phone,
        name: customerName,
        city,
        address,
      });

      const reference = generateOrderReference();
      const order = await repo.createOrder(merchantId, {
        customerId: customer.id,
        conversationId: ctx.conversationId ?? null,
        items: items.lines,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        discount: totals.discount,
        total: totals.total,
        currency: "MAD",
        paymentMethod:
          (asString(args.paymentMethod, "paymentMethod", 20) as never) ??
          settings?.defaultPaymentMethod ??
          "cod",
        paymentStatus: "unpaid",
        orderStatus: "pending_confirmation",
        customerName,
        customerPhone: phone,
        city,
        address,
        notes: asString(args.notes, "notes", TOOL_LIMITS.maxNoteLength) ?? null,
        statusHistory: [
          {
            from: null,
            to: "pending_confirmation",
            by: "ai",
            at: new Date().toISOString(),
            reason: "Commande créée par l’agent de vente IA",
          },
        ],
        createdByAi: true,
      });

      // Décrémente le stock et met à jour les compteurs client.
      for (const line of items.lines) {
        await repo.decrementStock(merchantId, line.productId, line.quantity);
      }

      await db
        .update(customers)
        .set({
          ordersCount: sql`${customers.ordersCount} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${totals.total}`,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customers.id, customer.id),
            eq(customers.merchantId, merchantId),
          ),
        );

      if (ctx.conversationId) {
        await db
          .update(conversations)
          .set({ customerId: customer.id, status: "open" })
          .where(
            and(
              eq(conversations.id, ctx.conversationId),
              eq(conversations.merchantId, merchantId),
            ),
          );
      }

      await repo.incrementUsage(merchantId, "orders_ai");

      return {
        ok: true,
        data: {
          orderId: order.id,
          reference: order.reference,
          status: order.orderStatus,
          customer: { name: customerName, phone, city, address },
          items: items.lines.map((l) => ({
            name: l.name,
            variant: l.variant,
            quantity: l.quantity,
          })),
          subtotal: formatMad(totals.subtotal),
          deliveryFee: formatMad(totals.deliveryFee),
          total: formatMad(totals.total),
          paymentMethod: order.paymentMethod,
          note: "Commande enregistrée. Confirme la référence au client.",
        },
        sideEffects: { createdOrderId: order.id },
      };
    }

    case "update_order": {
      const orderId = asString(args.orderId, "orderId", 64);
      if (!orderId) return fail("orderId requis.");

      const order = await repo.getOrder(merchantId, orderId);
      if (!order) return fail("Commande introuvable pour cette boutique.");
      if (["delivered", "cancelled", "refused", "returned"].includes(order.orderStatus)) {
        return fail(`Commande ${order.reference} déjà clôturée (${order.orderStatus}).`);
      }

      const patch: Record<string, unknown> = {};
      const city = asString(args.city, "city", 120);
      const address = asString(args.address, "address", 400);
      const notes = asString(args.notes, "notes", TOOL_LIMITS.maxNoteLength);
      const phone = args.customerPhone !== undefined ? normalizeMoroccanPhone(args.customerPhone) : null;

      if (city) patch.city = matchMoroccanCity(city) ?? city;
      if (address) patch.address = address;
      if (notes) patch.notes = notes;
      if (phone) patch.customerPhone = phone;

      if (Object.keys(patch).length === 0) return fail("Aucune modification à appliquer.");

      const updated = await repo.updateOrder(merchantId, orderId, patch);

      // Recalcule la livraison si la ville a changé.
      if (patch.city) {
        const settings = await repo.getSettings(merchantId);
        const deliveryFee = resolveDeliveryFee(settings, String(patch.city), updated?.subtotal ?? 0);
        const totals = computeTotals({
          lines: ((updated?.items ?? []) as OrderLine[]).map((l) => ({
            ...l,
            lineTotal: l.unitPrice * l.quantity,
          })),
          deliveryFee,
          discount: updated?.discount ?? 0,
        });
        await repo.updateOrder(merchantId, orderId, {
          deliveryFee: totals.deliveryFee,
          total: totals.total,
        });
      }

      return {
        ok: true,
        data: { orderId, updated: Object.keys(patch), reference: updated?.reference },
      };
    }

    case "confirm_order": {
      const orderId = asString(args.orderId, "orderId", 64);
      const status = asString(args.status, "status", 32);
      if (!orderId) return fail("orderId requis.");
      if (status !== "pending_confirmation" && status !== "confirmed") {
        return fail("Statut demandé invalide.");
      }

      const order = await repo.getOrder(merchantId, orderId);
      if (!order) return fail("Commande introuvable pour cette boutique.");

      await repo.updateOrder(merchantId, orderId, {
        orderStatus: status as never,
        ...(status === "confirmed"
          ? { confirmedAt: new Date(), paymentStatus: "pending" as never }
          : {}),
      });
      await repo.appendOrderStatusHistory(merchantId, orderId, {
        from: order.orderStatus,
        to: status,
        by: "ai",
        reason: "Confirmation obtenue du client en conversation",
      });

      return {
        ok: true,
        data: {
          orderId,
          reference: order.reference,
          status,
          note:
            status === "confirmed"
              ? "Commande confirmée. Le marchand la voit immédiatement dans son tableau de bord."
              : "Commande mise en attente de confirmation.",
        },
      };
    }

    /* ------------------------- humain ------------------------- */
    case "request_human_agent": {
      const reason =
        asString(args.reason, "reason", 280) ?? "Le client demande un conseiller.";
      const urgent = args.urgent === true;

      return {
        ok: true,
        data: {
          escalated: true,
          urgent,
          reason,
          note:
            "La conversation passe en mode manuel : l’IA ne répondra plus. " +
            "Préviens le client qu’un conseiller prend le relais.",
        },
        sideEffects: {
          setHandoffMode: "manual",
          flagForHumanReview: true,
          reviewReason: reason,
        },
      };
    }

    default:
      return fail(`Outil inconnu : ${name}`);
  }
}
