/**
 * Webhook de paiement — fournisseur marocain (§20, addendum paiement).
 * =====================================================================
 *  - aucun Stripe : le fournisseur est résolu via l’abstraction `PaymentProvider`
 *  - la signature est vérifiée par le fournisseur AVANT tout traitement
 *  - si aucun fournisseur n’est configuré → 503 explicite, rien n’est simulé
 *  - idempotence : un `eventId` déjà traité est ignoré
 *  - aucune donnée de carte n’est stockée, seulement des références
 */
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, subscriptions, merchants } from "@/db/schema";
import {
  getPaymentProvider,
  isPaymentsConfigured,
  type NormalizedWebhookEvent,
} from "@/lib/payments/provider";
import { readRawBody, withErrorHandling } from "@/lib/api/respond";
import { logAudit } from "@/lib/repositories";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withErrorHandling("webhooks.payments", async (request: NextRequest) => {
  enforceRateLimit(clientKey(request, "webhook-payments"), RATE_LIMITS.webhook);

  if (!isPaymentsConfigured()) {
    console.warn("[webhook:payments] reçu alors qu’aucun fournisseur n’est configuré");
    return NextResponse.json(
      { error: "Fournisseur de paiement non configuré." },
      { status: 503 },
    );
  }

  const provider = getPaymentProvider();
  const rawBody = await readRawBody(request, 512_000);
  const signature =
    request.headers.get("x-webhook-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("x-payzone-signature");

  let event: NormalizedWebhookEvent;
  try {
    event = await provider.verifyWebhook(rawBody, signature);
  } catch (error) {
    console.warn("[webhook:payments] signature invalide :", error);
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  // Idempotence : ne jamais traiter deux fois le même événement.
  const alreadyProcessed = await db.query.payments.findFirst({
    where: and(
      eq(payments.provider, event.provider),
      eq(payments.providerPaymentId, event.eventId),
    ),
    columns: { id: true },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const subscription = event.providerSubscriptionId
    ? await db.query.subscriptions.findFirst({
        where: eq(subscriptions.providerSubscriptionId, event.providerSubscriptionId),
      })
    : event.subscriptionId
      ? await db.query.subscriptions.findFirst({
          where: eq(subscriptions.id, event.subscriptionId),
        })
      : null;

  const merchantId = subscription?.merchantId ?? event.merchantId ?? null;

  switch (event.kind) {
    case "payment.succeeded":
    case "checkout.completed": {
      if (!merchantId || !subscription) {
        console.warn("[webhook:payments] paiement sans abonnement correspondant");
        break;
      }

      const periodEnd = event.periodEnd ? new Date(event.periodEnd) : addMonths(new Date(), 1);
      const periodStart = event.periodStart ? new Date(event.periodStart) : new Date();

      await db
        .update(subscriptions)
        .set({
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          providerCustomerId: event.providerCustomerId ?? subscription.providerCustomerId,
          providerSubscriptionId:
            event.providerSubscriptionId ?? subscription.providerSubscriptionId,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      await db
        .update(merchants)
        .set({ subscriptionStatus: "active", status: "active", updatedAt: new Date() })
        .where(eq(merchants.id, merchantId));

      await db.insert(payments).values({
        merchantId,
        subscriptionId: subscription.id,
        provider: event.provider,
        providerPaymentId: event.providerPaymentId ?? event.eventId,
        amount: event.amount ?? subscription.amount,
        currency: event.currency ?? subscription.currency,
        status: "paid",
        invoiceUrl: event.invoiceUrl ?? null,
        raw: event.raw as never,
        paidAt: new Date(),
      });

      await logAudit({
        merchantId,
        action: "payment.succeeded",
        entityType: "subscription",
        entityId: subscription.id,
        metadata: { amount: event.amount, provider: event.provider },
      });
      break;
    }

    case "payment.failed": {
      if (!merchantId || !subscription) break;

      await db
        .update(subscriptions)
        .set({ status: "payment_failed", updatedAt: new Date() })
        .where(eq(subscriptions.id, subscription.id));

      await db
        .update(merchants)
        .set({ subscriptionStatus: "payment_failed", updatedAt: new Date() })
        .where(eq(merchants.id, merchantId));

      await db.insert(payments).values({
        merchantId,
        subscriptionId: subscription.id,
        provider: event.provider,
        providerPaymentId: event.providerPaymentId ?? event.eventId,
        amount: event.amount ?? subscription.amount,
        currency: event.currency ?? subscription.currency,
        status: "failed",
        failureCode: event.failureCode ?? null,
        failureReason: event.failureReason ?? null,
        raw: event.raw as never,
      });

      await logAudit({
        merchantId,
        action: "payment.failed",
        entityType: "subscription",
        entityId: subscription.id,
        metadata: { code: event.failureCode },
      });
      break;
    }

    case "subscription.cancelled": {
      if (!merchantId || !subscription) break;

      await db
        .update(subscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      await db
        .update(merchants)
        .set({ subscriptionStatus: "cancelled", updatedAt: new Date() })
        .where(eq(merchants.id, merchantId));

      await logAudit({ merchantId, action: "subscription.cancelled", entityType: "subscription", entityId: subscription.id });
      break;
    }

    case "subscription.renewed": {
      if (!merchantId || !subscription) break;

      await db
        .update(subscriptions)
        .set({
          status: "active",
          currentPeriodStart: event.periodStart ? new Date(event.periodStart) : new Date(),
          currentPeriodEnd: event.periodEnd ? new Date(event.periodEnd) : addMonths(new Date(), 1),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      await logAudit({ merchantId, action: "subscription.renewed", entityType: "subscription", entityId: subscription.id });
      break;
    }

    default:
      console.info(`[webhook:payments] événement ignoré : ${event.kind}`);
  }

  return NextResponse.json({ received: true });
});

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
