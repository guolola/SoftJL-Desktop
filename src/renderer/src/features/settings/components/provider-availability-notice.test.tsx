// Verifies on-demand setup guidance, dismissal, page changes and provider recovery.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { createAuthSessionResponse } from "@test/fixtures/contract-fixtures";
import { i18n } from "../../../shared/i18n/index.js";
import { patchUserSettings } from "../../../shared/lib/user-settings.js";
import { requestProviderRequiredNotice } from "../../../shared/lib/provider-required-notice.js";
import { AuthenticatedRouteSessionProvider } from "../../user-platform/components/authenticated-route-session.js";
import type { PlatformProviderConfig } from "../../user-platform/services/platform-api.js";
import { resolveManagedProviderSettingsSync } from "../../user-platform/components/managed-provider-settings-sync.js";
import { DEFAULT_USER_SETTINGS } from "../../../shared/lib/user-settings.js";
import { ProviderAvailabilityNotice } from "./provider-availability-notice.js";

const provider: PlatformProviderConfig = {
  id: "personal-1", name: "My provider", provider: "openai", baseUrl: "https://provider.example.test/v1",
  defaultModel: "chat", allowedModels: ["chat"], maskedKey: "sk-***", keyPurpose: "personal",
  status: "active", riskState: "low", quota: "personal", createdBy: "user-new", createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z", lastUsedAt: null, allowlisted: true, scopeType: "user", scopeId: "user-new",
};
const session = { ...createAuthSessionResponse(), mfa: { enabled: false, enforcement: "totp" as const } };
function view({ page = "one", onConfigure = vi.fn(), authenticated = true } = {}) {
  return <I18nextProvider i18n={i18n}>
    <AuthenticatedRouteSessionProvider value={authenticated ? session : null}>
      <ProviderAvailabilityNotice key={page} onConfigure={onConfigure} />
    </AuthenticatedRouteSessionProvider>
  </I18nextProvider>;
}
beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("zh-CN");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("only opens on request, stays at the bottom right and resets on page entry", async () => {
  const user = userEvent.setup();
  const mounted = render(view());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  act(requestProviderRequiredNotice);
  expect(screen.getByRole("alert")).toHaveTextContent("尚未配置可用的模型供应商");
  expect(document.querySelector('[data-slot="provider-notice-viewport"]')).toHaveClass("fixed", "right-4", "bottom-4");
  vi.useFakeTimers();
  act(() => { vi.advanceTimersByTime(120_000); });
  expect(screen.getByRole("alert")).toBeInTheDocument();
  vi.useRealTimers();
  await user.click(screen.getByRole("button", { name: "关闭" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  act(requestProviderRequiredNotice);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "稍后配置" }));
  mounted.rerender(view({ page: "two" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  act(requestProviderRequiredNotice);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

it("opens provider settings and disappears when usable settings are saved", async () => {
  const onConfigure = vi.fn();
  render(view({ onConfigure }));
  act(requestProviderRequiredNotice);
  await userEvent.click(await screen.findByRole("button", { name: "配置供应商" }));
  expect(onConfigure).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  act(requestProviderRequiredNotice);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  act(() => patchUserSettings({ providerConfigId: provider.id, defaultModel: "chat", providerModelOptions: ["chat"] }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

it("ignores setup requests before a session is available", () => {
  render(view({ authenticated: false }));
  act(requestProviderRequiredNotice);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("skips active providers with empty catalogs when selecting the managed default", () => {
  const resolved = resolveManagedProviderSettingsSync([
    { ...provider, id: "empty", name: "A empty", allowedModels: [] }, provider,
  ], DEFAULT_USER_SETTINGS);
  expect(resolved?.providerConfigId).toBe(provider.id);
  expect(resolved?.providerModelOptions).toEqual(["chat"]);
});
