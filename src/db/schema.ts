/**
 * CLOSER — Schéma de base de données (PostgreSQL / Supabase, Drizzle ORM)
 * ----------------------------------------------------------------------
 * Architecture multi-tenant stricte : chaque table métier porte `merchant_id`.
 * Aucune donnée sensible de paiement (PAN, CVV, identifiants bancaires) n’est
 * stockée ici : seul l’état d’abonnement et les références fournisseur le sont.
 *
 * Convention : `uuid` en PK (compatible pooler Supabase / serverless),
 * `created_at` / `updated_at` gérés côté SQL.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  smallint,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

/* =====================================================================
   ENUMS
   ===================================================================== */

export const merchantStatusEnum = pgEnum("merchant_status", [
  "pending",
  "active",
  "suspended",
  "deactivated",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "payment_failed",
  "cancelled",
  "expired",
  "suspended",
]);

export const planEnum = pgEnum("plan", ["starter", "pro", "business"]);

export const roleEnum = pgEnum("role", ["owner", "admin", "agent"]);

export const channelEnum = pgEnum("channel", [
  "web",
  "whatsapp",
  "instagram",
  "facebook",
  "sms",
  "email",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "pending",
  "resolved",
  "archived",
]);

export const handoffModeEnum = pgEnum("handoff_mode", [
  "ai",
  "approval",
  "manual",
]);

export const senderTypeEnum = pgEnum("sender_type", [
  "customer",
  "ai",
  "agent",
  "system",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "draft",
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);

export const customerStatusEnum = pgEnum("customer_status", [
  "new",
  "active",
  "vip",
  "inactive",
  "blacklisted",
]);

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "draft",
  "archived",
  "out_of_stock",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "ai_qualified",
  "pending_confirmation",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refused",
  "returned",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cod",
  "card",
  "bank_transfer",
  "wallet",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "paid",
  "partially_paid",
  "refunded",
  "failed",
]);

export const automationTypeEnum = pgEnum("automation_type", [
  "abandoned_conversation",
  "order_confirmation",
  "delivery_followup",
  "review_request",
  "cross_sell",
  "repeat_purchase",
]);

export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "pending",
  "sent",
  "skipped",
  "failed",
]);

export const integrationProviderEnum = pgEnum("integration_provider", [
  "whatsapp",
  "instagram",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "not_configured",
  "pending_verification",
  "connected",
  "error",
  "disconnected",
]);

/* =====================================================================
   PLATEFORME (hors tenant)
   ===================================================================== */

/**
 * Paramètres globaux de la plateforme, modifiables depuis le panneau admin.
 * Les prix ne sont JAMAIS codés en dur dans le frontend : ils viennent d’ici.
 */
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Catalogue des offres commerciales (source de vérité des prix). */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: planEnum("slug").notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  /** Montant mensuel TTC en MAD, stocké en centimes pour éviter les flottants. */
  priceMonthly: integer("price_monthly").notNull(),
  priceYearly: integer("price_yearly"),
  currency: varchar("currency", { length: 3 }).notNull().default("MAD"),
  trialDays: smallint("trial_days").notNull().default(7),
  /** Limites d’usage : { conversations: 1000, products: 50, seats: 1, channels: 1, automations: 3 } */
  limits: jsonb("limits").notNull().default(sql`'{}'::jsonb`),
  features: jsonb("features").notNull().default(sql`'[]'::jsonb`),
  position: smallint("position").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* =====================================================================
   COMPTES & ÉQUIPE
   ===================================================================== */

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    businessName: varchar("business_name", { length: 160 }),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    status: merchantStatusEnum("status").notNull().default("pending"),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    subscriptionStatus: subscriptionStatusEnum("subscription_status")
      .notNull()
      .default("trialing"),
    subscriptionPlan: planEnum("subscription_plan").notNull().default("starter"),
    locale: varchar("locale", { length: 8 }).notNull().default("fr-MA"),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Africa/Casablanca"),
    isDemo: boolean("is_demo").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("merchants_email_uq").on(sql`lower(${t.email})`)],
);

/** Utilisateurs supplémentaires (rôles admin / agent) rattachés à un merchant. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: roleEnum("role").notNull().default("agent"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_merchant_email_uq").on(
      t.merchantId,
      sql`lower(${t.email})`,
    ),
    index("users_merchant_idx").on(t.merchantId),
  ],
);

/* =====================================================================
   CONFIGURATION MARCHAND
   ===================================================================== */

