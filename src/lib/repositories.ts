/**
 * Couche d’accès aux données — 100 % périmétrée par marchand.
 * =====================================================================
 * Corrige S2 : plus aucune lecture de table entière. Chaque fonction exige un
 * `merchantId` et l’injecte dans la clause `where`. Les pages et les routes API
 * n’écrivent plus de requête à la main — elles passent par ici (corrige E4).
 *
 * Convention : les fonctions `*ById` vérifient la propriété et renvoient `null`
 * si la ressource appartient à un autre tenant (404, jamais 403 : on ne révèle
 * pas l’existence des données d’un autre marchand).
 */
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  automationRules,
  channelConnections,
  conversations,
  customers,
  merchants,
  merchantSettings,
  messages,
  orders,
  payments,
  plans,
  products,
  subscriptions,
  usageRecords,
  users,
  type NewOrder,
  type OrderStatus,
} from "@/db/schema";
import { assertOwnership } from "@/lib/security/tenant";
import { generateOrderReference } from "@/lib/orders/status";
import type { Session } from "@/lib/security/tenant";

/* ------------------------------------------------------------------ */
/* Marchand & réglages                                                 */
/* ------------------------------------------------------------------ */

export async function getMerchantById(merchantId: string) {
  return (
    (await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    })) ?? null
  );
}

export async function getSettings(merchantId: string) {
  return (
    (await db.query.merchantSettings.findFirst({
      where: eq(merchantSettings.merchantId, merchantId),
    })) ?? null
  );
}

