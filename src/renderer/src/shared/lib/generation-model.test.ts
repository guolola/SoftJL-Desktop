// Covers real-model eligibility and the explicit demo exemption independently of page state.
import { afterEach, describe, expect, it } from "vitest";
import { generationModelBlockedReason } from "./generation-model.js";
import { loadUserSettings, USER_SETTINGS_STORAGE_KEY } from "./user-settings.js";

afterEach(() => localStorage.clear());
describe("generation model eligibility", () => {
  const valid = { providerConfigId: "provider-1", defaultModel: "model-1", providerModelOptions: ["model-1"] };
  it.each([
    [{ ...valid, providerConfigId: "" }, "供应商"],
    [{ ...valid, defaultModel: "" }, "选择用于生成的模型"],
    [{ ...valid, defaultModel: "removed" }, "已不可用"],
    [{ ...valid, providerModelOptions: [] }, "已不可用"],
  ])("blocks invalid real settings %# but allows explicit demos", (settings, reason) => {
    expect(generationModelBlockedReason(settings)).toContain(reason);
  });
  it("accepts a valid current catalog selection", () => {
    expect(generationModelBlockedReason(valid)).toBeNull();
  });
  it.each(["", "removed"])("does not silently replace a missing or retired selection: %s", (defaultModel) => {
    localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify({ ...valid, defaultModel }));
    expect(loadUserSettings().defaultModel).toBe(defaultModel);
    expect(generationModelBlockedReason()).not.toBeNull();
  });
});
