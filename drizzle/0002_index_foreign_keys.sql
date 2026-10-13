CREATE INDEX "automation_runs_rule_idx" ON "public"."automation_runs" USING btree ("rule_id");
--> statement-breakpoint
CREATE INDEX "automation_runs_conversation_idx" ON "public"."automation_runs" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "conversations_assigned_agent_idx" ON "public"."conversations" USING btree ("assigned_agent_id");
--> statement-breakpoint
CREATE INDEX "orders_conversation_idx" ON "public"."orders" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX "payments_subscription_idx" ON "public"."payments" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "public"."products" USING btree ("category_id");
--> statement-breakpoint
CREATE INDEX "subscriptions_plan_idx" ON "public"."subscriptions" USING btree ("plan_id");