export async function upsertSettings(
  merchantId: string,
  values: Partial<typeof merchantSettings.$inferInsert>,
) {
  const { merchantId: _ignored, ...rest } = values;
  const [row] = await db
    .insert(merchantSettings)
    .values({ merchantId, ...rest })
    .onConflictDoUpdate({
      target: merchantSettings.merchantId,
      set: { ...rest, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/* ------------------------------------------------------------------ */
/* Produits                                                            */
/* ------------------------------------------------------------------ */

export type ProductFilters = {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

export async function listProducts(merchantId: string, filters: ProductFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

  const conditions = [
    eq(products.merchantId, merchantId),
    filters.status ? eq(products.status, filters.status as never) : undefined,
    filters.search
      ? or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`),
        )
      : undefined,
  ].filter(Boolean);

  const where = and(...(conditions as [never, ...never[]]))!;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(products.position, desc(products.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(where),
  ]);

  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getProduct(merchantId: string, productId: string) {
  const row = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.merchantId, merchantId)),
  });
  return row ?? null;
}

export async function createProduct(
  merchantId: string,
  values: Omit<typeof products.$inferInsert, "merchantId">,
) {
  const [row] = await db
    .insert(products)
    .values({ ...values, merchantId })
    .returning();
  return row;
}

export async function updateProduct(
  merchantId: string,
  productId: string,
  values: Partial<typeof products.$inferInsert>,
) {
  const { id: _id, merchantId: _m, createdAt: _c, ...rest } = values;
  const [row] = await db
    .update(products)
    .set({ ...rest, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.merchantId, merchantId)))
    .returning();
  return row ?? null;
}

export async function deleteProduct(merchantId: string, productId: string) {
  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.merchantId, merchantId)))
    .returning({ id: products.id });
  return deleted.length > 0;
}

export async function countProducts(merchantId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.merchantId, merchantId));
  return row?.count ?? 0;
}

/** Catalogue actif injecté dans le prompt de l’IA. */
export async function listActiveProducts(merchantId: string, limit = 200) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        inArray(products.status, ["active", "out_of_stock"]),
      ),
    )
    .orderBy(products.position, products.createdAt)
    .limit(limit);
}

/** Décrémente le stock de façon atomique (évite les dépassements). */
export async function decrementStock(
  merchantId: string,
  productId: string,
  quantity: number,
) {
  const [row] = await db
    .update(products)
    .set({
      stock: sql`greatest(${products.stock} - ${quantity}, 0)`,
      status: sql`case when greatest(${products.stock} - ${quantity}, 0) = 0
                       then 'out_of_stock'::product_status
                       else ${products.status} end`,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.merchantId, merchantId)))
    .returning();
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Clients (CRM)                                                       */
/* ------------------------------------------------------------------ */

export async function listCustomers(
  merchantId: string,
  opts: { search?: string; status?: string; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

  const where = and(
    eq(customers.merchantId, merchantId),
    opts.status ? eq(customers.status, opts.status as never) : undefined,
    opts.search
      ? or(
          ilike(customers.name, `%${opts.search}%`),
          ilike(customers.phone, `%${opts.search}%`),
          ilike(customers.city, `%${opts.search}%`),
        )
      : undefined,
  );

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.lastInteractionAt), desc(customers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(customers).where(where),
  ]);

  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getCustomer(merchantId: string, customerId: string) {
  const row = await db.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.merchantId, merchantId)),
  });
  return row ?? null;
}

/** Retrouve un client par téléphone (normalisé) ou le crée. */
export async function findOrCreateCustomerByPhone(
  merchantId: string,
  input: {
    phone: string;
    name?: string | null;
    city?: string | null;
    address?: string | null;
    email?: string | null;
    notes?: string | null;
  },
) {
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(customers.merchantId, merchantId),
      eq(customers.phone, input.phone),
    ),
  });

  if (existing) {
    const patch: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
    if (input.name && !existing.name) patch.name = input.name;
    if (input.city && !existing.city) patch.city = input.city;
    if (input.address && !existing.address) patch.address = input.address;
    if (input.email && !existing.email) patch.email = input.email;

    if (Object.keys(patch).length > 1) {
      const [updated] = await db
        .update(customers)
        .set(patch)
        .where(eq(customers.id, existing.id))
        .returning();
      return { customer: updated, created: false };
    }
    return { customer: existing, created: false };
  }

  const [created] = await db
    .insert(customers)
    .values({
      merchantId,
      phone: input.phone,
      name: input.name ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
      status: "new",
    })
    .returning();

  return { customer: created, created: true };
}

export async function updateCustomer(
  merchantId: string,
  customerId: string,
  values: Partial<typeof customers.$inferInsert>,
) {
  const { id: _id, merchantId: _m, createdAt: _c, ...rest } = values;
  const [row] = await db
    .update(customers)
    .set({ ...rest, updatedAt: new Date() })
    .where(and(eq(customers.id, customerId), eq(customers.merchantId, merchantId)))
    .returning();
  return row ?? null;
}

export async function getCustomerProfile(merchantId: string, customerId: string) {
  const [customer, customerOrders, customerConversations] = await Promise.all([
    getCustomer(merchantId, customerId),
    db
      .select()
      .from(orders)
      .where(and(eq(orders.merchantId, merchantId), eq(orders.customerId, customerId)))
      .orderBy(desc(orders.createdAt))
      .limit(20),
    db
      .select({
        id: conversations.id,
        status: conversations.status,
        source: conversations.source,
        lastMessageAt: conversations.lastMessageAt,
        preview: conversations.lastMessagePreview,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.merchantId, merchantId),
          eq(conversations.customerId, customerId),
        ),
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(10),
  ]);

  return { customer, orders: customerOrders, conversations: customerConversations };
}

/* ------------------------------------------------------------------ */
/* Conversations & messages                                            */
/* ------------------------------------------------------------------ */

export async function listConversations(
  merchantId: string,
  opts: {
    status?: string;
    source?: string;
    search?: string;
    needsHumanReview?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 30));

  const where = and(
    eq(conversations.merchantId, merchantId),
    opts.status ? eq(conversations.status, opts.status as never) : undefined,
    opts.source ? eq(conversations.source, opts.source as never) : undefined,
    opts.needsHumanReview === true
      ? eq(conversations.needsHumanReview, true)
      : undefined,
    opts.search
      ? or(
          ilike(conversations.lastMessagePreview, `%${opts.search}%`),
          ilike(customers.name, `%${opts.search}%`),
          ilike(customers.phone, `%${opts.search}%`),
        )
      : undefined,
  );

  const [rows, totalRow, unreadRow] = await Promise.all([
    db
      .select({
        id: conversations.id,
        status: conversations.status,
        source: conversations.source,
        handoffMode: conversations.handoffMode,
        aiEnabled: conversations.aiEnabled,
        needsHumanReview: conversations.needsHumanReview,
        reviewReason: conversations.reviewReason,
        unreadCount: conversations.unreadCount,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        customerId: conversations.customerId,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerCity: customers.city,
      })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(where)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .leftJoin(customers, eq(conversations.customerId, customers.id))
      .where(where),
    db
      .select({ count: sql<number>`coalesce(sum(${conversations.unreadCount}), 0)::int` })
      .from(conversations)
      .where(eq(conversations.merchantId, merchantId)),
  ]);

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    unreadTotal: unreadRow[0]?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getConversation(merchantId: string, conversationId: string) {
  const row = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.merchantId, merchantId),
    ),
  });
  return row ?? null;
}

export async function getConversationWithCustomer(
  merchantId: string,
  conversationId: string,
) {
  const rows = await db
    .select({
      conversation: conversations,
      customer: customers,
    })
    .from(conversations)
    .leftJoin(customers, eq(conversations.customerId, customers.id))
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.merchantId, merchantId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findConversationByExternalId(
  merchantId: string,
  source: string,
  externalId: string,
) {
  const row = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.merchantId, merchantId),
      eq(conversations.source, source as never),
      eq(conversations.externalId, externalId),
    ),
  });
  return row ?? null;
}

export async function createConversation(
  merchantId: string,
  values: Omit<typeof conversations.$inferInsert, "merchantId">,
) {
  const [row] = await db
    .insert(conversations)
    .values({ ...values, merchantId })
    .returning();
  return row;
}

export async function updateConversation(
  merchantId: string,
  conversationId: string,
  values: Partial<typeof conversations.$inferInsert>,
) {
  const { id: _id, merchantId: _m, createdAt: _c, ...rest } = values;
  const [row] = await db
    .update(conversations)
    .set({ ...rest, updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.merchantId, merchantId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listMessages(
  merchantId: string,
  conversationId: string,
  opts: { limit?: number; before?: Date; includeDrafts?: boolean } = {},
) {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.merchantId, merchantId),
        opts.before ? lte(messages.createdAt, opts.before) : undefined,
        opts.includeDrafts ? undefined : inArray(messages.status, ["sent", "delivered", "read"]),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function listDrafts(merchantId: string, conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.merchantId, merchantId),
        eq(messages.status, "draft"),
      ),
    )
    .orderBy(messages.createdAt);
}

export async function insertMessage(
  merchantId: string,
  conversationId: string,
  values: {
    senderType: "customer" | "ai" | "agent" | "system";
    content: string;
    language?: string | null;
    aiGenerated?: boolean;
    status?: "draft" | "queued" | "sent" | "delivered" | "read" | "failed";
    authorId?: string | null;
    toolCalls?: unknown[];
    tokensUsed?: number | null;
    externalId?: string | null;
    error?: string | null;
  },
) {
  const [row] = await db
    .insert(messages)
    .values({
      merchantId,
      conversationId,
      senderType: values.senderType,
      content: values.content,
      language: values.language ?? null,
      aiGenerated: values.aiGenerated ?? false,
      status: values.status ?? "sent",
      authorId: values.authorId ?? null,
      toolCalls: values.toolCalls ?? [],
      tokensUsed: values.tokensUsed ?? null,
      externalId: values.externalId ?? null,
      error: values.error ?? null,
    })
    .returning();
  return row;
}

/** Met à jour l’aperçu, l’horodatage et le compteur de non-lus d’une conversation. */
export async function touchConversation(
  merchantId: string,
  conversationId: string,
  opts: { preview: string; incrementUnread?: boolean },
) {
  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: opts.preview.slice(0, 280),
      unreadCount: opts.incrementUnread
        ? sql`${conversations.unreadCount} + 1`
        : conversations.unreadCount,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.merchantId, merchantId),
      ),
    );
}

export async function markConversationRead(merchantId: string, conversationId: string) {
  await db
    .update(conversations)
    .set({ unreadCount: 0 })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.merchantId, merchantId),
      ),
    );
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export async function listOrders(
  merchantId: string,
  opts: {
    status?: OrderStatus | OrderStatus[];
    search?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

  const statuses = opts.status
    ? Array.isArray(opts.status)
      ? opts.status
      : [opts.status]
    : undefined;

  const where = and(
    eq(orders.merchantId, merchantId),
    statuses ? inArray(orders.orderStatus, statuses) : undefined,
    opts.from ? gte(orders.createdAt, opts.from) : undefined,
    opts.to ? lte(orders.createdAt, opts.to) : undefined,
    opts.search
      ? or(
          ilike(orders.reference, `%${opts.search}%`),
          ilike(orders.customerName, `%${opts.search}%`),
          ilike(orders.customerPhone, `%${opts.search}%`),
          ilike(orders.city, `%${opts.search}%`),
        )
      : undefined,
  );

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);

  return { rows, total: totalRow[0]?.count ?? 0, page, pageSize };
}

export async function getOrder(merchantId: string, orderId: string) {
  const row = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)),
  });
  return row ?? null;
}

export async function createOrder(
  merchantId: string,
  values: Omit<NewOrder, "merchantId" | "reference"> & { reference?: string },
) {
  const reference = values.reference ?? generateOrderReference();
  const { reference: _r, ...rest } = values;

  const [row] = await db
    .insert(orders)
    .values({ ...rest, merchantId, reference })
    .returning();
  return row;
}

export async function updateOrder(
  merchantId: string,
  orderId: string,
  values: Partial<typeof orders.$inferInsert>,
) {
  const { id: _id, merchantId: _m, createdAt: _c, reference: _r, ...rest } = values;
  const [row] = await db
    .update(orders)
    .set({ ...rest, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)))
    .returning();
  return row ?? null;
}

/** Ajoute une entrée à l’historique de statuts (traçabilité §11). */
export async function appendOrderStatusHistory(
  merchantId: string,
  orderId: string,
  entry: { from: string; to: string; by: string; reason?: string | null },
) {
  await db
    .update(orders)
    .set({
      statusHistory: sql`${orders.statusHistory} || ${JSON.stringify([
        { ...entry, at: new Date().toISOString() },
      ])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)));
}

/* ------------------------------------------------------------------ */
/* Statistiques (§21)                                                  */
/* ------------------------------------------------------------------ */

export async function getDashboardStats(merchantId: string, from: Date, to: Date) {
  const [orderAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      confirmed: sql<number>`count(*) filter (where ${orders.orderStatus} in ('confirmed','processing','shipped','delivered'))::int`,
      delivered: sql<number>`count(*) filter (where ${orders.orderStatus} = 'delivered')::int`,
      refused: sql<number>`count(*) filter (where ${orders.orderStatus} in ('refused','cancelled'))::int`,
      returned: sql<number>`count(*) filter (where ${orders.orderStatus} = 'returned')::int`,
      pending: sql<number>`count(*) filter (where ${orders.orderStatus} in ('new','ai_qualified','pending_confirmation'))::int`,
      revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.orderStatus} in ('confirmed','processing','shipped','delivered')), 0)::int`,
      revenueDelivered: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.orderStatus} = 'delivered'), 0)::int`,
      revenueByAi: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.createdByAi} = true and ${orders.orderStatus} in ('confirmed','processing','shipped','delivered')), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        gte(orders.createdAt, from),
        lte(orders.createdAt, to),
      ),
    );

  const [conversationAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${conversations.status} = 'open')::int`,
      needReview: sql<number>`count(*) filter (where ${conversations.needsHumanReview} = true)::int`,
      manual: sql<number>`count(*) filter (where ${conversations.handoffMode} = 'manual')::int`,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.merchantId, merchantId),
        gte(conversations.createdAt, from),
        lte(conversations.createdAt, to),
      ),
    );

  const [messageAgg] = await db
    .select({
      customerMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'customer')::int`,
      aiMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'ai')::int`,
      agentMessages: sql<number>`count(*) filter (where ${messages.senderType} = 'agent')::int`,
      tokens: sql<number>`coalesce(sum(${messages.tokensUsed}), 0)::int`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.merchantId, merchantId),
        gte(messages.createdAt, from),
        lte(messages.createdAt, to),
      ),
    );

  const [customerAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(
      and(
        eq(customers.merchantId, merchantId),
        gte(customers.createdAt, from),
        lte(customers.createdAt, to),
      ),
    );

  const [productAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${products.status} = 'active')::int`,
      outOfStock: sql<number>`count(*) filter (where ${products.status} = 'out_of_stock' or ${products.stock} = 0)::int`,
    })
    .from(products)
    .where(eq(products.merchantId, merchantId));

  return {
    orders: orderAgg,
    conversations: conversationAgg,
    messages: messageAgg,
    newCustomers: customerAgg?.count ?? 0,
    products: productAgg,
  };
}

