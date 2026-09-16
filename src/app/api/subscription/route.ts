/**
 * Abonnement — état courant, offres disponibles et ouverture d’un paiement (§18–§20).
 * =====================================================================
 * Les prix viennent de la table `plans` (jamais codés en dur).
 * Si aucun fournisseur de paiement marocain n’est configuré, la réponse
 * l’indique explicitement : aucun paiement n’est simulé.
 */
import { requireMerchantApi } from "@/lib/auth/guards";
import { listPayments, listPlans, getSubscription } from "@/lib/repositories";
import { ApiError, ok, withErrorHandling } from "@/lib/api/validation-bridge";
import { getPaymentProvider, isPaymentsConfigured } from "@/lib/payments/provider";
import { DEFAULT_PLANS, formatMad, type PlanSlug } from "@/lib/subscriptions/plans";
import { evaluateAccess } from "@/lib/subscriptions/access";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("subscription.get", async () => {
  const authed = await requireMerchantApi();

  const [subscription, planRows, paymentRows] = await Promise.all([
    getSubscription(authed.session.merchantId),
    listPlans(),
    listPayments(authed.session.merchantId, 12),
  ]);

  // Les offres de la base priment ; à défaut, les valeurs par défaut.
  const offers = planRows.length
    ? planRows.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceMonthlyLabel: formatMad(plan.priceMonthly),
        priceYearly: plan.priceYearly,
        priceYearlyLabel: plan.priceYearly ? formatMad(plan.priceYearly) : null,
        currency: plan.currency,
        trialDays: plan.trialDays,
        limits: plan.limits,
        features: plan.features,
        position: plan.position,
        isActive: plan.isActive,
      }))
    : DEFAULT_PLANS.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceMonthlyLabel: formatMad(plan.priceMonthly),
        priceYearly: plan.priceYearly,
        priceYearlyLabel: plan.priceYearly ? formatMad(plan.priceYearly) : null,
        currency: plan.currency,
        trialDays: plan.trialDays,
        limits: plan.limits,
        features: plan.features,
        position: plan.position,
        isActive: true,
      }));

  return ok({
    current: subscription,
    access: authed.access,
    offers,
    payments: paymentRows,
    paymentProvider: {
      configured: isPaymentsConfigured(),
      name: getPaymentProvider().name,
      message: isPaymentsConfigured()
        ? null
        : "Fournisseur de paiement non configuré. Le paiement en ligne n’est pas encore disponible : l’architecture est prête et sera activée dès le branchement d’un prestataire marocain.",
    },
  });
});

/**
 * Ouvre une session de paiement pour changer d’offre.
 * Renvoie 503 tant qu’aucun prestataire marocain n’est branché (§41).
 */
export const POST = withErrorHandling("subscription.checkout", async (request: Request) => {
  const authed = await requireMerchantApi();

  const provider = getPaymentProvider();
  if (!provider.getStatus().configured) {
    throw new ApiError(
      503,
      "payment_provider_not_configured",
      "Fournisseur de paiement non configuré. Vous ne pouvez pas encore payer en ligne — aucune transaction n’a été effectuée.",
    );
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: unknown };
  const planSlug = typeof body.plan === "string" ? (body.plan as PlanSlug) : "pro";
  const planDefinition = DEFAULT_PLANS.find((p) => p.slug === planSlug);
  if (!planDefinition) {
    throw new ApiError(422, "unknown_plan", "Offre inconnue.");
  }

  let subscription = await getSubscription(authed.session.merchantId);
  if (!subscription) {
    const [created] = await db
      .insert(subscriptions)
      .values({
        merchantId: authed.session.merchantId,
        plan: planSlug,
        status: "trialing",
        interval: "month",
        amount: planDefinition.priceMonthly,
        currency: "MAD",
      })
      .returning();
    subscription = created;
  }

  const session = await provider.createCheckout({
    merchantId: authed.session.merchantId,
    subscriptionId: subscription.id,
    plan: planSlug,
    amount: planDefinition.priceMonthly,
    currency: "MAD",
    interval: "month",
    customerEmail: authed.merchant.email,
    customerName: authed.merchant.businessName ?? authed.merchant.name,
    successUrl: `${process.env.APP_URL ?? ""}/dashboard/subscription?status=success`,
    cancelUrl: `${process.env.APP_URL ?? ""}/dashboard/subscription?status=cancelled`,
    reference: `sub_${subscription.id}`,
  });

  return ok({ checkoutUrl: session.url, provider: session.provider });
});
