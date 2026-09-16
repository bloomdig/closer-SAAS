/**
 * Automatisation — activation, délai et message (§15).
 * `id` est ici le TYPE d’automatisation (upsert) : une règle par type et par
 * marchand, ce qui évite les doublons et les règles orphelines.
 */
import { requireMerchantApi, requireFeatureAccess, requireRole } from "@/lib/auth/guards";
import { logAudit, upsertAutomation } from "@/lib/repositories";
import {
  ApiError,
  bool,
  int,
  ok,
  readJson,
  str,
  throwIfInvalid,
  withErrorHandling,
  type FieldErrors,
} from "@/lib/api/validation-bridge";
import {
  AUTOMATION_LABELS_FR,
  DEFAULT_DELAY_MINUTES,
  DEFAULT_TEMPLATES_FR,
  TEMPLATE_VARIABLES,
  type AutomationType,
} from "@/lib/automation/types";
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { automationRules } from "@/db/schema";
import { DEFAULT_PLANS } from "@/lib/subscriptions/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling("automations.update", async (request: Request, ctx: Params) => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "automations:manage");

  const { id } = await ctx.params;
  if (!Object.keys(AUTOMATION_LABELS_FR).includes(id)) {
    throw new ApiError(404, "unknown_automation", "Type d’automatisation inconnu.");
  }
  const type = id as AutomationType;

  const body = await readJson<Record<string, unknown>>(request);
  const errors: FieldErrors = {};

  const enabled = bool(body.enabled, false);
  const delayMinutes = int(body.delayMinutes, "delayMinutes", {
    label: "Délai",
    min: 1,
    max: 43_200,
    fallback: DEFAULT_DELAY_MINUTES[type],
  }, errors);
  const messageTemplate = str(body.messageTemplate, "messageTemplate", {
    label: "Message",
    min: 5,
    max: 1000,
    optional: true,
  }, errors);
  const quietHoursStart = int(body.quietHoursStart, "quietHoursStart", { label: "Début heures calmes", min: 0, max: 23, optional: true }, errors);
  const quietHoursEnd = int(body.quietHoursEnd, "quietHoursEnd", { label: "Fin heures calmes", min: 0, max: 23, optional: true }, errors);
  const maxSendsPerCustomerPerDay = int(body.maxSendsPerCustomerPerDay, "maxSendsPerCustomerPerDay", { label: "Limite par client", min: 1, max: 5, optional: true }, errors);

  throwIfInvalid(errors);

  // Les automatisations sont une fonctionnalité payante : contrôle serveur (§19).
  if (enabled) requireFeatureAccess(authed, "automations");

  // Limite du nombre d’automatisations actives selon l’offre.
  if (enabled) {
    const plan = DEFAULT_PLANS.find((p) => p.slug === authed.merchant.subscriptionPlan);
    const limit = plan?.limits.automations ?? 2;

    const rules = await db
      .select({ type: automationRules.type, enabled: automationRules.enabled })
      .from(automationRules)
      .where(eq(automationRules.merchantId, authed.session.merchantId));

    const activeCount = rules.filter((r) => r.enabled).length;
    const alreadyActive = rules.some((r) => r.type === type && r.enabled);

    if (!alreadyActive && activeCount >= limit) {
      throw new ApiError(
        402,
        "automation_limit_reached",
        `Votre offre permet ${limit} automatisations actives. Désactivez-en une ou passez à l’offre supérieure.`,
      );
    }
  }

  const template = messageTemplate ?? DEFAULT_TEMPLATES_FR[type];
  const unknownVariables = [...template.matchAll(/{{\s*(\w+)\s*}}/g)]
    .map((m) => m[1])
    .filter((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v));

  if (unknownVariables.length > 0) {
    throw new ApiError(
      422,
      "invalid_template_variable",
      `Variable(s) inconnue(s) : ${unknownVariables.join(", ")}. Disponibles : ${TEMPLATE_VARIABLES.join(", ")}.`,
    );
  }

  const rule = await upsertAutomation(authed.session.merchantId, type, {
    name: AUTOMATION_LABELS_FR[type],
    enabled,
    delayMinutes: delayMinutes!,
    configuration: {
      messageTemplate: template,
      language: str(body.language, "language", { label: "Langue", max: 8, optional: true }, {}) ?? "auto",
      maxSendsPerCustomerPerDay: maxSendsPerCustomerPerDay ?? 1,
      quietHoursStart: quietHoursStart ?? 22,
      quietHoursEnd: quietHoursEnd ?? 9,
    },
  });

  await logAudit({
    merchantId: authed.session.merchantId,
    actorId: authed.session.userId,
    actorRole: authed.session.role,
    action: enabled ? "automation.enable" : "automation.disable",
    entityType: "automation_rule",
    entityId: rule.id,
    metadata: { type, delayMinutes: rule.delayMinutes },
  });

  return ok(rule);
});