/** Série quotidienne pour les graphiques (30 derniers jours par défaut). */
export async function getDailySeries(merchantId: string, days = 30) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  return db
    .select({
      day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
      ordersCount: sql<number>`count(*)::int`,
      confirmedCount: sql<number>`count(*) filter (where ${orders.orderStatus} in ('confirmed','processing','shipped','delivered'))::int`,
      revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.orderStatus} in ('confirmed','processing','shipped','delivered')), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), gte(orders.createdAt, since)))
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);
}

/**
 * Délai de réponse moyen (première réponse après un message client), en secondes.
 * Écrit en SQL brut : la jointure latérale est plus lisible et plus rapide
 * qu’une agrégation côté application sur des milliers de messages (§38).
 */
export async function getAverageResponseTime(
  merchantId: string,
  from: Date,
  to: Date,
): Promise<number | null> {
  const rows = await db.execute(sql`
    select avg(extract(epoch from (r.created_at - c.created_at)))::float8 as avg_seconds
    from messages r
    join lateral (
      select m.created_at
      from messages m
      where m.conversation_id = r.conversation_id
        and m.merchant_id = ${merchantId}
        and m.sender_type = 'customer'
        and m.created_at < r.created_at
      order by m.created_at desc
      limit 1
    ) c on true
    where r.merchant_id = ${merchantId}
      and r.sender_type in ('ai', 'agent')
      and r.created_at >= ${from}
      and r.created_at <= ${to}
  `);

  const result = rows as unknown as { rows?: { avg_seconds?: number | string | null }[] };
  const raw = result.rows?.[0]?.avg_seconds ?? null;
  const value = raw === null || raw === undefined ? null : Number(raw);
  return value === null || Number.isNaN(value) ? null : Math.round(value);
}

