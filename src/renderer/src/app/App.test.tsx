// Verifies top-level app routing, provider composition, shell layout behavior, and account/project entry flows.
import { matchAppRoute } from "./app-routes.js";
import { createAuthSessionResponse, createDocumentRunSnapshot } from "@test/fixtures/contract-fixtures";
import { installReactFlowTestLayout } from '../../../../tests/renderer/helpers/react-flow-test-layout.js';
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRepository } from "../services/workspace-repository/index.js";
import type { RunHistoryItem } from "../entities/run-history/index.js";
import {
  createRunSnapshot,
  createWorkspaceRecord,
  withWorkspaceProviders,
} from "../../../../tests/renderer/helpers/workspace-test-utils.js";
import { loadUserSettings, USER_SETTINGS_STORAGE_KEY } from "../shared/lib/user-settings.js";
import { Shell } from "./App.js";
import {
  ProjectWorkspaceAccessBoundary,
  ProjectsIndexPage,
} from "../features/user-platform/components/user-platform-pages.js";
import { formatProjectDateTimeMinute } from "../features/user-platform/lib/project-presentation.js";
import { PROJECT_BACKGROUND_OPTIONS } from "../features/user-platform/lib/project-backgrounds.js";
import { i18n, LOCALE_PREFERENCE_STORAGE_KEY } from "../shared/i18n/index.js";
import { requestOpenGenerationTask, requestOpenProjectWorkspaceTarget } from "../shared/lib/app-navigation.js";
import { invalidateProviderConfigCache } from "../features/user-platform/services/provider-config-cache.js";
import { invalidateProjectRunReads } from "../services/workspace-repository/project-run-reads.js";
import { useRouteContentReady } from "../shared/lib/route-content-readiness.js";

// Onborda reads the Next router even when tours use only in-page steps.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

let projectApiMode: "unauthenticated" | "authenticated" | "empty" | "forbidden" | "offline";
let caseProjectApiMode: "success" | "failure";
let projectMembershipRole: "owner" | "editor" | "viewer";
let loginApiMode: "failure" | "success" | "mfa-challenge";
let authSessionMode: "authenticated" | "unauthenticated" | "offline";
let accountMfaEnabled: boolean;
let providerConfigFixtures: Array<Record<string, unknown>>;
installReactFlowTestLayout();

const projectUpdatedAt = "2026-05-22T02:00:00.000Z";
const billingTestSkus = [
  {
    code: "credits_10",
    name: "10 次包",
    kind: "credit_pack",
    description: "买 10 次送 1 次，到账 11 次",
    creditAmount: 11,
    amountCents: 990,
    currency: "CNY",
    active: true,
    sortOrder: 110,
  },
  {
    code: "credits_50",
    name: "50 次包",
    kind: "credit_pack",
    description: "买 50 次送 8 次，到账 58 次",
    creditAmount: 58,
    amountCents: 4900,
    currency: "CNY",
    active: true,
    sortOrder: 120,
  },
  {
    code: "credits_100",
    name: "100 次包",
    kind: "credit_pack",
    description: "买 100 次送 20 次，到账 120 次",
    creditAmount: 120,
    amountCents: 9900,
    currency: "CNY",
    active: true,
    sortOrder: 130,
  },
  {
    code: "credits_500",
    name: "500 次包",
    kind: "credit_pack",
    description: "买 500 次送 120 次，到账 620 次",
    creditAmount: 620,
    amountCents: 39900,
    currency: "CNY",
    active: true,
    sortOrder: 140,
  },
] as const;

const billingPrimarySku = billingTestSkus.find((sku) => sku.code === "credits_100") ?? billingTestSkus[0]!;

const billingTestOrder = {
  orderId: "order-test-1",
  merchantOrderNo: "UML202606050001",
  sku: billingPrimarySku,
  amountCents: billingPrimarySku.amountCents,
  currency: "CNY",
  channel: "alipay",
  status: "pending",
  createdAt: "2026-06-05T04:00:00.000Z",
  expiresAt: "2026-06-05T04:15:00.000Z",
  paidAt: null,
} as const;

function createRepository(): WorkspaceRepository {
  return {
    loadWorkspace: vi.fn(async () => createWorkspaceRecord()),

    startRun: vi.fn(),
    subscribeToRun: vi.fn(),
    getRunSnapshot: vi.fn(),


    saveRunHistory: vi.fn(),
    listRunHistory: vi.fn(async () => []),
    deleteRunHistory: vi.fn(async () => []),

  };
}

async function chooseSelectOption(
  user: ReturnType<typeof userEvent.setup>,
  combobox: HTMLElement,
  optionName: string,
) {
  await user.click(combobox);
  const listbox = await screen.findByRole("listbox");
  const option = within(listbox).getByRole("option", { name: optionName });
  await user.click(option);
  await waitFor(() => {
    expect(combobox).toHaveTextContent(optionName);
  });
}

