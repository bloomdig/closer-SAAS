/**
 * Automatisations par défaut créées à l’inscription d’un marchand (§15).
 * Toutes désactivées au départ : le marchand active ce qu’il veut.
 */
import {
  AUTOMATION_LABELS_FR,
  DEFAULT_DELAY_MINUTES,
  DEFAULT_TEMPLATES_FR,
  type AutomationType,
} from "./types";

export type DefaultAutomation = {
  type: AutomationType;
  name: string;
  delayMinutes: number;
  template: string;
};

const TYPES: AutomationType[] = [
  "abandoned_conversation",
  "order_confirmation",
  "delivery_followup",
  "review_request",
  "cross_sell",
  "repeat_purchase",
];

export const DEFAULT_AUTOMATIONS: DefaultAutomation[] = TYPES.map((type) => ({
  type,
  name: AUTOMATION_LABELS_FR[type],
  delayMinutes: DEFAULT_DELAY_MINUTES[type],
  template: DEFAULT_TEMPLATES_FR[type],
}));
