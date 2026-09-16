/**
 * Conversation — détail complet pour l’espace de travail (§28).
 * Renvoie la conversation, les messages paginés, le client, ses commandes
 * et les brouillons IA en attente de validation.
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import {
  getConversationWithCustomer,
  listDrafts,
  listMessages,
  markConversationRead,
} from "@/lib/repositories";
import { notFound, ok, withErrorHandling } from "@/lib/api/respond";
import { db } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { orders } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = withErrorHandling("conversations.get", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") ?? 50) || 50));

  const found = await getConversationWithCustomer(authed.session.merchantId, id);
  if (!found) throw notFound("Conversation introuvable.");

  const [messages, drafts, customerOrders] = await Promise.all([
    listMessages(authed.session.merchantId, id, { limit }),
    listDrafts(authed.session.merchantId, id),
    found.customer
      ? db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.merchantId, authed.session.merchantId),
              eq(orders.customerId, found.customer.id),
            ),
          )
          .orderBy(desc(orders.createdAt))
          .limit(10)
      : Promise.resolve([]),
  ]);

  // Ouverture de la conversation = messages lus.
  if (found.conversation.unreadCount > 0) {
    await markConversationRead(authed.session.merchantId, id);
  }

  return ok({
    conversation: { ...found.conversation, unreadCount: 0 },
    customer: found.customer,
    messages,
    drafts,
    customerOrders,
  });
});