/* ------------------------------------------------------------------ */
/* Abonnement & usage                                                  */
/* ------------------------------------------------------------------ */

export async function getSubscription(merchantId: string) {
  return (
    (await db.query.subscriptions.findFirst({
      where: eq(subscriptions.merchantId, merchantId),
      orderBy: desc(subscriptions.createdAt),
    })) ?? null
  );
}

export async function listPayments(merchantId: string, limit = 30) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.merchantId, merchantId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function listPlans() {
  return db.select().from(plans).orderBy(plans.position);
}

export async function incrementUsage(
  merchantId: string,
  metric: string,
  amount = 1,
) {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  await db
    .insert(usageRecords)
    .values({ merchantId, period, metric, value: amount })
    .onConflictDoUpdate({
      target: [usageRecords.merchantId, usageRecords.period, usageRecords.metric],
      set: { value: sql`${usageRecords.value} + ${amount}`, updatedAt: new Date() },
    });
}

export async function getUsage(merchantId: string, period?: string) {
  const target = period ?? new Date().toISOString().slice(0, 7);
  return db
    .select()
    .from(usageRecords)
    .where(
      and(eq(usageRecords.merchantId, merchantId), eq(usageRecords.period, target)),
    );
}

/* ------------------------------------------------------------------ */
/* Canaux, automatisations, équipe, audit                               */
/* ------------------------------------------------------------------ */

