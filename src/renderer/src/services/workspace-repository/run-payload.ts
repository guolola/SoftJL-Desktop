// Localizes structured run failures for workspace repository operations.
import type { RunError } from "../../../../shared/contracts/index.js";
import { localizeRunFailure } from "../../shared/i18n/api-errors.js";

export function snapshotErrorMessage(
  snapshot: { error?: RunError | null },
  fallback: string,
) {
  return snapshot.error
    ? localizeRunFailure(snapshot.error, fallback)
    : fallback;
}
