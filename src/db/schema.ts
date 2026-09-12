import { pgTable, serial, varchar, text, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verified: boolean("verified").default(false).notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  trialDaysRemaining: integer("trial_days_remaining").default(7).notNull(),
  status: varchar("status", { length: 50 }).default("trial").notNull(), // trial, active, expired
  subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("starter"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
});

export const merchantSettings = pgTable("merchant_settings", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  businessInfo: text("business_info"),
  openingHours: text("opening_hours"),
  deliveryFees: jsonb("delivery_fees").default("{}"),
  deliveryZones: text("delivery_zones"),
  deliveryTimes: text("delivery_times"),
  promotions: text("promotions"),
  faq: text("faq"),
  returnPolicy: text("return_policy"),
  exchangePolicy: text("exchange_policy"),
  customInstructions: text("custom_instructions"),
  languages: varchar("languages", { length: 255 }).default("darija,arabic,french").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").default(0).notNull(),
  imageUrl: varchar("image_url", { length: 500 }),
  category: varchar("category", { length: 100 }),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  customerAddress: text("customer_address").notNull(),
  items: jsonb("items").notNull().default("[]"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, confirmed, delivered, cancelled
  paymentMethod: varchar("payment_method", { length: 50 }).default("cod").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  customerName: varchar("customer_name", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  source: varchar("source", { length: 50 }).notNull(), // whatsapp, instagram, web
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("open").notNull(), // open, closed, converted
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  sender: varchar("sender", { length: 20 }).notNull(), // customer, ai, merchant, system
  content: text("content").notNull(),
  language: varchar("language", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminConfig = pgTable("admin_config", {
  id: serial("id").primaryKey(),
  starterPrice: decimal("starter_price", { precision: 10, scale: 2 }).default("299").notNull(),
  proPrice: decimal("pro_price", { precision: 10, scale: 2 }).default("599").notNull(),
  businessPrice: decimal("business_price", { precision: 10, scale: 2 }).default("999").notNull(),
  trialDaysDefault: integer("trial_days_default").default(7).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  plan: varchar("plan", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("trial").notNull(), // trial, active, cancelled, expired
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  cancelledAt: timestamp("cancelled_at"),
});