export async function listChannelConnections(merchantId: string) {
  return db
    .select({
      id: channelConnections.id,
      provider: channelConnections.provider,
      status: channelConnections.status,
      displayName: channelConnections.displayName,
      phoneNumberId: channelConnections.phoneNumberId,
      lastSyncAt: channelConnections.lastSyncAt,
      lastError: channelConnections.lastError,
      updatedAt: channelConnections.updatedAt,
    })
    .from(channelConnections)
    .where(eq(channelConnections.merchantId, merchantId));
}

export async function listAutomations(merchantId: string) {
  return db
    .select()
    .from(automationRules)
    .where(eq(automationRules.merchantId, merchantId))
    .orderBy(automationRules.type);
}

export async function upsertAutomation(
  merchantId: string,
  type: string,
  values: {
    name: string;
    enabled: boolean;
    delayMinutes: number;
    configuration: unknown;
    maxRunsPerDay?: number;
  },
) {
  const [row] = await db
    .insert(automationRules)
    .values({ merchantId, type: type as never, ...values })
    .onConflictDoUpdate({
      target: [automationRules.merchantId, automationRules.type],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function listTeam(merchantId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.merchantId, merchantId))
    .orderBy(users.createdAt);
}

export async function logAudit(entry: {
  merchantId?: string | null;
  actorId?: string | null;
  actorRole?: "owner" | "admin" | "agent" | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      merchantId: entry.merchantId ?? null,
      actorId: entry.actorId ?? null,
      actorRole: (entry.actorRole ?? null) as never,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (error) {
    // L’audit ne doit jamais faire échouer l’opération métier.
    console.error("[audit] échec d’écriture:", error);
  }
}

/* ------------------------------------------------------------------ */
/* Vérification de propriété générique                                  */
/* ------------------------------------------------------------------ */

export function assertOwned<T extends { merchantId: string }>(
  row: T | null | undefined,
  session: Session,
  label: string,
): T {
  return assertOwnership(row as (T & { merchantId: string | null }) | null, session, label);
}

/* ------------------------------------------------------------------ */
/* Compteurs légers pour l’interface                                    */
/* ------------------------------------------------------------------ */

/** Total des messages non lus — affiché dans la navigation (§38). */
export async function countUnreadConversations(merchantId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`coalesce(sum(${conversations.unreadCount}), 0)::int` })
    .from(conversations)
    .where(eq(conversations.merchantId, merchantId));
  return row?.count ?? 0;
}

/** Conversations nécessitant une intervention humaine. */
export async function countNeedsReview(merchantId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(
      and(
        eq(conversations.merchantId, merchantId),
        eq(conversations.needsHumanReview, true),
      ),
    );
  return row?.count ?? 0;
}

/** Commandes en attente de confirmation (priorité du marchand). */
export async function countPendingOrders(merchantId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        inArray(orders.orderStatus, ["new", "ai_qualified", "pending_confirmation"]),
      ),
    );
  return row?.count ?? 0;
}

/** Produits en rupture de stock. */
export async function countOutOfStock(merchantId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.merchantId, merchantId),
        inArray(products.status, ["active", "out_of_stock"]),
        lte(products.stock, products.lowStockThreshold),
      ),
    );
  return row?.count ?? 0;
}
