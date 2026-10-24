// Builds the selected provider and model input for project conversation requests.
import { loadUserSettings } from "../../shared/lib/user-settings.js";
import { generationModelBlockedReason } from "../../shared/lib/generation-model.js";
export interface ProviderSettingsInput { providerConfigId: string; model: string; }
export function createProviderSettingsInput(): ProviderSettingsInput {
  const settings = loadUserSettings();
  const blockedReason = generationModelBlockedReason(settings);
  if (blockedReason) throw new Error(blockedReason);
  const providerConfigId = settings.providerConfigId.trim();
  const model = settings.defaultModel.trim();

  return {
    providerConfigId,
    model,
  };
}