export const merchantSettings = pgTable(
  "merchant_settings",
  {
    merchantId: uuid("merchant_id")
      .primaryKey()
      .references(() => merchants.id, { onDelete: "cascade" }),
    businessDescription: text("business_description"),
    /** [{ day: "monday", open: "09:00", close: "19:00", closed: false }] */
    openingHours: jsonb("opening_hours").notNull().default(sql`'[]'::jsonb`),
    /** Frais de livraison par défaut en centimes MAD. */
    deliveryFeeDefault: integer("delivery_fee_default").notNull().default(0),
    /** [{ city, fee, eta, enabled }] */
    deliveryZones: jsonb("delivery_zones").notNull().default(sql`'[]'::jsonb`),
    deliveryEtaDaysMin: smallint("delivery_eta_days_min"),
    deliveryEtaDaysMax: smallint("delivery_eta_days_max"),
    freeShippingThreshold: integer("free_shipping_threshold"),
    returnPolicy: text("return_policy"),
    exchangePolicy: text("exchange_policy"),
    /** [{ question, answer }] */
    faq: jsonb("faq").notNull().default(sql`'[]'::jsonb`),
    /** [{ title, description, code, startsAt, endsAt, active }] */
    promotions: jsonb("promotions").notNull().default(sql`'[]'::jsonb`),
    customInstructions: text("custom_instructions"),
    tone: varchar("tone", { length: 32 }).notNull().default("professional"),
    preferredLanguage: varchar("preferred_language", { length: 8 })
      .notNull()
      .default("fr"),
    currency: varchar("currency", { length: 3 }).notNull().default("MAD"),
    defaultPaymentMethod: paymentMethodEnum("default_payment_method")
      .notNull()
      .default("cod"),
    defaultHandoffMode: handoffModeEnum("default_handoff_mode")
      .notNull()
      .default("ai"),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    upsellEnabled: boolean("upsell_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("merchant_settings_merchant_idx").on(t.merchantId)],
);

/* =====================================================================
   CATALOGUE
   ===================================================================== */

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    position: smallint("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("product_categories_merchant_slug_uq").on(
      t.merchantId,
      t.slug,
    ),
    index("product_categories_merchant_idx").on(t.merchantId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(
      (): any => productCategories.id,
      { onDelete: "set null" },
    ),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    /** Prix en centimes MAD (jamais de flottant pour de l’argent). */
    price: integer("price").notNull(),
    salePrice: integer("sale_price"),
    sku: varchar("sku", { length: 64 }),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    trackStock: boolean("track_stock").notNull().default(true),
    images: jsonb("images").notNull().default(sql`'[]'::jsonb`),
    /** [{ id, name, options: ["S","M","L"], required: true }] */
    variants: jsonb("variants").notNull().default(sql`'[]'::jsonb`),
    sizes: jsonb("sizes").notNull().default(sql`'[]'::jsonb`),
    colors: jsonb("colors").notNull().default(sql`'[]'::jsonb`),
    /** Poids en grammes. */
    weightGrams: integer("weight_grams"),
    /** Mots-clés Darija/Arabe pour améliorer la recherche IA. */
    searchKeywords: jsonb("search_keywords").notNull().default(sql`'[]'::jsonb`),
    status: productStatusEnum("status").notNull().default("active"),
    position: smallint("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("products_merchant_status_idx").on(t.merchantId, t.status),
    index("products_merchant_name_idx").on(t.merchantId, t.name),
    uniqueIndex("products_merchant_sku_uq").on(t.merchantId, t.sku),
  ],
);

/* =====================================================================
   CRM
   ===================================================================== */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }),
    /** Format E.164 normalisé, ex. +212612345678 */
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 120 }),
    address: text("address"),
    notes: text("notes"),
    status: customerStatusEnum("status").notNull().default("new"),
    language: varchar("language", { length: 8 }),
    totalSpent: integer("total_spent").notNull().default(0),
    ordersCount: integer("orders_count").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_merchant_phone_uq").on(t.merchantId, t.phone),
    index("customers_merchant_idx").on(t.merchantId),
    index("customers_merchant_last_interaction_idx").on(
      t.merchantId,
      t.lastInteractionAt,
    ),
  ],
);

