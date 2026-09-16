/** Automatisations — liste des règles du marchand (§15). */
import { requireMerchantApi, requireRole } from "@/lib/auth/guards";
import { listAutomations } from "@/lib/repositories";
import { ok, withErrorHandling } from "@/lib/api/validation-bridge";
import {
  AUTOMATION_DESCRIPTIONS_FR,
  AUTOMATION_LABELS_FR,
  DEFAULT_DELAY_MINUTES,
  DEFAULT_TEMPLATES_FR,
} from "@/lib/automation/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withErrorHandling("automations.list", async () => {
  const authed = await requireMerchantApi();
  requireRole(authed.session, "automations:read");

  const rules = await listAutomations(authed.session.merchantId);

  // Les 6 types sont toujours renvoyés : une règle absente est présentée
  // comme désactivée avec ses valeurs par défaut (aucun bouton mort).
  const types = Object.keys(AUTOMATION_LABELS_FR) as (keyof typeof AUTOMATION_LABELS_FR)[];

  const merged = types.map((type) => {
    const rule = rules.find((r) => r.type === type);
    return {
      type,
      label: AUTOMATION_LABELS_FR[type],
      description: AUTOMATION_DESCRIPTIONS_FR[type],
      defaultDelayMinutes: DEFAULT_DELAY_MINUTES[type],
      defaultTemplate: DEFAULT_TEMPLATES_FR[type],
      rule: rule ?? null,
      enabled: rule?.enabled ?? false,
      delayMinutes: rule?.delayMinutes ?? DEFAULT_DELAY_MINUTES[type],
      configuration: rule?.configuration ?? {
        messageTemplate: DEFAULT_TEMPLATES_FR[type],
        language: "auto",
        maxSendsPerCustomerPerDay: 1,
        quietHoursStart: 22,
        quietHoursEnd: 9,
      },
    };
  });

  return ok(merged);
});
