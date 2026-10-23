// Checks desktop polling, single-flight decisions and stale project responses.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DesktopBridge } from "../../../../../shared/bridge.js";
import { conversationCodingApi } from "../services/conversation-coding-api.js";
import { useConversationCoding } from "./use-conversation-coding.js";

vi.mock("../services/conversation-coding-api.js", () => ({ conversationCodingApi: { read: vi.fn(), decide: vi.fn() } }));
const original = window.desktop;
const initial = { directory: "D:\\library", approvals: [], busy: false };
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, "desktop", { configurable: true, value: { chooseConversationDirectory: vi.fn(async () => null) } as unknown as DesktopBridge });
  vi.mocked(conversationCodingApi.read).mockResolvedValue(initial);
});
afterEach(() => { cleanup(); Object.defineProperty(window, "desktop", { configurable: true, value: original }); });

it("reads desktop status without exposing directory mutations and does not poll hosted pages", async () => {
  const hook = renderHook(() => useConversationCoding("p"));
  await waitFor(() => expect(hook.result.current.status.directory).toBe(initial.directory));
  expect(hook.result.current).not.toHaveProperty("choose");
  expect(hook.result.current).not.toHaveProperty("clear");
  hook.unmount(); vi.mocked(conversationCodingApi.read).mockClear();
  Object.defineProperty(window, "desktop", { configurable: true, value: undefined });
  const hosted = renderHook(() => useConversationCoding("p"));
  expect(hosted.result.current.available).toBe(false); expect(conversationCodingApi.read).not.toHaveBeenCalled();
});
it("submits one approval at a time and retains failures for the user to review", async () => {
  let resolveDecision!: () => void;
  vi.mocked(conversationCodingApi.decide).mockImplementation(() => new Promise<void>(resolve => { resolveDecision = resolve; }));
  const hook = renderHook(() => useConversationCoding("p")); await waitFor(() => expect(hook.result.current.status.directory).toBe(initial.directory));
  let first!: Promise<void>;
  let duplicate!: Promise<void>;
  act(() => { first = hook.result.current.decide("review", "run", true); duplicate = hook.result.current.decide("review", "run", true); });
  await expect(duplicate).rejects.toThrow("请等待当前操作完成");
  expect(conversationCodingApi.decide).toHaveBeenCalledTimes(1);
  await act(async () => { resolveDecision(); await first; });
  vi.mocked(conversationCodingApi.decide).mockRejectedValueOnce(new Error("此审批已失效"));
  await act(async () => { await expect(hook.result.current.decide("expired", "old", true)).rejects.toThrow("此审批已失效"); });
  expect(hook.result.current.error).toBe("此审批已失效"); expect(hook.result.current.pending).toBe(false);
});
it("ignores late responses belonging to a previous project", async () => {
  let resolveOld!: (value: typeof initial) => void;
  vi.mocked(conversationCodingApi.read).mockImplementation(id => id === "old" ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ ...initial, directory: "D:\\new" }));
  const hook = renderHook(({ id }) => useConversationCoding(id), { initialProps: { id: "old" } });
  hook.rerender({ id: "new" }); await waitFor(() => expect(hook.result.current.status.directory).toBe("D:\\new"));
  await act(async () => { resolveOld(initial); }); expect(hook.result.current.status.directory).toBe("D:\\new");
});