/* =====================================================================
   CONVERSATIONS & MESSAGES
   ===================================================================== */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(
      (): any => customers.id,
      { onDelete: "set null" },
    ),
    source: channelEnum("source").notNull().default("web"),
    /** Identifiant externe du fil côté fournisseur (WABA thread, IG conversation…). */
    externalId: varchar("external_id", { length: 191 }),
    status: conversationStatusEnum("status").notNull().default("open"),
    handoffMode: handoffModeEnum("handoff_mode").notNull().default("ai"),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    assignedAgentId: uuid("assigned_agent_id").references(
      (): any => users.id,
      { onDelete: "set null" },
    ),
    needsHumanReview: boolean("needs_human_review").notNull().default(false),
    reviewReason: text("review_reason"),
    unreadCount: integer("unread_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    /** Contexte de vente extrait par l’IA (produits discutés, intention, objection). */
    aiContext: jsonb("ai_context").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_merchant_external_uq").on(
      t.merchantId,
      t.source,
      t.externalId,
    ),
    index("conversations_merchant_status_idx").on(t.merchantId, t.status),
    index("conversations_merchant_last_message_idx").on(
      t.merchantId,
      t.lastMessageAt,
    ),
    index("conversations_customer_idx").on(t.customerId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    senderType: senderTypeEnum("sender_type").notNull(),
    authorId: uuid("author_id"),
    content: text("content").notNull(),
    language: varchar("language", { length: 8 }),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    /** Brouillon en attente de validation (mode APPROVAL). */
    status: messageStatusEnum("status").notNull().default("sent"),
    /** Actions/outils déclenchés par l’IA pour ce message. */
    toolCalls: jsonb("tool_calls").notNull().default(sql`'[]'::jsonb`),
    /** Jetons consommés — sert à la facturation d’usage et aux limites de plan. */
    tokensUsed: integer("tokens_used"),
    externalId: varchar("external_id", { length: 191 }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
    index("messages_merchant_idx").on(t.merchantId),
  ],
);

/* =====================================================================
   COMMANDES
   ===================================================================== */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(
      (): any => customers.id,
      { onDelete: "set null" },
    ),
    conversationId: uuid("conversation_id").references(
      (): any => conversations.id,
      { onDelete: "set null" },
    ),
    reference: varchar("reference", { length: 32 }).notNull(),
    /** [{ productId, name, variant, quantity, unitPrice, lineTotal }] */
    items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
    /** Tous les montants en centimes MAD. */
    subtotal: integer("subtotal").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("MAD"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("cod"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    orderStatus: orderStatusEnum("order_status").notNull().default("new"),
    customerName: varchar("customer_name", { length: 160 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 32 }).notNull(),
    city: varchar("city", { length: 120 }),
    address: text("address"),
    notes: text("notes"),
    /** Historique des transitions : [{ from, to, by, at, reason }] */
    statusHistory: jsonb("status_history").notNull().default(sql`'[]'::jsonb`),
    /** true si la commande a été créée par l’IA (attribution "revenu récupéré"). */
    createdByAi: boolean("created_by_ai").notNull().default(false),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_merchant_reference_uq").on(t.merchantId, t.reference),
    index("orders_merchant_status_idx").on(t.merchantId, t.orderStatus),
    index("orders_merchant_created_idx").on(t.merchantId, t.createdAt),
    index("orders_customer_idx").on(t.customerId),
  ],
);

/* =====================================================================
   ABONNEMENTS & PAIEMENTS
   ===================================================================== */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references((): any => plans.id, {
      onDelete: "set null",
    }),
    plan: planEnum("plan").notNull().default("starter"),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    interval: varchar("interval", { length: 16 }).notNull().default("month"),
    /** Montant facturé en centimes MAD. */
    amount: integer("amount").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("MAD"),
    provider: varchar("provider", { length: 32 }),
    providerCustomerId: varchar("provider_customer_id", { length: 191 }),
    providerSubscriptionId: varchar("provider_subscription_id", {
      length: 191,
    }),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("subscriptions_merchant_idx").on(t.merchantId),
    uniqueIndex("subscriptions_provider_sub_uq").on(
      t.provider,
      t.providerSubscriptionId,
    ),
  ],
);

/**
 * Historique de paiement / factures.
 * Aucune donnée de carte : uniquement des références fournisseur.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      (): any => subscriptions.id,
      { onDelete: "set null" },
    ),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerPaymentId: varchar("provider_payment_id", { length: 191 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("MAD"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    invoiceNumber: varchar("invoice_number", { length: 64 }),
    invoiceUrl: text("invoice_url"),
    failureCode: varchar("failure_code", { length: 64 }),
    failureReason: text("failure_reason"),
    /** Charge utile brute signée du webhook (hors secret) pour audit. */
    raw: jsonb("raw"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payments_merchant_idx").on(t.merchantId),
    uniqueIndex("payments_provider_payment_uq").on(
      t.provider,
      t.providerPaymentId,
    ),
  ],
);

/* =====================================================================
   INTÉGRATIONS CANAUX
   ===================================================================== */

/**
 * Connexion d’un canal pour un marchand.
 * Les jetons sont chiffrés au repos (voir src/lib/security/encryption.ts).
 * Si `status = not_configured`, l’UI affiche « Non connecté » — jamais de
 * connexion simulée.
 */
