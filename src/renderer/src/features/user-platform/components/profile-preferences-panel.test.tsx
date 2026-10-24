// Verifies deferred profile edits, upload validation and propagation to the shared local user.
import { createRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "../../../shared/i18n/index.js";
import type { GlobalSettingsActions } from "../../settings/components/global-settings-panel.js";
import { platformApi, type PlatformAccountProfileResponse } from "../services/platform-api.js";
import { AuthenticatedRouteSessionProvider } from "./authenticated-route-session.js";
import { ProfilePreferencesPanel } from "./profile-preferences-panel.js";

const user = { id: "local", username: "Admin", displayName: "Admin", status: "active", mfaEnabled: false };
const response = (changes = {}) => ({ user: { ...user, ...changes }, mfa: { enabled: false, enforcement: "totp" } } as PlatformAccountProfileResponse);
beforeEach(async () => { await i18n.changeLanguage("zh-CN"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount() {
  const actions = createRef<GlobalSettingsActions>();
  const updateUser = vi.fn(), dirty = vi.fn();
  render(<AuthenticatedRouteSessionProvider value={response()} onUserUpdate={updateUser}>
    <ProfilePreferencesPanel ref={actions} user={user} onDirtyChange={dirty} onBusyChange={() => {}} />
    <button onClick={() => actions.current?.save()}>提交资料</button>
    <button onClick={() => actions.current?.reset()}>重置资料</button>
  </AuthenticatedRouteSessionProvider>);
  return { updateUser, dirty };
}
it("saves name and bundled avatar only on request and updates the shared user", async () => {
  const save = vi.spyOn(platformApi, "updateAccountProfile").mockResolvedValue(response({ displayName: "新名字", avatarUrl: "/avatars/hachiware-guitar.gif" }));
  const { updateUser, dirty } = mount();
  const keyboard = userEvent.setup();
  await keyboard.clear(screen.getByLabelText("昵称"));
  await keyboard.type(screen.getByLabelText("昵称"), "新名字");
  await keyboard.click(screen.getByRole("button", { name: "小八弹吉他" }));
  expect(save).not.toHaveBeenCalled();
  await keyboard.click(screen.getByRole("button", { name: "提交资料" }));
  await waitFor(() => expect(updateUser).toHaveBeenCalledWith(response({ displayName: "新名字", avatarUrl: "/avatars/hachiware-guitar.gif" }).user));
  expect(save).toHaveBeenCalledWith({ displayName: "新名字", avatarUrl: "/avatars/hachiware-guitar.gif" });
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
});
it("keeps a rejected name draft available for retry or reset", async () => {
  const save = vi.spyOn(platformApi, "updateAccountProfile").mockRejectedValue(new Error("保存失败"));
  const { updateUser } = mount();
  await userEvent.clear(screen.getByLabelText("昵称"));
  await userEvent.type(screen.getByLabelText("昵称"), "未保存名字");
  await userEvent.click(screen.getByRole("button", { name: "提交资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
  expect(screen.getByLabelText("昵称")).toHaveValue("未保存名字");
  expect(updateUser).not.toHaveBeenCalled();
  save.mockResolvedValue(response({ displayName: "未保存名字" }));
  await userEvent.click(screen.getByRole("button", { name: "提交资料" }));
  await waitFor(() => expect(updateUser).toHaveBeenCalledOnce());
  await userEvent.clear(screen.getByLabelText("昵称"));
  await userEvent.click(screen.getByRole("button", { name: "重置资料" }));
  expect(screen.getByLabelText("昵称")).toHaveValue("未保存名字");
});
it("rejects empty names and oversized avatar uploads without sending requests", async () => {
  const save = vi.spyOn(platformApi, "updateAccountProfile");
  const upload = vi.spyOn(platformApi, "uploadAccountAvatar");
  mount();
  await userEvent.clear(screen.getByLabelText("昵称"));
  await userEvent.click(screen.getByRole("button", { name: "提交资料" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
  await userEvent.upload(screen.getByLabelText("更换头像"), file);
  expect(screen.getByRole("alert")).toHaveTextContent("2MB");
  expect(save).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

it("uploads once and retries a rejected name without resubmitting the local avatar URL", async () => {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:profile-preview"; }
    static revokeObjectURL() {}
  });
  const avatarUrl = "http://127.0.0.1:4101/api/account/avatars/local.png";
  const upload = vi.spyOn(platformApi, "uploadAccountAvatar").mockResolvedValue(response({ avatarUrl }));
  const save = vi.spyOn(platformApi, "updateAccountProfile")
    .mockRejectedValueOnce(new Error("昵称保存失败"))
    .mockResolvedValue(response({ avatarUrl, displayName: "新名字" }));
  const { updateUser } = mount();
  await userEvent.clear(screen.getByLabelText("昵称"));
  await userEvent.type(screen.getByLabelText("昵称"), "新名字");
  const file = new File(["image"], "profile.png", { type: "image/png" });
  await userEvent.upload(screen.getByLabelText("更换头像"), file);
  expect(upload).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "提交资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("昵称保存失败");
  expect(updateUser).toHaveBeenCalledWith(response({ avatarUrl }).user);
  await userEvent.click(screen.getByRole("button", { name: "提交资料" }));
  await waitFor(() => expect(updateUser).toHaveBeenLastCalledWith(response({ avatarUrl, displayName: "新名字" }).user));
  expect(upload).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenNthCalledWith(1, { displayName: "新名字" });
  expect(save).toHaveBeenNthCalledWith(2, { displayName: "新名字" });
});