function getSelectTrigger(name: string) {
  // Radix portals can make jsdom's role-name traversal use a non-Document root in CI.
  const trigger = Array.from(
    document.querySelectorAll<HTMLElement>('button[role="combobox"]'),
  ).find((element) => element.getAttribute("aria-label") === name);
  if (!trigger) {
    throw new Error(`Select trigger not found: ${name}`);
  }
  return trigger;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createAuthMeResponse() {
  return new Response(
    JSON.stringify({
      user: {
        id: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
        username: "new_student",
        displayName: "new-student",
        status: "active",
        mfaEnabled: accountMfaEnabled,
      },
      mfa: { enabled: accountMfaEnabled, enforcement: "totp" },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function createProjectListResponse() {
  return new Response(
    JSON.stringify({
      projects: [
        { projectMode: "professional",
          id: "library-booking",
          name: "智慧图书馆预约系统",
          description: "真实项目数据",

          status: "active",
          ownerUserId: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
          ownerDisplayName: "New Student",
          ownerAvatarUrl: null,
          createdAt: "2026-05-22T01:00:00.000Z",
          updatedAt: projectUpdatedAt,
          lastGeneratedAt: "2026-05-22T02:05:00.000Z",
          memberCount: 4,
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function createProjectOverviewResponse() {
  return new Response(
    JSON.stringify({ generationExecutionMode: "provider",
      project: { projectMode: "professional",
        id: "library-booking",
        name: "智慧图书馆预约系统",
        description: "真实项目数据",

        status: "active",
        ownerUserId: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
        ownerDisplayName: "New Student",
        ownerAvatarUrl: null,
        createdAt: "2026-05-22T01:00:00.000Z",
        updatedAt: projectUpdatedAt,
        lastGeneratedAt: "2026-05-22T02:05:00.000Z",
        memberCount: 4,
      },
      membership: {
        id: "member-owner",
        projectId: "library-booking",
        userId: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
        username: "new_student",
        displayName: "New Student",
        role: "owner",
        status: "active",
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function flushResolvedPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function RouteContentReadinessProbe() {
  return <output data-testid="route-content-ready">{String(useRouteContentReady())}</output>;
}

async function advanceTimersByTime(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await flushResolvedPromises();
  });
}

async function waitForPlatformLoadingToExit() {
  await waitFor(() => {
    expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
  });
}

describe("App shell routes", () => {
  beforeEach(async () => {
    projectApiMode = "unauthenticated";
    caseProjectApiMode = "success";
    projectMembershipRole = "owner";
    loginApiMode = "failure";
    authSessionMode = "authenticated";
    accountMfaEnabled = false;
    providerConfigFixtures = [
      {
        id: "provider-config-1",
        name: "课程 OpenAI 托管配置",
        provider: "openai",
        baseUrl: "https://api.openai.example",
        defaultModel: "gpt-5.5",
        allowedModels: ["gpt-5.5", "gpt-5.4"],
        maskedKey: "••••••••a91f",
        status: "active",
        riskState: "low",
        quota: "unlimited",
        lastUsedAt: null,
        scopeType: "project",
        scopeId: "project-uml",
        breakerState: "closed",
      },
    ];
    Object.defineProperty(Element.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:app-export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    HTMLAnchorElement.prototype.click = vi.fn();
    HTMLFormElement.prototype.submit = vi.fn();
    window.history.pushState({}, "", "/");
    localStorage.removeItem(LOCALE_PREFERENCE_STORAGE_KEY);
    localStorage.removeItem(USER_SETTINGS_STORAGE_KEY);
    localStorage.removeItem("uml-auth-remembered-username");
    localStorage.removeItem("uml-auth-remembered-password");
    invalidateProviderConfigCache();
    invalidateProjectRunReads();
    await i18n.changeLanguage("zh-CN");
    document.documentElement.lang = "zh-CN";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://127.0.0.1:4001");
        const pathname = url.pathname;
        const method = init?.method ?? "GET";
        if (pathname === "/api/auth/login" && loginApiMode === "mfa-challenge") {
          return new Response(
            JSON.stringify({
              mfa: {
                required: true,
                method: "totp",
                challengeId: "challenge-login-1",
                expiresAt: "2026-05-22T02:10:00.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/auth/login" && loginApiMode === "success") {
          return new Response(
            JSON.stringify(createAuthSessionResponse()),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/auth/login") {
          return new Response(JSON.stringify({ error: { code: "AUTH_INVALID_CREDENTIALS", category: "authentication", retryable: false } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname === "/api/auth/mfa/verify") {
          return new Response(
            JSON.stringify(createAuthSessionResponse({ user: { mfaEnabled: true }, session: { id: "session-mfa" } })),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/auth/register") {
          return new Response(
            JSON.stringify(createAuthSessionResponse({ user: { mfaEnabled: accountMfaEnabled }, session: { id: "session-new" } })),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/auth/me") {
          if (authSessionMode === "offline") {
            throw new TypeError("Failed to fetch");
          }
          if (authSessionMode === "unauthenticated") {
            return new Response(JSON.stringify({ message: "Authentication required" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({
              user: {
                id: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
                username: "new_student",
                displayName: "new-student",
                status: "active",
                mfaEnabled: accountMfaEnabled,
              },
              mfa: { enabled: accountMfaEnabled, enforcement: "totp" },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/auth/logout") {
          authSessionMode = "unauthenticated";
          return new Response(null, { status: 204 });
        }
        if (pathname === "/api/account/profile" && method === "GET") {
          return new Response(
            JSON.stringify({
              user: {
                id: "user-new",
                username: "new_student",
                displayName: "new-student",
                avatarUrl: "https://cdn.example.edu/avatar.png",
                status: "active",
                mfaEnabled: accountMfaEnabled,
              },
              mfa: { enabled: accountMfaEnabled, enforcement: "totp" },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/profile" && method === "PATCH") {
          return new Response(
            JSON.stringify({
              user: {
                id: "user-new",
                username: "new_student",
                displayName: "课程助教",
                avatarUrl: "https://cdn.example.edu/ta.png",
                status: "active",
                mfaEnabled: accountMfaEnabled,
              },
              mfa: { enabled: accountMfaEnabled, enforcement: "totp" },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/sessions") {
          return new Response(
            JSON.stringify({
              sessions: [
                {
                  id: "session-current",
                  userId: "user-new",
                  createdAt: "2026-05-22T01:00:00.000Z",
                  expiresAt: "2026-05-29T01:00:00.000Z",
                  lastSeenAt: "2026-05-22T02:00:00.000Z",
                  ipAddress: "127.0.0.1",
                  userAgent: "Chrome on Windows",
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/login-events") {
          return new Response(
            JSON.stringify({
              events: [
                {
                  id: "login-1",
                  userId: "user-new",
                  username: "new_student",
                  outcome: "success",
                  ipAddress: "127.0.0.1",
                  userAgent: "Chrome on Windows",
                  message: "Login succeeded",
                  createdAt: "2026-05-22T02:00:00.000Z",
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/mfa/setup") {
          return new Response(
            JSON.stringify({
              secret: "JBSWY3DPEHPK3PXP",
              otpauthUri:
                "otpauth://totp/UML:new_student?secret=JBSWY3DPEHPK3PXP&issuer=UML",
              expiresAt: "2026-05-22T02:15:00.000Z",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/mfa/confirm") {
          accountMfaEnabled = true;
          return new Response(
            JSON.stringify({
              mfa: { enabled: true, enforcement: "totp" },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/mfa") {
          accountMfaEnabled = false;
          return new Response(
            JSON.stringify({
              mfa: { enabled: false, enforcement: "totp" },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/billing/skus") {
          return new Response(JSON.stringify({ skus: billingTestSkus }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname === "/api/billing/summary") {
          return new Response(
            JSON.stringify({
              creditBalance: 10,
              signupBonus: {
                granted: true,
                creditAmount: 5,
                validUntil: "2026-07-05T04:00:00.000Z",
              },
              recentOrders: [billingTestOrder],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/billing/orders" && method === "POST") {
          const body = JSON.parse(String(init?.body ?? "{}")) as {
            skuCode?: string;
            channel?: "alipay";
          };
          const sku = billingTestSkus.find((candidate) => candidate.code === body.skuCode) ?? billingPrimarySku;
          const order = {
            ...billingTestOrder,
            sku,
            amountCents: sku.amountCents,
            channel: body.channel ?? "alipay",
          };
          return new Response(
            JSON.stringify({
              orderId: order.orderId,
              merchantOrderNo: order.merchantOrderNo,
              status: order.status,
              amountCents: order.amountCents,
              currency: order.currency,
              expiresAt: order.expiresAt,
              channel: order.channel,
              paymentFormHtml: "<form action=\"https://zpayz.cn/submit.php\"><button>pay</button></form>",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname.startsWith("/api/billing/orders/") && method === "GET") {
          return new Response(JSON.stringify(billingTestOrder), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname === "/api/invitations/course-token-123/accept") {
          return new Response(
            JSON.stringify({ message: "Invitation accepted" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/account/sessions/revoke-others") {
          return new Response(JSON.stringify({ revokedCount: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname.startsWith("/api/cases/") && pathname.endsWith("/project") && method === "POST") {
          if (caseProjectApiMode === "failure") {
            return new Response(JSON.stringify({ message: "案例项目创建失败" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          const caseId = pathname.split("/")[3] ?? "case";
          const caseTitleById: Record<string, string> = {
            "lab-booking": "实验室预约系统",
            "order-management": "订单管理系统",
            "device-monitoring": "设备监控系统",
            "library-lending": "图书馆借阅系统",
          };
          return new Response(
            JSON.stringify({ generationExecutionMode: "provider",
              project: { projectMode: "professional",
                id: `case-project-${caseId}`,
                name: caseTitleById[caseId] ?? "项目",
                description: "案例生成项目",

                status: "active",
                ownerUserId: "user-new",
                createdAt: "2026-06-26T00:00:00.000Z",
                updatedAt: "2026-06-26T00:00:00.000Z",
              },
              membership: {
                id: "member-case-owner",
                projectId: `case-project-${caseId}`,
                userId: "user-new",
                username: "new_student",
                displayName: "new-student",
                role: "owner",
                status: "active",
              },
              currentUserRole: "owner",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (
          pathname.startsWith("/api/projects/case-project-") &&
          pathname.split("/").length === 4 &&
          method === "GET"
        ) {
          const projectId = pathname.split("/")[3] ?? "case-project";
          return new Response(
            JSON.stringify({ generationExecutionMode: "provider",
              project: { projectMode: "professional",
                id: projectId,
                name: "案例项目",
                description: "案例生成项目",

                status: "active",
                ownerUserId: "user-new",
                createdAt: "2026-06-26T00:00:00.000Z",
                updatedAt: "2026-06-26T00:00:00.000Z",
              },
              membership: {
                id: "member-case-owner",
                projectId,
                userId: "user-new",
                username: "new_student",
                displayName: "new-student",
                role: projectMembershipRole,
                status: "active",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects" && method === "GET" && projectApiMode === "authenticated") {
          return new Response(
            JSON.stringify({
              projects: [
                { projectMode: "professional",
                  id: "library-booking",
                  name: "智慧图书馆预约系统",
                  description: "真实项目数据",

                  status: "active",
                  ownerUserId: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
                  ownerDisplayName: "New Student",
                  ownerAvatarUrl: null,
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: projectUpdatedAt,
                  lastGeneratedAt: "2026-05-22T02:05:00.000Z",
                  memberCount: 4,
                  memberPreviews: [
                    {
                      id: "member-owner",
                      userId: "e91237c8-5ccf-45aa-b0d2-822b96915a24",
                      displayName: "New Student",
                      avatarUrl: null,
                      role: "owner",
                      status: "active",
                    },
                    {
                      id: "member-editor",
                      userId: "editor-1",
                      displayName: "Editor User",
                      avatarUrl: null,
                      role: "editor",
                      status: "active",
                    },
                    {
                      id: "member-viewer",
                      userId: "viewer-1",
                      displayName: "Viewer User",
                      avatarUrl: null,
                      role: "viewer",
                      status: "active",
                    },
                  ],
                },
                { projectMode: "standard",
                  id: "archived-demo",
                  name: "归档课程演示",
                  description: "已经归档的真实项目",

                  status: "archived",
                  ownerUserId: "teacher-1",
                  createdAt: "2026-05-21T01:00:00.000Z",
                  updatedAt: "2026-05-21T03:00:00.000Z",
                  lastGeneratedAt: null,
                  memberCount: 1,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects" && method === "GET" && projectApiMode === "empty") {
          return new Response(JSON.stringify({ projects: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname === "/api/projects" && method === "GET" && projectApiMode === "offline") {
          throw new TypeError("Failed to fetch");
        }
        if (pathname === "/api/projects" && method === "GET") {
          return new Response(JSON.stringify({ message: "Authentication required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname === "/api/projects/library-booking" && projectApiMode === "forbidden") {
          return new Response(JSON.stringify({ message: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (pathname === "/api/projects/library-booking") {
          return new Response(
            JSON.stringify({ generationExecutionMode: "provider",
              project: { projectMode: "professional",
                id: "library-booking",
                name: "智慧图书馆预约系统",
                description: "真实项目数据",

                status: "active",
                ownerUserId: "user-new",
                createdAt: "2026-05-22T01:00:00.000Z",
                updatedAt: projectUpdatedAt,
              },
              membership: {
                id: "member-owner",
                projectId: "library-booking",
                userId: "user-new",
                username: "new_student",
                displayName: "new-student",
                role: projectMembershipRole,
                status: "active",
                invitedByUserId: null,
                invitedAt: null,
                joinedAt: "2026-05-22T01:00:00.000Z",
                createdAt: "2026-05-22T01:00:00.000Z",
                updatedAt: "2026-05-22T01:00:00.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/created-project" && method === "GET") {
          return new Response(
            JSON.stringify({ generationExecutionMode: "provider",
              project: { projectMode: "professional",
                id: "created-project",
                name: "课程 UML 实验项目",
                description: null,

                status: "active",
                ownerUserId: "user-new",
                createdAt: "2026-05-22T01:00:00.000Z",
                updatedAt: projectUpdatedAt,
              },
              membership: {
                id: "member-created-owner",
                projectId: "created-project",
                userId: "user-new",
                username: "new_student",
                displayName: "new-student",
                role: "owner",
                status: "active",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/members") {
          return new Response(
            JSON.stringify({
              members: [
                {
                  id: "member-owner",
                  projectId: "library-booking",
                  userId: "user-new",
                  username: "new_student",
                  displayName: "new-student",
                  avatarUrl: "https://cdn.example.edu/new-student.png",
                  role: "owner",
                  status: "active",
                  invitedByUserId: null,
                  invitedAt: null,
                  joinedAt: "2026-05-22T01:00:00.000Z",
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: "2026-05-22T01:00:00.000Z",
                },
                {
                  id: "member-analyst",
                  projectId: "library-booking",
                  userId: "a3023f76-6da3-4fcd-9a82-8a187c30691d",
                  username: "analyst",
                  displayName: "需求分析师",
                  avatarUrl: null,
                  role: "editor",
                  status: "active",
                  invitedByUserId: "user-new",
                  invitedAt: "2026-05-22T01:00:00.000Z",
                  joinedAt: "2026-05-22T01:30:00.000Z",
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: "2026-05-22T01:30:00.000Z",
                },
                {
                  id: "member-viewer",
                  projectId: "library-booking",
                  userId: null,
                  username: "viewer",
                  displayName: null,
                  role: "viewer",
                  status: "invited",
                  invitedByUserId: "user-new",
                  invitedAt: "2026-05-22T01:00:00.000Z",
                  joinedAt: null,
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: "2026-05-22T01:00:00.000Z",
                },
                {
                  id: "member-editor",
                  projectId: "library-booking",
                  userId: "user-editor",
                  username: "editor_active",
                  displayName: "editor-active",
                  role: "editor",
                  status: "active",
                  invitedByUserId: "user-new",
                  invitedAt: "2026-05-22T01:00:00.000Z",
                  joinedAt: "2026-05-22T01:30:00.000Z",
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: "2026-05-22T01:30:00.000Z",
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/invitations" && method === "POST") {
          return new Response(
            JSON.stringify({
              invitation: {
                id: "invitation-editor",
                projectId: "library-booking",
                username: "editor",
                role: "editor",
                status: "invited",
                invitedAt: "2026-05-22T02:30:00.000Z",
                invitedByUserId: "owner",
                createdAt: "2026-05-22T02:30:00.000Z",
                updatedAt: "2026-05-22T02:30:00.000Z",
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/invitations/member-viewer/resend") {
          return new Response(
            JSON.stringify({
              invitation: {
                id: "member-viewer",
                projectId: "library-booking",
                username: "viewer",
                role: "viewer",
                status: "invited",
                invitedAt: "2026-05-22T02:40:00.000Z",
                invitedByUserId: "owner",
                createdAt: "2026-05-22T02:40:00.000Z",
                updatedAt: "2026-05-22T02:40:00.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/invitations/member-viewer" && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (pathname === "/api/projects/library-booking/members/member-viewer" && method === "PATCH") {
          return new Response(
            JSON.stringify({
              member: {
                id: "member-viewer",
                projectId: "library-booking",
                userId: null,
                username: "viewer",
                displayName: null,
                role: "editor",
                status: "invited",
                invitedAt: "2026-05-22T01:00:00.000Z",
                joinedAt: null,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/members/member-editor" && method === "PATCH") {
          return new Response(
            JSON.stringify({
              member: {
                id: "member-editor",
                projectId: "library-booking",
                userId: "user-editor",
                username: "editor_active",
                displayName: "editor-active",
                role: "viewer",
                status: "active",
                invitedAt: "2026-05-22T01:00:00.000Z",
                joinedAt: "2026-05-22T01:30:00.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/members/member-viewer" && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (pathname === "/api/projects/library-booking/members/member-editor" && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (pathname === "/api/projects/library-booking/runs") {
          return new Response(
            JSON.stringify({
              projectId: "library-booking",
              generatedAt: "2026-05-22T02:00:00.000Z",
              runs: [
                { operationType: "requirement_modeling",
                  runId: "run-1",
                  status: "running",
                  stage: "render_svg",
                  runKind: "requirements",
                  model: "gpt-5.5",
                  createdByUserId: "a3023f76-6da3-4fcd-9a82-8a187c30691d",
                  createdAt: "2026-05-22T02:00:00.000Z",
                  updatedAt: "2026-05-22T02:05:00.000Z",
                  errorMessage: null,
                },
                { operationType: "design_modeling",
                  runId: "run-failed",
                  status: "failed",
                  stage: "render_svg",
                  runKind: "design",
                  model: "gpt-5.5",
                  createdByUserId: "bbbbbbbb-6da3-4fcd-9a82-8a187c30691d",
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: "2026-05-22T01:05:00.000Z",
                  errorMessage: "PlantUML render failed",
                },
                { operationType: "document_generation",
                  runId: "run-doc",
                  status: "completed",
                  stage: "generate_document_text",
                  runKind: "document",
                  documentKind: "requirementsSpec",
                  model: "gpt-5.5",
                  createdByUserId: "teacher-1",
                  createdAt: "2026-05-22T00:00:00.000Z",
                  updatedAt: "2026-05-22T00:05:00.000Z",
                  errorMessage: null,
                },
                { operationType: "document_generation",
                  runId: "run-doc-failed",
                  status: "failed",
                  stage: "render_document_file",
                  runKind: "document",
                  documentKind: "requirementsSpec",
                  model: "gpt-5.5",
                  createdByUserId: "teacher-1",
                  createdAt: "2026-05-21T23:00:00.000Z",
                  updatedAt: "2026-05-21T23:05:00.000Z",
                  errorMessage: "证据包组装失败",
                  documentDownloadAvailable: true,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/runs/run-1/cancel") {
          return new Response(
            JSON.stringify({
              action: "cancel",
              sourceRunId: "run-1",
              runId: "run-1",
              status: "cancelled",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (
          (pathname === "/api/projects/library-booking/runs/run-failed" ||
            pathname === "/api/projects/library-booking/runs/run-doc") &&
          method === "DELETE"
        ) {
          return new Response(null, { status: 204 });
        }
        if (pathname === "/api/projects/library-booking/documents") {
          return new Response(
            JSON.stringify({
              documents: [
                {
                  id: "doc-1",
                  workspaceId: "workspace-project",
                  projectId: "library-booking",
                  createdByUserId: "user-new",
                  documentKind: "requirementsSpec",
                  title: "需求规格说明书",
                  fileName: "requirements.docx",
                  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  byteLength: 1234,
                  version: 2,
                  status: "active",
                  editLock: {
                    status: "locked",
                    lockedBy: "teacher",
                    lockedAt: "2026-05-22T02:01:00.000Z",
                  },
                  download: { status: "available" },
                  sourceRunId: "run-1",
                  createdAt: "2026-05-22T01:00:00.000Z",
                  updatedAt: "2026-05-22T02:00:00.000Z",
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/documents/doc-1/versions") {
          return new Response(
            JSON.stringify({
              versions: [
                {
                  version: 2,
                  fileName: "requirements.docx",
                  byteLength: 1234,
                  createdAt: "2026-05-22T02:00:00.000Z",
                  projectId: "library-booking",
                },
                {
                  version: 1,
                  fileName: "requirements-v1.docx",
                  byteLength: 1000,
                  createdAt: "2026-05-22T01:00:00.000Z",
                  projectId: "library-booking",
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/documents/doc-1/download") {
          return new Response(new Blob(["docx"]), {
            status: 200,
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "Content-Disposition": "attachment; filename*=UTF-8''requirements.docx",
            },
          });
        }
        if (pathname === "/api/projects/library-booking/documents/doc-1" && method === "PATCH") {
          return new Response(
            JSON.stringify({
              document: {
                id: "doc-1",
                projectId: "library-booking",
                title: "需求规格说明书-改名",
                fileName: "requirements-renamed.docx",
                version: 3,
                status: "active",
                updatedAt: "2026-05-22T02:30:00.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects/library-booking/documents/doc-1" && method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        if (pathname === "/api/projects/library-booking/documents/doc-1/restore") {
          return new Response(
            JSON.stringify({
              document: {
                id: "doc-1",
                projectId: "library-booking",
                title: "需求规格说明书-改名",
                fileName: "requirements-renamed.docx",
                version: 3,
                status: "active",
                updatedAt: "2026-05-22T02:35:00.000Z",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/provider-configs") {
          return new Response(
            JSON.stringify({
              generatedAt: "2026-05-22T02:00:00.000Z",
              providerConfigs: providerConfigFixtures,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/provider-configs/provider-config-1/test") {
          return new Response(
            JSON.stringify({ ok: true, message: "Provider config ok" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (pathname === "/api/projects" && method === "POST") {
          return new Response(
            JSON.stringify({
              project: { projectMode: "professional",
                id: "created-project",
                name: "课程 UML 实验项目",
                description: null,

                status: "active",
                ownerUserId: "user-new",
                updatedAt: new Date().toISOString(),
              },
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  it.each(["/projects", "/projects/library-booking"])("starts %s with an expanded sidebar and allows manual collapse", async (path) => {
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", path);
    const { container } = render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitFor(() => {
      expect(container.querySelector('[data-slot="sidebar"]')).toHaveAttribute("data-state", "expanded");
    });
    const sidebar = container.querySelector('[data-slot="sidebar"]')!;
    const toggle = screen.getByRole("button", { name: "Toggle Sidebar" });
    fireEvent.click(toggle);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    fireEvent.click(toggle);
    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("keeps the platform shell mounted across sidebar navigation and history while revalidating target content", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // Keep animation frames on the real clock so teardown cannot stall later popup interactions.
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    let pendingAuth: ReturnType<typeof createDeferred<Response>> | null = null;
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      if (url.pathname === "/api/auth/me" && pendingAuth) return pendingAuth.promise;
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      const { container } = render(withWorkspaceProviders(<Shell />, createRepository()));
      await act(flushResolvedPromises);
      expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
      const banner = screen.getByRole("banner");
      const sidebar = container.querySelector('[data-slot="sidebar"]')!;
      const destinations = [
        { path: "/projects", heading: "项目首页" },

        { path: "/dashboard", heading: null },
      ];
      // Hold each server check so even a slow network cannot hide a shell remount.
      for (const destination of destinations) {
        pendingAuth = createDeferred<Response>();
        const target = sidebar.querySelector<HTMLAnchorElement>('[data-slot="sidebar-group"] a[href="' + destination.path + '"]')!;
        fireEvent.click(target);
        await act(flushResolvedPromises);
        expect(window.location.pathname).toBe(destination.path);
        expect(screen.getByRole("banner")).toBe(banner);
        expect(container.querySelector('[data-slot="sidebar"]')).toBe(sidebar);
        expect(screen.getByTestId("auth-check-placeholder")).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
        if (destination.heading) {
          expect(screen.queryByRole("heading", { name: destination.heading })).not.toBeInTheDocument();
        }
        await act(async () => {
          pendingAuth!.resolve(createAuthMeResponse());
          pendingAuth = null;
          await flushResolvedPromises();
        });
        expect(screen.getByRole("banner")).toBe(banner);
        expect(container.querySelector('[data-slot="sidebar"]')).toBe(sidebar);
        expect(screen.queryByTestId("auth-check-placeholder")).not.toBeInTheDocument();
        if (destination.heading) {
          expect(screen.getByRole("heading", { name: destination.heading })).toBeInTheDocument();
        } else {
          expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
        }
      }

      pendingAuth = createDeferred<Response>();
      act(() => {
        window.history.replaceState({}, "", "/projects");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await act(flushResolvedPromises);
      expect(screen.getByRole("banner")).toBe(banner);
      expect(container.querySelector('[data-slot="sidebar"]')).toBe(sidebar);
      expect(screen.queryByTestId("account-billing-dashboard")).not.toBeInTheDocument();
      await act(async () => {
        pendingAuth!.resolve(createAuthMeResponse());
        pendingAuth = null;
        await flushResolvedPromises();
      });
      expect(screen.getByRole("heading", { name: "项目首页" })).toBeInTheDocument();
      expect(screen.getByRole("banner")).toBe(banner);
    } finally {
      vi.useRealTimers();
    }
  });

  it("omits the copyright footer from the dashboard", async () => {
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/dashboard");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(await screen.findByTestId("dashboard-shell")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sidebar-inset"] > footer')).not.toBeInTheDocument();
  });

  it.each(["/verify-email", "/verify-username", "/forgot-password", "/reset-password", "/invitations/accept"])("rejects retired authentication route %s", async (path) => {
    expect(matchAppRoute(path)).toMatchObject({ kind: "not-found", path });
    window.history.pushState({}, "", path);
    render(withWorkspaceProviders(<Shell />, createRepository()));
    expect(await screen.findByText("你访问的页面不存在")).toBeInTheDocument();
    expect(screen.queryByTestId("auth-shell")).not.toBeInTheDocument();
  });

  it.each([
    { path: "/dashboard", readyTestId: "dashboard-shell" },
  ])("blocks $path content without an intermediate loading page while verifying the session", async ({ path, readyTestId }) => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const authDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    let holdInitialAuthCheck = true;
    authSessionMode = "authenticated";
    window.history.pushState({}, "", path);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      if (url.pathname === "/api/auth/me" && holdInitialAuthCheck) {
        holdInitialAuthCheck = false;
        return authDeferred.promise;
      }
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      render(withWorkspaceProviders(<Shell />, createRepository()));

      expect(screen.getByTestId("auth-check-placeholder")).toHaveAttribute("aria-busy", "true");
      expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "准备好迎接" })).not.toBeInTheDocument();

      await act(async () => {
        authDeferred.resolve(createAuthMeResponse());
        await flushResolvedPromises();
      });

      if (readyTestId) {
        expect(screen.getByTestId(readyTestId)).toBeInTheDocument();
      } else {
        expect(screen.getByRole("heading", { name: "准备好迎接" })).toBeInTheDocument();
      }
      expect(screen.queryByTestId("auth-check-placeholder")).not.toBeInTheDocument();
      expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the projects index visually empty while the project list loads", async () => {
    const projectsDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    authSessionMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      if (url.pathname === "/api/projects" && (init?.method ?? "GET") === "GET") {
        return projectsDeferred.promise;
      }
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      render(
        withWorkspaceProviders(
          <ProjectsIndexPage onNavigate={() => {}} />,
          createRepository(),
        ),
      );
      expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
      expect(screen.queryByTestId("projects-index-loading-skeleton")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "项目首页" })).not.toBeInTheDocument();
      expect(screen.queryByText("正在加载项目列表...")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("搜索项目")).not.toBeInTheDocument();

      await act(async () => {
        projectsDeferred.resolve(createProjectListResponse());
        await flushResolvedPromises();
      });

      expect(screen.getByRole("heading", { name: "项目首页" })).toBeInTheDocument();
      expect(screen.getAllByText("智慧图书馆预约系统").length).toBeGreaterThan(0);
      expect(screen.getByTestId("projects-card-grid")).toHaveAttribute(
        "data-mobile-card-density",
        "single-column",
      );
      expect(screen.getByTestId("projects-filter-panel")).toBeInTheDocument();
      expect(screen.queryByText("正在加载项目列表...")).not.toBeInTheDocument();
      expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a real loading status and opens the workspace immediately when data arrives", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const projectDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      if (
        url.pathname === "/api/projects/library-booking" &&
        (init?.method ?? "GET") === "GET"
      ) {
        return projectDeferred.promise.then(response => response.clone());
      }
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      render(
        withWorkspaceProviders(
          <ProjectWorkspaceAccessBoundary
            projectId="library-booking"
            onNavigate={() => {}}
          >
            <div>项目导航</div>
            <RouteContentReadinessProbe />
          </ProjectWorkspaceAccessBoundary>,
          createRepository(),
        ),
      );

      expect(screen.getByText("正在打开项目工作台...")).toBeInTheDocument();
      expect(screen.getByTestId("platform-loading-screen")).toHaveAttribute(
        "data-loading-variant",
        "content",
      );
      expect(screen.queryByText("项目导航")).not.toBeInTheDocument();

      // A slow real request keeps a status, never an invented percentage or a timed completion.
      await advanceTimersByTime(10_000);
      expect(screen.getByText("正在打开项目工作台...")).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      await act(async () => {
        projectDeferred.resolve(createProjectOverviewResponse());
        await flushResolvedPromises();
      });

      expect(screen.getByText("项目导航")).toBeInTheDocument();
      expect(screen.queryByText("正在打开项目工作台...")).not.toBeInTheDocument();
      expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.getByTestId("route-content-ready")).toHaveTextContent("true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the projects index visually empty while protected projects load", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const projectsDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    authSessionMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      if (url.pathname === "/api/projects" && (init?.method ?? "GET") === "GET") {
        return projectsDeferred.promise;
      }
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      render(withWorkspaceProviders(<Shell />, createRepository()));

      await act(async () => {
        await flushResolvedPromises();
      });
      expect(screen.queryAllByTestId("platform-loading-screen")).toHaveLength(0);
      expect(screen.queryByTestId("projects-index-loading-skeleton")).not.toBeInTheDocument();
      expect(screen.queryByText("正在加载项目列表...")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "项目首页" })).not.toBeInTheDocument();

      await act(async () => {
        projectsDeferred.resolve(createProjectListResponse());
        await flushResolvedPromises();
      });

      expect(screen.getByRole("heading", { name: "项目首页" })).toBeInTheDocument();
      expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
      expect(screen.queryAllByTestId("platform-loading-screen")).toHaveLength(0);
      expect(screen.getByRole("heading", { name: "项目首页" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps one real loading status and removes it immediately when direct project requests finish", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const projectDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    let holdProjectOverview = true;
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      if (
        url.pathname === "/api/projects/library-booking" &&
        (init?.method ?? "GET") === "GET" &&
        holdProjectOverview
      ) {
        holdProjectOverview = false;
        return projectDeferred.promise;
      }
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      render(withWorkspaceProviders(<Shell />, createRepository()));

      await act(async () => {
        await flushResolvedPromises();
      });

      expect(screen.queryAllByTestId("platform-loading-screen")).toHaveLength(1);
      expect(screen.getByText("正在打开项目工作台...")).toBeInTheDocument();
      expect(screen.getByTestId("project-workspace-loading-layout")).toBeInTheDocument();
      expect(screen.queryByText("项目导航")).not.toBeInTheDocument();

      await act(async () => {
        projectDeferred.resolve(createProjectOverviewResponse());
        await flushResolvedPromises();
      });

      expect(screen.getByText("项目导航")).toBeInTheDocument();
      expect(screen.queryByText("项目数据加载中...")).not.toBeInTheDocument();
      expect(screen.queryByTestId("project-workspace-loading-layout")).not.toBeInTheDocument();
      expect(screen.queryAllByTestId("platform-loading-screen")).toHaveLength(0);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.getByText("项目导航")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks protected route navigation until the session is revalidated", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const routeAuthDeferred = createDeferred<Response>();
    const projectDetailDeferred = createDeferred<Response>();
    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation();
    let holdNextRouteAuth = false;
    let authMeCalls = 0;
    const projectRequests = {
      detail: 0,
      members: 0,
      runs: 0,
      documents: 0,
    };
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://127.0.0.1:4101");
      const method = init?.method ?? "GET";
      if (url.pathname === "/api/auth/me") {
        authMeCalls += 1;
        if (holdNextRouteAuth) {
          holdNextRouteAuth = false;
          return routeAuthDeferred.promise;
        }
        return createAuthMeResponse();
      }
      if (url.pathname === "/api/projects" && method === "GET") {
        return createProjectListResponse();
      }
      if (url.pathname === "/api/projects/library-booking" && method === "GET") {
        projectRequests.detail += 1;
        return projectDetailDeferred.promise;
      }
      if (url.pathname === "/api/projects/library-booking/members" && method === "GET") {
        projectRequests.members += 1;
      }
      if (url.pathname === "/api/projects/library-booking/runs" && method === "GET") {
        projectRequests.runs += 1;
      }
      if (url.pathname === "/api/projects/library-booking/documents" && method === "GET") {
        projectRequests.documents += 1;
      }
      if (!defaultFetch) throw new Error("Default fetch mock is not installed");
      return defaultFetch(input, init);
    });

    try {
      render(withWorkspaceProviders(<Shell />, createRepository()));

      await act(async () => {
        await flushResolvedPromises();
      });
      await act(async () => {
        await flushResolvedPromises();
      });

      expect(screen.getByRole("heading", { name: "项目首页" })).toBeInTheDocument();
      holdNextRouteAuth = true;

      fireEvent.click(screen.getByRole("button", { name: "查看项目 智慧图书馆预约系统" }));
      fireEvent.click(
        screen.getByRole("link", { name: "进入项目 智慧图书馆预约系统" }),
      );

      await act(async () => {
        await flushResolvedPromises();
      });

      expect(window.location.pathname).toBe("/projects/library-booking");
      expect(screen.getByText("正在校验登录状态...")).toBeInTheDocument();
      expect(screen.getByTestId("platform-loading-screen")).toBeInTheDocument();
      expect(screen.queryByText("正在打开项目工作台...")).not.toBeInTheDocument();
      expect(screen.queryByTestId("project-workspace-loading-layout")).not.toBeInTheDocument();
      expect(screen.queryByText("项目导航")).not.toBeInTheDocument();
      expect(screen.queryByText("需求分析提取")).not.toBeInTheDocument();
      expect(projectRequests).toEqual({
        detail: 0,
        members: 0,
        runs: 0,
        documents: 0,
      });

      const authCallsAfterRouteCheckStarted = authMeCalls;
      await act(async () => {
        routeAuthDeferred.resolve(createAuthMeResponse());
        await flushResolvedPromises();
      });
      await act(async () => {
        await flushResolvedPromises();
      });

      expect(screen.getByTestId("platform-loading-screen")).toBeInTheDocument();
      expect(screen.getByText("正在打开项目工作台...")).toBeInTheDocument();
      expect(screen.getByTestId("project-workspace-loading-layout")).toBeInTheDocument();
      expect(screen.queryByText("项目导航")).not.toBeInTheDocument();
      expect(projectRequests).toEqual({
        detail: 1,
        members: 1,
        runs: 1,
        documents: 1,
      });

      await act(async () => {
        projectDetailDeferred.resolve(createProjectOverviewResponse());
        await flushResolvedPromises();
      });
      await act(async () => {
        await flushResolvedPromises();
      });

      expect(screen.getByText("项目导航")).toBeInTheDocument();
      expect(projectRequests).toEqual({
        detail: 1,
        members: 1,
        runs: 1,
        documents: 1,
      });
      expect(authMeCalls).toBe(authCallsAfterRouteCheckStarted);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a service error without anonymous fallback when the project API is unavailable", async () => {
    projectApiMode = "offline";
    authSessionMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(
      await screen.findByText(
        "项目加载失败：无法连接服务，请检查网络或确认服务已启动后重试。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/u)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "项目服务不可用" })).toBeInTheDocument();
    expect(screen.queryByText("匿名工作台")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("搜索项目")).not.toBeInTheDocument();
    expect(screen.queryByText("项目导航")).not.toBeInTheDocument();
  });

  it("rechecks local identity and shows a connection error when the backend session changes", async () => {
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(await screen.findByText("项目导航")).toBeInTheDocument();

    authSessionMode = "unauthenticated";
    window.dispatchEvent(new Event("uml-auth-session-changed"));

    expect(await screen.findByRole("alert")).toHaveTextContent("本地工作区暂时无法连接");
    expect(window.location.pathname).toBe("/projects/library-booking");
    expect(screen.queryByText("项目导航")).not.toBeInTheDocument();
  });

  it("navigates from a real project card into a project-aware workspace banner", async () => {
    const user = userEvent.setup();
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(
      await screen.findByRole("button", { name: "查看项目 智慧图书馆预约系统" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "项目首页" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去连接" })).not.toBeInTheDocument();
    expect(screen.getByText("项目会绑定成员权限、运行历史、文档和模型配置。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建项目" })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="sidebar-inset"] > footer')).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部项目" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "快速项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "工程项目" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "协作项目" })).not.toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText("搜索项目、成员...");
    expect(searchInput).toBeInTheDocument();
    const sortTrigger = getSelectTrigger("排序方式");
    expect(sortTrigger).toHaveTextContent("最近生成");
    expect(screen.queryByRole("navigation", { name: "项目导航" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成任务" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "历史" })).not.toBeInTheDocument();
    expect(screen.getByText("真实项目数据")).toHaveAttribute("title", "真实项目数据");
    await user.click(screen.getByRole("button", { name: "查看项目 智慧图书馆预约系统" }));
    expect(await screen.findByRole("dialog", { name: "智慧图书馆预约系统" })).toBeVisible();
    expect(screen.queryByText("负责人：New Student")).not.toBeInTheDocument();
    expect(screen.queryByText("e91237c8-5ccf-45aa-b0d2-822b96915a24")).not.toBeInTheDocument();
    expect(screen.queryByText("4 位成员")).not.toBeInTheDocument();
    expect(screen.getByText(`最近更新：${formatProjectDateTimeMinute(projectUpdatedAt)}`)).toBeInTheDocument();
    expect(screen.getAllByText("本地项目").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("link", { name: "进入项目 智慧图书馆预约系统" }));

    expect(window.location.pathname).toBe("/projects/library-booking");
    expect(await screen.findByText("项目导航")).toBeInTheDocument();
    expect(screen.queryByText("设计做好了？")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去连接" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="sidebar-inset"] > footer')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="sidebar-content"] [data-slot="scroll-area"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "项目首页" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="sidebar-container"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成任务" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "历史快照" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "运行历史" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "项目设置" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "成员" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "文档中心" })).not.toBeInTheDocument();
    expect(screen.getByText("智慧图书馆预约系统")).toBeInTheDocument();
    expect(screen.queryByText("运行中 1")).not.toBeInTheDocument();
    expect(screen.queryByText("文档 1")).not.toBeInTheDocument();
  });

  it("omits the selection hint and copyright footer from model pages", async () => {
    const user = userEvent.setup();
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    const navigation = await screen.findByRole("navigation", { name: "项目导航" });
    expect(document.querySelector('[data-slot="sidebar-inset"] > footer')).not.toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: /^需求模型$/u }));
    expect(await screen.findByRole("heading", { name: "目标模型" })).toBeInTheDocument();
    expect(screen.queryByText(/勾选不会立即生效/u)).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="sidebar-inset"] > footer')).not.toBeInTheDocument();
  });

  it("filters local projects by modeling mode without collaboration controls", async () => {
    const user = userEvent.setup();
    projectApiMode = "authenticated";
    render(withWorkspaceProviders(<Shell />, createRepository()));

    window.history.pushState({}, "", "/projects");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(await screen.findByRole("heading", { name: "智慧图书馆预约系统" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "归档课程演示" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "快速项目" }));
    expect(screen.queryByRole("heading", { name: "智慧图书馆预约系统" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "归档课程演示" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "工程项目" }));
    expect(screen.getByRole("heading", { name: "智慧图书馆预约系统" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "归档课程演示" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "协作项目" })).not.toBeInTheDocument();
  });

  it("renders the supplied bento for signed-in users without projects and creates projects from the header", async () => {
    const user = userEvent.setup();
    authSessionMode = "authenticated";
    projectApiMode = "empty";
    window.history.pushState({}, "", "/projects");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(await screen.findByRole("heading", { name: "从一句需求到完整的工程交付" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "还没有项目" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "查看引导" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "新建项目" }));

    expect(window.location.pathname).toBe("/projects");
    expect(await screen.findByRole("dialog", { name: "创建项目" })).toBeInTheDocument();
    expect(screen.getByLabelText("项目名称")).toHaveValue("");
    const descriptionInput = screen.getByLabelText("项目描述");
    expect(descriptionInput.tagName).toBe("TEXTAREA");
    expect(descriptionInput).toHaveAttribute("rows", "4");
    await user.type(screen.getByLabelText("项目名称"), "订单系统");
    expect(screen.queryByRole("group", { name: "可见性" })).not.toBeInTheDocument();
    expect(screen.getByText("项目与生成结果保存在本机，可随时继续建模并导出文档。")).toBeInTheDocument();
    expect(screen.queryByLabelText("课程 / 班级 / 团队")).not.toBeInTheDocument();
  });

  it("opens the project creation form in a dialog from the projects page", async () => {
    const user = userEvent.setup();
    authSessionMode = "authenticated";
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "新建项目" })).toBeEnabled();
    });
    await user.click(screen.getByRole("button", { name: "新建项目" }));

    expect(window.location.pathname).toBe("/projects");
    expect(await screen.findByRole("dialog", { name: "创建项目" })).toBeInTheDocument();
    const descriptionInput = screen.getByLabelText("项目描述");
    expect(descriptionInput.tagName).toBe("TEXTAREA");
    expect(descriptionInput).toHaveAttribute("rows", "4");
    await user.type(screen.getByLabelText("项目名称"), "订单系统");
    expect(screen.queryByRole("group", { name: "可见性" })).not.toBeInTheDocument();
    expect(screen.getByText("项目与生成结果保存在本机，可随时继续建模并导出文档。")).toBeInTheDocument();
    expect(screen.queryByLabelText("课程 / 班级 / 团队")).not.toBeInTheDocument();
    expect(screen.queryByText("默认模型策略")).not.toBeInTheDocument();
  });

  it("blocks the project workspace body when project access is forbidden", async () => {
    projectApiMode = "forbidden";
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(await screen.findByRole("heading", { name: "403 — 无权访问" })).toBeInTheDocument();
    expect(screen.getByText("当前账户没有此项目的访问权限")).toBeInTheDocument();
    expect(screen.queryByText("项目导航")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "关闭 需求" })).not.toBeInTheDocument();
  });

  it("keeps requirement controls read-only when the project role lacks edit and run permissions", async () => {
    const user = userEvent.setup();
    projectApiMode = "authenticated";
    authSessionMode = "authenticated";
    const repository: WorkspaceRepository = {
      ...createRepository(),
      getProjectAccess: vi.fn(async () => ({ capabilities: [
        "view_project",
        "view_runs",
        "view_documents",
      ] })),
    };
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, repository));

    const requirementText = await screen.findByRole("textbox", {
      name: "系统业务需求",
    });
    await waitFor(() => {
      expect(requirementText).toBeDisabled();
    });
    expect(screen.getByText("当前项目角色仅允许查看，不能编辑内容或启动生成。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提取需求规则" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停止生成" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /电商系统/ })).not.toBeInTheDocument();

    await user.type(requirementText, "访客不应写入需求");


  });

  it("keeps project settings read-only for viewer members", async () => {
    projectApiMode = "authenticated";
    authSessionMode = "authenticated";
    projectMembershipRole = "viewer";
    window.history.pushState({}, "", "/projects/library-booking/settings");

    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(await screen.findByRole("region", { name: "项目设置" })).toBeInTheDocument();
    expect(screen.getByText("当前项目角色不能管理项目设置。")).toBeInTheDocument();
    expect(screen.getByLabelText("项目信息")).toBeDisabled();
    expect(screen.getByLabelText("项目描述")).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存项目设置" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "数据导出" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除项目" })).toBeDisabled();
  });

  it("keeps task details in a drawer without a member-management entry", async () => {
    const user = userEvent.setup();
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(await screen.findByText("智慧图书馆预约系统")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "生成任务" }));

    expect(window.location.pathname).toBe("/projects/library-booking");
    expect(await screen.findByRole("dialog", { name: "生成任务" })).toBeInTheDocument();
    expect(screen.getByTestId("project-workspace-drawer-layer")).toBeInTheDocument();
    const overlay = document.querySelector<HTMLElement>("[data-slot='drawer-overlay']");

    await user.click(overlay as HTMLElement);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "生成任务" })).not.toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "成员" })).not.toBeInTheDocument();
  });

  it("opens the real task drawer and selects the requested server run", async () => {
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, createRepository()));
    expect(await screen.findByText("智慧图书馆预约系统")).toBeInTheDocument();

    act(() => requestOpenGenerationTask({ runId: "run-1" }));

    const drawer = await screen.findByRole("dialog", { name: "生成任务" });
    expect(within(drawer).queryByText("run-1")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/projects/library-booking");
  });

  it("opens connection settings in the account dialog global settings tab", async () => {
    projectApiMode = "authenticated";
    authSessionMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, createRepository()));
    expect(await screen.findByText("智慧图书馆预约系统")).toBeInTheDocument();

    act(() => requestOpenProjectWorkspaceTarget("provider-settings"));

    const dialog = await screen.findByRole("dialog", { name: "设置" });
    expect(within(dialog).getByRole("tab", { name: "模型配置" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("dialog", { name: "项目设置" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/projects/library-booking");
  });

  it("switches project management pages without opening overlays", async () => {
    const user = userEvent.setup();
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, createRepository()));
    const navigation = await screen.findByRole("navigation", { name: "项目导航" });
    for (const [label, section, heading] of [
      ["链路图", "lineage", "全局链路图"],
      ["运行历史", "history", "运行历史"],
      ["项目设置", "settings", "项目设置"],
    ]) {
      await user.click(within(navigation).getByRole("button", { name: label }));
      expect(window.location.pathname).toBe('/projects/library-booking/' + section);
      expect(await screen.findByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
      expect(within(navigation).getByRole("button", { name: label })).toHaveAttribute("aria-current", "page");
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.queryByTestId("project-workspace-drawer-layer")).not.toBeInTheDocument();
      expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
      expect(document.querySelector('[data-slot="sidebar-inset"] > header')).not.toHaveTextContent(label);
    }
  });

  it("keeps the project session and workspace mounted through menu and browser history changes", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, repository));
    const navigation = await screen.findByRole("navigation", { name: "项目导航" });
    await waitFor(() => expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument());
    const authCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/api/auth/me")).length;
    const initialAuthCalls = authCalls();
    const initialWorkspaceLoads = vi.mocked(repository.loadWorkspace).mock.calls.length;
    const runListCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/api/projects/library-booking/runs")).length;
    const initialRunListCalls = runListCalls();
    await user.click(within(navigation).getByRole("button", { name: "需求模型" }));
    expect(await screen.findByRole("heading", { name: "目标模型" })).toBeInTheDocument();
    for (const name of ["链路图", "运行历史", "项目设置"]) {
      await user.click(within(navigation).getByRole("button", { name }));
      expect(screen.getByRole("navigation", { name: "项目导航" })).toBe(navigation);
      expect(screen.queryByTestId("auth-check-placeholder")).not.toBeInTheDocument();
      expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
      expect(authCalls()).toBe(initialAuthCalls);
    }
    act(() => window.history.back());
    expect(await screen.findByRole("heading", { name: "运行历史" })).toBeInTheDocument();
    act(() => window.history.forward());
    expect(await screen.findByRole("heading", { name: "项目设置" })).toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: "需求模型" }));
    expect(window.location.pathname).toBe("/projects/library-booking");
    expect(await screen.findByRole("heading", { name: "目标模型" })).toBeInTheDocument();
    expect(authCalls()).toBe(initialAuthCalls);
    expect(vi.mocked(repository.loadWorkspace).mock.calls.length).toBe(initialWorkspaceLoads);
    expect(runListCalls()).toBe(initialRunListCalls);
    expect(screen.queryByTestId("platform-loading-screen")).not.toBeInTheDocument();
  });

  it.each(["settings", "history", "lineage"])("opens the %s section from a direct child route", async section => {
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking/" + section);
    render(withWorkspaceProviders(<Shell />, createRepository()));
    await screen.findByText("智慧图书馆预约系统");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.queryByTestId("project-workspace-drawer-layer")).not.toBeInTheDocument();
    expect(screen.getByText("项目导航")).toBeInTheDocument();
  });

  it("loads project run history without offering task controls", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    await user.click(await screen.findByRole("button", { name: "运行历史" }));

    expect(await screen.findByRole("region", { name: "运行历史" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/projects/library-booking/history");
    expect(screen.getByText("项目导航")).toBeInTheDocument();
    expect(await screen.findByText("生成需求模型")).toBeInTheDocument();
    expect(screen.getByText("生成设计模型")).toBeInTheDocument();
    const historyTable = screen.getByRole("table");
    expect(within(historyTable).getByRole("columnheader", { name: "模型" })).toBeInTheDocument();
    expect(within(historyTable).getByRole("columnheader", { name: "操作者" })).toBeInTheDocument();
    expect(within(historyTable).getByText("需求分析师")).toBeInTheDocument();
    expect(within(historyTable).getByText("未知成员 bbbbbbbb")).toBeInTheDocument();
    expect(screen.queryByText("操作者 需求分析师")).not.toBeInTheDocument();
    expect(screen.queryByText("操作者 未知成员 bbbbbbbb")).not.toBeInTheDocument();
    expect(getSelectTrigger("筛选状态")).toBeInTheDocument();
    expect(getSelectTrigger("筛选阶段")).toBeInTheDocument();
    expect(screen.queryByLabelText("筛选模型")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "返回工作台" })).not.toBeInTheDocument();
    const runListRequests = () => fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/projects/library-booking/runs")).length;
    const previousRequests = runListRequests();
    await user.click(screen.getByRole("button", { name: "刷新历史" }));
    await waitFor(() => expect(runListRequests()).toBeGreaterThan(previousRequests));
    expect(screen.queryByText("run-1")).not.toBeInTheDocument();
    expect(screen.queryByText("a3023f76-6da3-4fcd-9a82-8a187c30691d")).not.toBeInTheDocument();
    expect(screen.queryByText("未记录阶段")).not.toBeInTheDocument();
    expect(screen.queryByText(/未记录/)).not.toBeInTheDocument();
    expect(screen.queryByText("操作者 系统")).not.toBeInTheDocument();
    expect(screen.getAllByText("运行中").length).toBeGreaterThan(0);

    expect(screen.queryByRole("button", { name: "取消任务" })).not.toBeInTheDocument();
  });

  it("filters project history and shows errors without generation actions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const repository = createRepository();
    repository.listRunHistory = vi.fn(async (): Promise<RunHistoryItem[]> => [
      {
        id: "run-1",
        createdAt: "2026-05-22T02:05:00.000Z",
        title: "需求生成",
        providerModel: "gpt-5-mini",
        snapshot: createRunSnapshot({
          runId: "run-1",
          requirementText: "生成图书馆预约系统 UML",
        }),
      },
    ]);
    repository.deleteRunHistory = vi.fn(async () => []);
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, repository));

    await user.click(await screen.findByRole("button", { name: "运行历史" }));

    expect(await screen.findByText("生成需求模型")).toBeInTheDocument();
    expect(screen.getByText("生成设计模型")).toBeInTheDocument();
    expect(screen.queryByText("run-1")).not.toBeInTheDocument();
    expect(screen.queryByText("run-failed")).not.toBeInTheDocument();
    await chooseSelectOption(user, getSelectTrigger("筛选状态"), "失败");
    expect(screen.queryByText("生成需求模型")).not.toBeInTheDocument();
    const failedDesignCard = screen.getByText("生成设计模型").closest("tr");
    expect(failedDesignCard).toBeTruthy();
    const failedDesignControls = within(failedDesignCard as HTMLElement);
    await user.click(failedDesignControls.getByRole("button", { name: "查看运行记录 run-failed" }));
    const runDetails = await screen.findByRole("dialog", { name: "运行详情" });
    expect(runDetails).toHaveTextContent("生成任务失败，请稍后重试。");
    expect(runDetails).not.toHaveTextContent("PlantUML render failed");
    for (const name of ["重试", "重新运行", "恢复快照", "取消任务", "重新下载"]) {
      expect(failedDesignControls.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(fetchMock.mock.calls.some(([url, options]) =>
      /\/runs\/[^/]+\/(retry|rerun|restore-workspace)$/.test(String(url)) && options?.method === "POST"
    )).toBe(false);
  });

  it("shows run history actions only when each run supports them", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const repository = createRepository();
    repository.listRunHistory = vi.fn(async (): Promise<RunHistoryItem[]> => [
      {
        id: "run-1",
        createdAt: "2026-05-22T02:05:00.000Z",
        title: "需求生成",
        providerModel: "gpt-5-mini",
        snapshot: createRunSnapshot({
          runId: "run-1",
          requirementText: "生成图书馆预约系统 UML",
        }),
      },
      {
        id: "run-doc",
        createdAt: "2026-05-22T00:05:00.000Z",
        title: "需求规格说明书",
        providerModel: "gpt-5-mini",
        snapshot: createDocumentRunSnapshot({
          runId: "run-doc",
          documentKind: "requirementsSpec",
          requirementText: "生成图书馆预约系统 UML",
          documentId: "doc-1",
          sections: [],
          fileName: "requirements.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          byteLength: 1234,
          missingArtifacts: [],
          currentStage: "generate_document_text",
          status: "completed",
          error: null,
        }),
      },
      {
        id: "run-doc-failed",
        createdAt: "2026-05-21T23:05:00.000Z",
        title: "失败的需求规格说明书",
        providerModel: "gpt-5-mini",
        snapshot: createDocumentRunSnapshot({
          runId: "run-doc-failed",
          documentKind: "requirementsSpec",
          requirementText: "生成图书馆预约系统 UML",
          documentId: "doc-failed",
          sections: [],
          fileName: "failed-requirements.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          byteLength: 1234,
          missingArtifacts: [],
          currentStage: "render_document_file",
          status: "failed",
          error: {
            code: "RUN_INTERNAL_ERROR",
            message: "证据包组装失败",
            category: "internal",
            retryable: true,
          },
        }),
      },
    ]);

    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, repository));

    await user.click(await screen.findByRole("button", { name: "运行历史" }));

    const runningCard = (await screen.findByText("生成需求模型")).closest("tr");
    const failedCard = screen.getByText("生成设计模型").closest("tr");
    const documentCard = screen.getByRole("button", { name: "查看运行记录 run-doc" }).closest("tr");
    const failedDocumentCard = screen.getByRole("button", { name: "查看运行记录 run-doc-failed" }).closest("tr");
    expect(runningCard).toBeTruthy();
    expect(failedCard).toBeTruthy();
    expect(documentCard).toBeTruthy();
    expect(failedDocumentCard).toBeTruthy();

    const runningControls = within(runningCard as HTMLElement);
    expect(runningControls.queryByRole("button", { name: "取消任务" })).not.toBeInTheDocument();
    expect(runningControls.queryByRole("button", { name: "查看错误" })).not.toBeInTheDocument();
    expect(runningControls.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(runningControls.queryByRole("button", { name: "重新运行" })).not.toBeInTheDocument();
    expect(runningControls.queryByRole("button", { name: "恢复快照" })).not.toBeInTheDocument();
    expect(runningControls.queryByRole("button", { name: "导出报告" })).not.toBeInTheDocument();
    expect(runningControls.queryByRole("button", { name: "重新下载" })).not.toBeInTheDocument();
    expect(runningControls.getByRole("button", { name: "删除运行记录 run-1" })).toBeDisabled();

    const failedControls = within(failedCard as HTMLElement);
    expect(failedControls.queryByRole("button", { name: "取消任务" })).not.toBeInTheDocument();
    expect(failedControls.getByRole("button", { name: "查看运行记录 run-failed" })).toBeInTheDocument();
    expect(failedControls.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(failedControls.queryByRole("button", { name: "重新运行" })).not.toBeInTheDocument();
    expect(failedControls.queryByRole("button", { name: "恢复快照" })).not.toBeInTheDocument();
    expect(failedControls.queryByRole("button", { name: "导出报告" })).not.toBeInTheDocument();
    expect(failedControls.queryByRole("button", { name: "重新下载" })).not.toBeInTheDocument();
    expect(failedControls.getByRole("button", { name: "删除运行记录 run-failed" })).toBeInTheDocument();

    const documentControls = within(documentCard as HTMLElement);
    expect(documentControls.queryByRole("button", { name: "取消任务" })).not.toBeInTheDocument();
    expect(documentControls.queryByRole("button", { name: "查看错误" })).not.toBeInTheDocument();
    expect(documentControls.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
    expect(documentControls.queryByRole("button", { name: "重新运行" })).not.toBeInTheDocument();
    expect(documentControls.queryByRole("button", { name: "恢复快照" })).not.toBeInTheDocument();
    expect(documentControls.queryByRole("button", { name: "导出报告" })).not.toBeInTheDocument();
    expect(documentControls.queryByRole("button", { name: "重新下载" })).not.toBeInTheDocument();
    expect(documentControls.getByRole("button", { name: "删除运行记录 run-doc" })).toBeInTheDocument();

    const failedDocumentControls = within(failedDocumentCard as HTMLElement);
    expect(failedDocumentControls.getByRole("button", { name: "查看运行记录 run-doc-failed" })).toBeInTheDocument();
    expect(failedDocumentControls.queryByRole("button", { name: "重新下载" })).not.toBeInTheDocument();
    expect(failedDocumentControls.getByRole("button", { name: "删除运行记录 run-doc-failed" })).toBeInTheDocument();

    await user.click(failedControls.getByRole("button", { name: "删除运行记录 run-failed" }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/library-booking/runs/run-failed"),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(repository.deleteRunHistory).toHaveBeenCalledWith("run-failed");
  });

  it("creates projects with explicit mode and member-only access", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    window.history.pushState({}, "", "/projects/new");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    expect(screen.queryByRole("button", { name: "选择背景图" })).not.toBeInTheDocument();

    expect(screen.queryByLabelText("课程 / 班级 / 团队")).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText("项目名称"), "课程 UML 实验项目");
    expect(screen.queryByText("默认模型策略")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "创建并进入项目" }));

    const createCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/projects") && init?.method === "POST");
    expect(createCall).toBeDefined();
    const payload = JSON.parse(String(createCall?.[1]?.body));
    expect(payload).toEqual({
      projectMode: "standard",
      name: "课程 UML 实验项目",
      description: null,
      backgroundKey: expect.any(String),
    });
    expect(PROJECT_BACKGROUND_OPTIONS.map(({ key }) => key)).toContain(payload.backgroundKey);
    expect(
      await screen.findByText("项目已创建，正在进入项目。"),
    ).toBeInTheDocument();
  });

  it("prefers managed provider configs for logged-in model settings", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects");
    render(withWorkspaceProviders(<Shell />, repository));

    await waitForPlatformLoadingToExit();
    await user.click(await screen.findByRole("button", { name: "用户菜单" }));
    await user.click(await screen.findByRole("menuitem", { name: "设置" }));
    await user.click(await screen.findByRole("tab", { name: "模型配置" }));
    expect(await screen.findByRole("heading", { name: "模型配置" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "模型" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "偏好" })).not.toBeInTheDocument();
    expect(screen.getAllByText("模型配置").length).toBeGreaterThan(0);
    expect(screen.queryByRole("switch", { name: "修改后自动重新生成规则" })).not.toBeInTheDocument();
    expect(screen.queryByText("深色主题")).not.toBeInTheDocument();
    expect(screen.queryByText("字号")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "修改后自动重新生成规则" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "显示过期模型横幅" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("模型配置和工作台偏好集中在这里；登录态不会把明文密钥作为主路径保存。"),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("课程 OpenAI 托管配置")).toBeInTheDocument();
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(loadUserSettings()).toMatchObject({
        providerConfigId: "provider-config-1",
        defaultModel: "gpt-5.5",
        providerDefaultModelSeededFor: "provider-config-1",
      });
    });
    expect(loadUserSettings()).not.toHaveProperty("apiKey");
    expect(screen.queryByRole("button", { name: "测试托管配置" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole(
        "button",
        { name: "添加供应商" },
        { timeout: 5_000 },
      ),
    ).toBeEnabled();
  });

  it("auto-selects the first active managed provider on protected routes", async () => {
    projectApiMode = "authenticated";
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitForPlatformLoadingToExit();
    await waitFor(() => {
      expect(loadUserSettings()).toMatchObject({
        providerConfigId: "provider-config-1",
        providerLabel: "OpenAI",
        providerModelOptions: ["gpt-5.5", "gpt-5.4"],
        defaultModel: "gpt-5.5",
      });
    });
  });

  it("replaces a stale local provider with the first active managed provider", async () => {
    projectApiMode = "authenticated";
    localStorage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        providerConfigId: "provider-stale",
        providerLabel: "旧 Provider",
        providerModelOptions: ["old-model"],
        providerModelCapabilities: {},
        defaultModel: "old-model",
        autoGenerate: false,
        showStaleBanner: true,
      }),
    );
    window.history.pushState({}, "", "/projects/library-booking");
    render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitForPlatformLoadingToExit();
    await waitFor(() => {
      expect(loadUserSettings()).toMatchObject({
        providerConfigId: "provider-config-1",
        providerModelOptions: ["gpt-5.5", "gpt-5.4"],
        defaultModel: "gpt-5.5",
      });
    });
  });

  it("hydrates saved provider model catalogs when a project workspace is refreshed", async () => {
    projectApiMode = "authenticated";
    providerConfigFixtures = [
      {
        id: "provider-config-1",
        name: "Nonelinear 模型网关",
        provider: "nonelinear",
        baseUrl: "https://api.nonelinear.com",
        defaultModel: "qwen3.7-plus",
        allowedModels: ["qwen3.7-plus", "qwen3.7-max"],
        modelCapabilities: {
          "qwen3.7-plus": {
            id: "qwen3.7-plus",
            supportsJsonSchema: false,
            supportsJsonObject: true,
            structuredOutputMode: "json_object",
            modeLabel: "JSON 模式",
          },
        },
        maskedKey: "sk-...7e6a",
        status: "active",
        riskState: "low",
        quota: "unlimited",
        lastUsedAt: null,
        scopeType: "system",
        scopeId: null,
      },
    ];
    localStorage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        providerConfigId: "provider-config-1",
        providerLabel: "Nonelinear",
        providerModelOptions: [],
        providerModelCapabilities: {},
        defaultModel: "qwen3.7-plus",
      }),
    );
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitForPlatformLoadingToExit();
    expect(await screen.findByRole("heading", { name: "系统需求" })).toBeInTheDocument();
    await waitFor(() => {
      expect(loadUserSettings().providerModelOptions).toEqual([
        "qwen3.7-plus",
        "qwen3.7-max",
      ]);
    });
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "选择模型" })).toHaveTextContent("qwen3.7-plus");
    });
  });

  it("keeps model selection empty when no managed providers are available", async () => {
    projectApiMode = "authenticated";
    providerConfigFixtures = [];
    window.history.pushState({}, "", "/projects/library-booking");

    const fetchMock = vi.mocked(fetch);
    const defaultFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      // This setup scenario is idle; active runs deliberately lock model changes.
      if (new URL(String(input), "http://localhost").pathname === "/api/projects/library-booking/runs") return Response.json({ runs: [] });
      return defaultFetch(input, init);
    });
    render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitForPlatformLoadingToExit();
    expect(await screen.findByRole("heading", { name: "系统需求" })).toBeInTheDocument();
    expect(loadUserSettings().providerConfigId).toBe("");
    expect(screen.getByRole("combobox", { name: "选择模型" })).toHaveTextContent("选择模型");
    expect(screen.queryByText("尚未配置可用的模型供应商")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "选择模型" })).toBeEnabled());
    await user.click(screen.getByRole("combobox", { name: "选择模型" }));
    expect(await screen.findByText("尚未配置可用的模型供应商")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "配置供应商" }));
    expect(screen.queryByText("尚未配置可用的模型供应商")).not.toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: "设置" });
    expect(await within(dialog).findByRole("button", { name: "添加供应商" })).toBeVisible();
  });

  it("clears stale provider settings when no active providers are available", async () => {
    projectApiMode = "authenticated";
    providerConfigFixtures = [];
    localStorage.setItem(
      USER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        providerConfigId: "deleted-provider",
        providerLabel: "旧 Provider",
        providerModelOptions: ["old-model"],
        providerModelCapabilities: {
          "old-model": { structuredOutputMode: "strict_json" },
        },
        defaultModel: "old-model",
      }),
    );
    window.history.pushState({}, "", "/projects/library-booking");

    render(withWorkspaceProviders(<Shell />, createRepository()));

    await waitForPlatformLoadingToExit();
    expect(await screen.findByRole("heading", { name: "系统需求" })).toBeInTheDocument();
    await waitFor(() => {
      expect(loadUserSettings()).toMatchObject({
        providerConfigId: "",
        providerLabel: "",
        providerModelOptions: [],
        providerModelCapabilities: {},
      });
    });
    expect(screen.getByRole("combobox", { name: "选择模型" })).toHaveTextContent("选择模型");
  });
  it("keeps backend connection failures on the desktop and can reconnect without login", async () => {
    authSessionMode = "unauthenticated";
    window.history.pushState({}, "", "/projects");
    render(withWorkspaceProviders(<Shell />, createRepository()));
    expect(await screen.findByRole("alert")).toHaveTextContent("本地工作区暂时无法连接");
    expect(window.location.pathname).toBe("/projects");
    expect(screen.queryByLabelText("用户名")).not.toBeInTheDocument();
    authSessionMode = "authenticated";
    await userEvent.click(screen.getByRole("button", { name: "重新连接" }));
    await waitFor(() => expect(screen.queryByText("本地工作区暂时无法连接")).not.toBeInTheDocument());
  });

});