export const channelConnections = pgTable(
  "channel_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    status: integrationStatusEnum("status")
      .notNull()
      .default("not_configured"),
    displayName: varchar("display_name", { length: 160 }),
    externalAccountId: varchar("external_account_id", { length: 191 }),
    phoneNumberId: varchar("phone_number_id", { length: 191 }),
    wabaId: varchar("waba_id", { length: 191 }),
    /** Chiffré — jamais renvoyé tel quel au client. */
    encryptedCredentials: text("encrypted_credentials"),
    webhookVerifyToken: varchar("webhook_verify_token", { length: 191 }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("channel_connections_merchant_provider_uq").on(
      t.merchantId,
      t.provider,
    ),
  ],
);

/* =====================================================================
   AUTOMATIONS
   ===================================================================== */

export const automationRules = pgTable(
  "automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    type: automationTypeEnum("type").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    /** Délai en minutes avant déclenchement. */
    delayMinutes: integer("delay_minutes").notNull().default(60),
    /** { messageTemplate, language, maxSendsPerCustomerPerDay, quietHoursStart, quietHoursEnd, conditions } */
    configuration: jsonb("configuration").notNull().default(sql`'{}'::jsonb`),
    maxRunsPerDay: integer("max_runs_per_day").notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("automation_rules_merchant_type_uq").on(
      t.merchantId,
      t.type,
    ),
    index("automation_rules_merchant_enabled_idx").on(
      t.merchantId,
      t.enabled,
    ),
  ],
);

/** Journal d’exécution des automatisations (traçabilité + anti-spam). */
export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => automationRules.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      (): any => conversations.id,
      { onDelete: "cascade" },
    ),
    customerId: uuid("customer_id"),
    messageId: uuid("message_id"),
    status: automationRunStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("automation_runs_scheduled_idx").on(t.scheduledFor, t.status),
    index("automation_runs_merchant_rule_idx").on(t.merchantId, t.ruleId),
  ],
);

/* =====================================================================
   USAGE & AUDIT
   ===================================================================== */

/** Compteurs d’usage mensuels par marchand (application des limites de plan). */
export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
    metric: varchar("metric", { length: 48 }).notNull(), // ai_messages | orders | conversations | tokens
    value: integer("value").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("usage_records_merchant_period_metric_uq").on(
      t.merchantId,
      t.period,
      t.metric,
    ),
  ],
);

/** Journal d’audit des actions sensibles (admin, paramètres, statuts). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id"),
    actorId: uuid("actor_id"),
    actorRole: roleEnum("actor_role"),
    action: varchar("action", { length: 96 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_logs_merchant_created_idx").on(t.merchantId, t.createdAt),
    index("audit_logs_action_idx").on(t.action),
  ],
);

/* =====================================================================
   RELATIONS (Drizzle)
   ===================================================================== */

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  settings: one(merchantSettings),
  users: many(users),
  products: many(products),
  customers: many(customers),
  conversations: many(conversations),
  orders: many(orders),
  subscriptions: many(subscriptions),
  payments: many(payments),
  automations: many(automationRules),
  channels: many(channelConnections),
}));

export const usersRelations = relations(users, ({ one }) => ({
  merchant: one(merchants, {
    fields: [users.merchantId],
    references: [merchants.id],
  }),
}));

export const merchantSettingsRelations = relations(
  merchantSettings,
  ({ one }) => ({
    merchant: one(merchants, {
      fields: [merchantSettings.merchantId],
      references: [merchants.id],
    }),
  }),
);

export const productsRelations = relations(products, ({ one }) => ({
  merchant: one(merchants, {
    fields: [products.merchantId],
    references: [merchants.id],
  }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [customers.merchantId],
    references: [merchants.id],
  }),
  conversations: many(conversations),
  orders: many(orders),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    merchant: one(merchants, {
      fields: [conversations.merchantId],
      references: [merchants.id],
    }),
    customer: one(customers, {
      fields: [conversations.customerId],
      references: [customers.id],
    }),
    assignedAgent: one(users, {
      fields: [conversations.assignedAgentId],
      references: [users.id],
    }),
    messages: many(messages),
    orders: many(orders),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  merchant: one(merchants, {
    fields: [orders.merchantId],
    references: [merchants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  conversation: one(conversations, {
    fields: [orders.conversationId],
    references: [conversations.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [subscriptions.merchantId],
    references: [merchants.id],
  }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));

export const automationRulesRelations = relations(
  automationRules,
  ({ one, many }) => ({
    merchant: one(merchants, {
      fields: [automationRules.merchantId],
      references: [merchants.id],
    }),
    runs: many(automationRuns),
  }),
);

/* =====================================================================
   TYPES EXPORTÉS
   ===================================================================== */

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type User = typeof users.$inferSelect;
export type MerchantSettings = typeof merchantSettings.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number];
export type HandoffMode = (typeof handoffModeEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];
