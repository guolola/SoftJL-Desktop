// Owns user-facing generation notifications and completion events.

import { i18n } from "../../../shared/i18n/i18n.js";
import { floatingAlert } from "../../../shared/ui/floating-alert.js";

export const GENERATION_COMPLETED_EVENT = "uml-generation-completed";

export function notifyGenerationCompleted(kind: "requirements" | "design") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GENERATION_COMPLETED_EVENT, {
        detail: { kind },
      }),
    );
  }
}

export function notifyGenerationResultStale() {
  floatingAlert.message(i18n.t("generation.resultStale"));
}
