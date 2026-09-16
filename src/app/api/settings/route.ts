/**
 * Réglages de la boutique (§3, §8) — ce que l’IA utilise comme contexte.
 * Lecture : tous les rôles. Écriture : propriétaire et administrateurs.
 */
import { requireMerchantApi, requireRole } from "@/lib/auth/guards";
import { getSettings, logAudit, upsertSettings } from "@/lib/repositories";
import {
  arrayField,
  bool,
  int,
  isRecord,
  madAmount,
  notFound,
  ok,
  oneOf,
  readJson,
  str,
  throwIfInvalid,
  withErrorHandling,
  type FieldErrors,
} from "@/lib/api/validation-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("settings.get", async () => {
  const authed = await requireMerchantApi();
  const settings = await getSettings(authed.session.merchantId);
  if (!settings) throw notFound("Réglages introuvables.");
  return ok(settings);
});

const TONES = ["professional", "friendly", "direct", "warm"] as const;
const LANGUAGES = ["fr", "ar", "darija", "auto"] as const;
const HANDOFF = ["ai", "approval", "manual"] as const;
const PAYMENT = ["cod", "card", "bank_transfer", "wallet"] as const;

export const PATCH = withErrorHandling("settings.update", async (request: Request) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "settings:manage");

  const body = await readJson<Record<string, unknown>>(request);
  const errors: FieldErrors = {};
  const patch: Record<string, unknown> = {};

  if (body.businessDescription !== undefined) {
    patch.businessDescription = str(body.businessDescription, "businessDescription", { label: "Description de l’activité", max: 4000, optional: true }, errors) ?? null;
  }
  if (body.returnPolicy !== undefined) {
    patch.returnPolicy = str(body.returnPolicy, "returnPolicy", { label: "Politique de retour", max: 4000, optional: true }, errors) ?? null;
  }
  if (body.exchangePolicy !== undefined) {
    patch.exchangePolicy = str(body.exchangePolicy, "exchangePolicy", { label: "Politique d’échange", max: 4000, optional: true }, errors) ?? null;
  }
  if (body.customInstructions !== undefined) {
    patch.customInstructions = str(body.customInstructions, "customInstructions", { label: "Instructions pour l’IA", max: 4000, optional: true }, errors) ?? null;
  }
  if (body.deliveryFeeDefault !== undefined) {
    patch.deliveryFeeDefault = madAmount(body.deliveryFeeDefault, "deliveryFeeDefault", "Frais de livraison", errors, { max: 100000 }) ?? 0;
  }
  if (body.freeShippingThreshold !== undefined) {
    patch.freeShippingThreshold = madAmount(body.freeShippingThreshold, "freeShippingThreshold", "Seuil de livraison offerte", errors, { optional: true, max: 10000000 }) ?? null;
  }
  if (body.deliveryEtaDaysMin !== undefined) {
    patch.deliveryEtaDaysMin = int(body.deliveryEtaDaysMin, "deliveryEtaDaysMin", { label: "Délai minimum", min: 0, max: 60, optional: true }, errors) ?? null;
  }
  if (body.deliveryEtaDaysMax !== undefined) {
    patch.deliveryEtaDaysMax = int(body.deliveryEtaDaysMax, "deliveryEtaDaysMax", { label: "Délai maximum", min: 0, max: 60, optional: true }, errors) ?? null;
  }
  if (body.tone !== undefined) patch.tone = oneOf(body.tone, TONES, "tone", "Ton", errors);
  if (body.preferredLanguage !== undefined) patch.preferredLanguage = oneOf(body.preferredLanguage, LANGUAGES, "preferredLanguage", "Langue préférée", errors);
  if (body.currency !== undefined) {
    const currency = str(body.currency, "currency", { label: "Devise", max: 3 }, errors)?.toUpperCase();
    if (currency && currency !== "MAD") errors.currency = "Seule la devise MAD est prise en charge.";
    else if (currency) patch.currency = currency;
  }
  if (body.defaultPaymentMethod !== undefined) patch.defaultPaymentMethod = oneOf(body.defaultPaymentMethod, PAYMENT, "defaultPaymentMethod", "Mode de paiement", errors);
  if (body.defaultHandoffMode !== undefined) patch.defaultHandoffMode = oneOf(body.defaultHandoffMode, HANDOFF, "defaultHandoffMode", "Mode de traitement", errors);
  if (body.aiEnabled !== undefined) patch.aiEnabled = bool(body.aiEnabled);
  if (body.upsellEnabled !== undefined) patch.upsellEnabled = bool(body.upsellEnabled);

  if (body.openingHours !== undefined) {
    patch.openingHours = arrayField(body.openingHours, "openingHours", "Heures d’ouverture", errors, (raw) => (isRecord(raw) ? raw : undefined), { max: 14 }) ?? [];
  }
  if (body.deliveryZones !== undefined) {
    patch.deliveryZones = arrayField(
      body.deliveryZones,
      "deliveryZones",
      "Zones de livraison",
      errors,
      (raw) => {
        if (!isRecord(raw)) return undefined;
        const zoneName = str(raw.city, "city", { label: "Ville", max: 120 }, errors);
        if (!zoneName) return undefined;
        const fee = madAmount(raw.fee, "fee", "Frais", errors, { max: 100000 }) ?? 0;
        return {
          city: zoneName,
          fee,
          eta: str(raw.eta, "eta", { label: "Délai", max: 40, optional: true }, errors) ?? null,
          enabled: bool(raw.enabled, true),
        };
      },
      { max: 80 },
    ) ?? [];
  }
  if (body.faq !== undefined) {
    patch.faq = arrayField(
      body.faq,
      "faq",
      "FAQ",
      errors,
      (raw) => {
        if (!isRecord(raw)) return undefined;
        const question = str(raw.question, "question", { label: "Question", min: 3, max: 300 }, errors);
        const answer = str(raw.answer, "answer", { label: "Réponse", min: 3, max: 2000 }, errors);
        if (!question || !answer) return undefined;
        return { question, answer };
      },
      { max: 50 },
    ) ?? [];
  }
  if (body.promotions !== undefined) {
    patch.promotions = arrayField(
      body.promotions,
      "promotions",
      "Promotions",
      errors,
      (raw) => {
        if (!isRecord(raw)) return undefined;
        const title = str(raw.title, "title", { label: "Titre", min: 2, max: 160 }, errors);
        if (!title) return undefined;
        return {
          title,
          description: str(raw.description, "description", { label: "Description", max: 500, optional: true }, errors) ?? null,
          code: str(raw.code, "code", { label: "Code promo", max: 40, optional: true }, errors) ?? null,
          discountCents: raw.discountCents !== undefined ? (madAmount(raw.discountCents, "discountCents", "Remise", errors, { optional: true, max: 10000000 }) ?? 0) : 0,
          startsAt: str(raw.startsAt, "startsAt", { label: "Début", max: 40, optional: true }, errors) ?? null,
          endsAt: str(raw.endsAt, "endsAt", { label: "Fin", max: 40, optional: true }, errors) ?? null,
          active: bool(raw.active, true),
        };
      },
      { max: 20 },
    ) ?? [];
  }

  throwIfInvalid(errors);

  const etaMin = (patch.deliveryEtaDaysMin as number | undefined) ?? undefined;
  const etaMax = (patch.deliveryEtaDaysMax as number | undefined) ?? undefined;
  if (etaMin !== undefined && etaMax !== undefined && etaMin > etaMax) {
    throw new Error("Le délai minimum ne peut pas dépasser le délai maximum.");
  }

  const updated = await upsertSettings(authed.session.merchantId, patch);

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: "settings.update",
    entityType: "merchant_settings",
    entityId: authed.session.merchantId,
    metadata: { fields: Object.keys(patch) },
  });

  return ok(updated);
});
