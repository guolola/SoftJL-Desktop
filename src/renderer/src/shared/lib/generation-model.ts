// Shares model eligibility between generation controls and request builders; demo mode comes from project access.
import { i18n } from "../i18n/i18n.js";
import { loadUserSettings, type UserSettings } from "./user-settings.js";

export function generationModelBlockedReason(
  settings: Pick<UserSettings, "providerConfigId" | "defaultModel" | "providerModelOptions"> = loadUserSettings(),
): string | null {
  if (!settings.providerConfigId.trim()) {
    return i18n.t("generationModel.providerRequired");
  }
  const model = settings.defaultModel.trim();
  if (!model) return i18n.t("generationModel.modelRequired");
  if (!settings.providerModelOptions.some((option) => option.trim() === model)) {
    return i18n.t("generationModel.modelUnavailable");
  }
  return null;
}
