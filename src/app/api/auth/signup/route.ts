/**
 * Inscription marchand — crée le compte, les réglages par défaut marocains,
 * l’abonnement d’essai de 7 jours et les automatisations de base.
 *
 * Corrige : S2 (requête ciblée au lieu de la table entière), S4 (e-mail
 * normalisé + contrainte d’unicité), S5 (force du mot de passe, limitation de
 * débit, bcrypt 12), S6 (aucun message d’erreur interne renvoyé), D5 (plus de
 * `verified: true` mensonger).
 */
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { automationRules, merchants, plans, subscriptions } from "@/db/schema";
import { ApiError, created, readJson, withErrorHandling } from "@/lib/api/respond";
import { BCRYPT_ROUNDS, createMerchantSession } from "@/lib/auth/session";
import { clientKey, enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  email as emailField,
  password as passwordField,
  phone as phoneField,
  str,
  throwIfInvalid,
  type FieldErrors,
} from "@/lib/validation";
import { DEFAULT_PLANS, DEFAULT_TRIAL_DAYS } from "@/lib/subscriptions/plans";
import { DEFAULT_AUTOMATIONS } from "@/lib/automation/defaults";
import { logAudit, upsertSettings } from "@/lib/repositories";

export const dynamic = "force-dynamic";

type SignupBody = {
  fullName?: unknown;
  businessName?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
  city?: unknown;
};

export const POST = withErrorHandling("auth.signup", async (request: Request) => {
  enforceRateLimit(clientKey(request, "signup"), RATE_LIMITS.signup);

  const body = await readJson<SignupBody>(request);
  const errors: FieldErrors = {};

  const fullName = str(body.fullName, "fullName", { label: "Nom complet", min: 2, max: 120 }, errors);
  const businessName = str(body.businessName, "businessName", { label: "Nom de l’entreprise", min: 2, max: 160 }, errors);
  const emailValue = emailField(body.email, "email", "Adresse e-mail", errors);
  const phoneValue = phoneField(body.phone, "phone", "Numéro de téléphone", errors);
  const passwordValue = passwordField(body.password, "password", errors);
  const cityValue = str(body.city, "city", { label: "Ville", max: 120, optional: true }, errors);

  throwIfInvalid(errors);

  // Unicité vérifiée en base, sur l’e-mail normalisé (index unique en minuscules).
  const existing = await db.query.merchants.findFirst({
    where: eq(sql`lower(${merchants.email})`, emailValue!.toLowerCase()),
    columns: { id: true },
  });
  if (existing) {
    throw new ApiError(
      409,
      "email_exists",
      "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
    );
  }

  const passwordHash = await bcrypt.hash(passwordValue!, BCRYPT_ROUNDS);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + DEFAULT_TRIAL_DAYS * 86_400_000);

  const [merchant] = await db
    .insert(merchants)
    .values({
      name: fullName!,
      businessName: businessName!,
      email: emailValue!,
      phone: phoneValue!,
      passwordHash,
      status: "active",
      trialStartedAt: now,
      trialEndsAt,
      subscriptionStatus: "trialing",
      subscriptionPlan: "starter",
      locale: "fr-MA",
      timezone: "Africa/Casablanca",
      isDemo: false,
    })
    .returning();

  // Réglages par défaut adaptés au marché marocain (§30).
  await upsertSettings(merchant.id, {
    businessDescription: `${businessName} — boutique en ligne au Maroc.`,
    openingHours: [
      { day: "monday", open: "09:00", close: "20:00", closed: false },
      { day: "tuesday", open: "09:00", close: "20:00", closed: false },
      { day: "wednesday", open: "09:00", close: "20:00", closed: false },
      { day: "thursday", open: "09:00", close: "20:00", closed: false },
      { day: "friday", open: "09:00", close: "20:00", closed: false },
      { day: "saturday", open: "09:00", close: "20:00", closed: false },
      { day: "sunday", open: "00:00", close: "00:00", closed: true },
    ],
    deliveryFeeDefault: 3000, // 30 DH
    deliveryZones: [
      { city: cityValue ?? "Casablanca", fee: 2000, eta: "24 h", enabled: true },
      { city: "Rabat", fee: 3000, eta: "24-48 h", enabled: true },
      { city: "Marrakech", fee: 3500, eta: "48 h", enabled: true },
      { city: "Fès", fee: 3500, eta: "48 h", enabled: true },
      { city: "Tanger", fee: 3500, eta: "48 h", enabled: true },
    ],
    deliveryEtaDaysMin: 1,
    deliveryEtaDaysMax: 3,
    freeShippingThreshold: 50000, // 500 DH
    returnPolicy: "Retour possible sous 7 jours, produit non porté et dans son emballage.",
    exchangePolicy: "Échange possible sous 14 jours selon disponibilité.",
    faq: [
      {
        question: "Comment passer commande ?",
        answer: "Il suffit de me donner le produit, la taille ou la couleur, votre nom, votre ville et votre adresse. Le paiement se fait à la livraison.",
      },
      {
        question: "Quel est le mode de paiement ?",
        answer: "Paiement à la livraison (COD) partout au Maroc.",
      },
      {
        question: "Quels sont les délais de livraison ?",
        answer: "1 à 3 jours ouvrables selon la ville.",
      },
    ],
    promotions: [],
    customInstructions: "",
    tone: "professional",
    preferredLanguage: "fr",
    currency: "MAD",
    defaultPaymentMethod: "cod",
    defaultHandoffMode: "ai",
    aiEnabled: true,
    upsellEnabled: true,
  });

  // Abonnement d’essai rattaché à l’offre Starter.
  const starterPlan =
    (await db.query.plans.findFirst({ where: eq(plans.slug, "starter") })) ?? null;
  const starterDefinition = DEFAULT_PLANS[0];

  await db.insert(subscriptions).values({
    merchantId: merchant.id,
    planId: starterPlan?.id ?? null,
    plan: "starter",
    status: "trialing",
    interval: "month",
    amount: starterPlan?.priceMonthly ?? starterDefinition.priceMonthly,
    currency: "MAD",
    provider: null,
    trialStart: now,
    trialEnd: trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
  });

  // Automatisations de base, désactivées par défaut (le marchand choisit).
  for (const automation of DEFAULT_AUTOMATIONS) {
    await db
      .insert(automationRules)
      .values({
        merchantId: merchant.id,
        type: automation.type,
        name: automation.name,
        enabled: false,
        delayMinutes: automation.delayMinutes,
        configuration: {
          messageTemplate: automation.template,
          language: "auto",
          maxSendsPerCustomerPerDay: 1,
          quietHoursStart: 22,
          quietHoursEnd: 9,
        },
      })
      .onConflictDoNothing();
  }

  await createMerchantSession({
    merchantId: merchant.id,
    userId: merchant.id,
    role: "owner",
    email: merchant.email,
    name: merchant.name,
  });

  await logAudit({
    merchantId: merchant.id,
    actorId: merchant.id,
    actorRole: "owner",
    action: "merchant.signup",
    entityType: "merchant",
    entityId: merchant.id,
  });

  return created({
    merchantId: merchant.id,
    trialEndsAt: trialEndsAt.toISOString(),
    trialDays: DEFAULT_TRIAL_DAYS,
  });
});

export const runtime = "nodejs";
