CREATE TYPE "public"."automation_run_status" AS ENUM('pending', 'sent', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."automation_type" AS ENUM('abandoned_conversation', 'order_confirmation', 'delivery_followup', 'review_request', 'cross_sell', 'repeat_purchase');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('web', 'whatsapp', 'instagram', 'facebook', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'pending', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('new', 'active', 'vip', 'inactive', 'blacklisted');--> statement-breakpoint
CREATE TYPE "public"."handoff_mode" AS ENUM('ai', 'approval', 'manual');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('whatsapp', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('not_configured', 'pending_verification', 'connected', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('pending', 'active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'ai_qualified', 'pending_confirmation', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refused', 'returned');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cod', 'card', 'bank_transfer', 'wallet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'pending', 'paid', 'partially_paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('starter', 'pro', 'business');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'archived', 'out_of_stock');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'agent');--> statement-breakpoint
CREATE TYPE "public"."sender_type" AS ENUM('customer', 'ai', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'payment_failed', 'cancelled', 'expired', 'suspended');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid,
	"actor_id" uuid,
	"actor_role" "role",
	"action" varchar(96) NOT NULL,
	"entity_type" varchar(64),
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"type" "automation_type" NOT NULL,
	"name" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"delay_minutes" integer DEFAULT 60 NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_runs_per_day" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"conversation_id" uuid,
	"customer_id" uuid,
	"message_id" uuid,
	"status" "automation_run_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"scheduled_for" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'not_configured' NOT NULL,
	"display_name" varchar(160),
	"external_account_id" varchar(191),
	"phone_number_id" varchar(191),
	"waba_id" varchar(191),
	"encrypted_credentials" text,
	"webhook_verify_token" varchar(191),
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid,
	"source" "channel" DEFAULT 'web' NOT NULL,
	"external_id" varchar(191),
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"handoff_mode" "handoff_mode" DEFAULT 'ai' NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"assigned_agent_id" uuid,
	"needs_human_review" boolean DEFAULT false NOT NULL,
	"review_reason" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	"ai_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(160),
	"phone" varchar(32),
	"email" varchar(255),
	"city" varchar(120),
	"address" text,
	"notes" text,
	"status" "customer_status" DEFAULT 'new' NOT NULL,
	"language" varchar(8),
	"total_spent" integer DEFAULT 0 NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_settings" (
	"merchant_id" uuid PRIMARY KEY NOT NULL,
	"business_description" text,
	"opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_fee_default" integer DEFAULT 0 NOT NULL,
	"delivery_zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"delivery_eta_days_min" smallint,
	"delivery_eta_days_max" smallint,
	"free_shipping_threshold" integer,
	"return_policy" text,
	"exchange_policy" text,
	"faq" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"promotions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_instructions" text,
	"tone" varchar(32) DEFAULT 'professional' NOT NULL,
	"preferred_language" varchar(8) DEFAULT 'fr' NOT NULL,
	"currency" varchar(3) DEFAULT 'MAD' NOT NULL,
	"default_payment_method" "payment_method" DEFAULT 'cod' NOT NULL,
	"default_handoff_mode" "handoff_mode" DEFAULT 'ai' NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"upsell_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"business_name" varchar(160),
	"email" varchar(255) NOT NULL,
	"phone" varchar(32),
	"password_hash" varchar(255) NOT NULL,
	"status" "merchant_status" DEFAULT 'pending' NOT NULL,
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"subscription_status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"subscription_plan" "plan" DEFAULT 'starter' NOT NULL,
	"locale" varchar(8) DEFAULT 'fr-MA' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Africa/Casablanca' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"sender_type" "sender_type" NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"language" varchar(8),
	"ai_generated" boolean DEFAULT false NOT NULL,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_used" integer,
	"external_id" varchar(191),
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"customer_id" uuid,
	"conversation_id" uuid,
	"reference" varchar(32) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'MAD' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'cod' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"order_status" "order_status" DEFAULT 'new' NOT NULL,
	"customer_name" varchar(160) NOT NULL,
	"customer_phone" varchar(32) NOT NULL,
	"city" varchar(120),
	"address" text,
	"notes" text,
	"status_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_ai" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" varchar(32) NOT NULL,
	"provider_payment_id" varchar(191),
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'MAD' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"invoice_number" varchar(64),
	"invoice_url" text,
	"failure_code" varchar(64),
	"failure_reason" text,
	"raw" jsonb,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "plan" NOT NULL,
	"name" varchar(64) NOT NULL,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer,
	"currency" varchar(3) DEFAULT 'MAD' NOT NULL,
	"trial_days" smallint DEFAULT 7 NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"category_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"sale_price" integer,
	"sku" varchar(64),
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"track_stock" boolean DEFAULT true NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weight_grams" integer,
	"search_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"plan_id" uuid,
	"plan" "plan" DEFAULT 'starter' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"interval" varchar(16) DEFAULT 'month' NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'MAD' NOT NULL,
	"provider" varchar(32),
	"provider_customer_id" varchar(191),
	"provider_subscription_id" varchar(191),
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"trial_start" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"metric" varchar(48) NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'agent' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settings" ADD CONSTRAINT "merchant_settings_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_merchant_created_idx" ON "audit_logs" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rules_merchant_type_uq" ON "automation_rules" USING btree ("merchant_id","type");--> statement-breakpoint
CREATE INDEX "automation_rules_merchant_enabled_idx" ON "automation_rules" USING btree ("merchant_id","enabled");--> statement-breakpoint
CREATE INDEX "automation_runs_scheduled_idx" ON "automation_runs" USING btree ("scheduled_for","status");--> statement-breakpoint
CREATE INDEX "automation_runs_merchant_rule_idx" ON "automation_runs" USING btree ("merchant_id","rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connections_merchant_provider_uq" ON "channel_connections" USING btree ("merchant_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_merchant_external_uq" ON "conversations" USING btree ("merchant_id","source","external_id");--> statement-breakpoint
CREATE INDEX "conversations_merchant_status_idx" ON "conversations" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "conversations_merchant_last_message_idx" ON "conversations" USING btree ("merchant_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_customer_idx" ON "conversations" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_merchant_phone_uq" ON "customers" USING btree ("merchant_id","phone");--> statement-breakpoint
CREATE INDEX "customers_merchant_idx" ON "customers" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "customers_merchant_last_interaction_idx" ON "customers" USING btree ("merchant_id","last_interaction_at");--> statement-breakpoint
CREATE INDEX "merchant_settings_merchant_idx" ON "merchant_settings" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_email_uq" ON "merchants" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_merchant_idx" ON "messages" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_merchant_reference_uq" ON "orders" USING btree ("merchant_id","reference");--> statement-breakpoint
CREATE INDEX "orders_merchant_status_idx" ON "orders" USING btree ("merchant_id","order_status");--> statement-breakpoint
CREATE INDEX "orders_merchant_created_idx" ON "orders" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_merchant_idx" ON "payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_uq" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_merchant_slug_uq" ON "product_categories" USING btree ("merchant_id","slug");--> statement-breakpoint
CREATE INDEX "product_categories_merchant_idx" ON "product_categories" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_merchant_status_idx" ON "products" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "products_merchant_name_idx" ON "products" USING btree ("merchant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_merchant_sku_uq" ON "products" USING btree ("merchant_id","sku");--> statement-breakpoint
CREATE INDEX "subscriptions_merchant_idx" ON "subscriptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_sub_uq" ON "subscriptions" USING btree ("provider","provider_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_records_merchant_period_metric_uq" ON "usage_records" USING btree ("merchant_id","period","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "users_merchant_email_uq" ON "users" USING btree ("merchant_id",lower("email"));--> statement-breakpoint
CREATE INDEX "users_merchant_idx" ON "users" USING btree ("merchant_id");