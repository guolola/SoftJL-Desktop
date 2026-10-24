// Wires assembled server dependencies into HTTP route modules without owning route behavior.
import type { FastifyInstance,FastifyRequest } from "fastify";
import { join } from "node:path";
import type { ConversationCodingHost } from "../adapters/coding/conversation-coding-host.js";
import type { LlmScheduler } from "../adapters/llm/llm-scheduler.js";
import type { LlmTransport } from "../adapters/llm/llm-transport.js";
import type { PdfRenderClient } from "../adapters/render/pdf-render-client.js";
import type { PngRenderClient } from "../adapters/render/png-render-client.js";
import type { RenderClient } from "../adapters/render/render-client.js";
import { hasProjectPermission,type AuthStore } from "../auth/in-memory-auth-store.js";
import { readSessionCookie } from "../auth/session-cookie.js";
import type { DocumentLibrary } from "../documents/library/document-library.js";
import type { GenerationUsageService } from "../generation/generation-usage.js";
import type { ProviderConfigStore } from "../provider-configs/provider-config-store.js";
import type { ProviderUsageTracker } from "../provider-configs/provider-usage-tracker.js";
import { registerAccountRoutes } from "../routes/account/register-account-routes.js";
import { registerAuthRoutes } from "../routes/auth/register-auth-routes.js";
import { registerDashboardRoutes } from "../routes/dashboard/register-dashboard-routes.js";
import { registerDocumentRoutes } from "../routes/documents/register-document-routes.js";
import { registerHealthRoutes } from "../routes/health/register-health-routes.js";
import { registerInboxRoutes } from "../routes/inbox/register-inbox-routes.js";
import { registerProjectRoutes } from "../routes/projects/register-project-routes.js";
import { registerProviderConfigRoutes } from "../routes/provider-configs/register-provider-config-routes.js";
import { registerRenderRoutes } from "../routes/render/register-render-routes.js";
import { registerRunRoutes } from "../routes/runs/register-run-routes.js";
import type { RunAccessContext } from "../routes/runs/run-access.js";
import { registerStandardProjectRoutes } from "../routes/standard/register-standard-project-routes.js";
import { registerSystemNoticeRoutes } from "../routes/system-notices/register-system-notice-routes.js";
import type { StandardAgentResourceProvider } from "../runs/pipelines/standard/standard-agent-resources.js";
import type { RunRecordStore } from "../runs/records/run-record-store.js";
import type { RunTelemetryStore } from "../runs/records/run-telemetry-store.js";
import type { SystemNoticeStore } from "../system-notices/records/system-notice-store.js";
import { createModelCatalog } from "./model-catalog.js";
import { resolveRuntimeCwd } from "./runtime.js";
export type { RunAccessContext } from "../routes/runs/run-access.js";
type HealthPayload = Parameters<typeof registerHealthRoutes>[0]["healthPayload"];
type VersionPayload = Parameters<typeof registerHealthRoutes>[0]["versionPayload"];
export type RegisterApiRoutesOptions = {
    codingHost?: ConversationCodingHost;
    agentResources?: StandardAgentResourceProvider;
    app: FastifyInstance;
    healthPayload: HealthPayload;
    versionPayload: VersionPayload;
    authStore: AuthStore;
    generationUsage: GenerationUsageService;
    nodeEnv: string | null;
    runs: RunRecordStore;
    documentLibrary: DocumentLibrary;
    providerConfigs: ProviderConfigStore;
    providerUsageTracker?: ProviderUsageTracker;
    llmScheduler: LlmScheduler;
    llmTransport: LlmTransport;
    renderClient: RenderClient;
    pngRenderClient: PngRenderClient;
    pdfRenderClient?: PdfRenderClient;
    systemNoticeStore: SystemNoticeStore;
    analyticsStore: RunTelemetryStore;
    databaseProbe?: () => Promise<void>;
    testRunAccessContext?: RunAccessContext;
};
export function registerApiRoutes({ codingHost, agentResources, app, healthPayload, versionPayload, authStore, generationUsage, nodeEnv, runs, documentLibrary, providerConfigs, providerUsageTracker, llmScheduler, llmTransport, renderClient, pngRenderClient, pdfRenderClient, systemNoticeStore, analyticsStore, databaseProbe, testRunAccessContext, }: RegisterApiRoutesOptions) {
    const activeUserIdFromRequest = async (request: FastifyRequest) => {
        const sessionId = readSessionCookie(request);
        const session = sessionId ? await authStore.getActiveSession(sessionId) : null;
        const user = session ? await authStore.getUser(session.userId) : null;
        return user?.status === "active" ? user.id : null;
    };
    const projectMembershipGuard = async ({ projectId, userId, permission, }: {
        projectId: string;
        userId: string;
        permission: Parameters<typeof hasProjectPermission>[1];
    }) => {
        const member = await authStore.findProjectMember(projectId, userId);
        return Boolean(member && hasProjectPermission(member.role, permission));
    };
    const modelCatalog = createModelCatalog(app, nodeEnv);
    registerStandardProjectRoutes({ app, runs, authStore, llmTransport, llmScheduler, renderClient, pngRenderClient, modelCatalog, providerConfigs, providerUsageTracker, generationUsage, analyticsStore, documentLibrary, agentResources, codingHost });
    registerHealthRoutes({ app, healthPayload, versionPayload });
    registerInboxRoutes({ app, authStore });
    registerAuthRoutes({
        app,
        authStore,
    });
    registerAccountRoutes({
        app,
        authStore,
        generationUsage,
        avatarStorageDir: process.env.UML_AVATAR_STORAGE_DIR ??
            join(resolveRuntimeCwd(), "data", "avatars"),
    });
    registerProjectRoutes({
        app,
        authStore,
    });
    registerDashboardRoutes({ app, authStore, runs, documentLibrary });
    registerProviderConfigRoutes({
        app,
        authStore,
        providerConfigs,
    });
    registerSystemNoticeRoutes({
        app,
        authStore,
        systemNotices: systemNoticeStore,
    });
    registerDocumentRoutes({
        app,
        documentLibrary,
        resolveUserId: activeUserIdFromRequest,
        projectMembershipGuard,
        recordAuditLog: (event) => authStore.recordAuditLog({
            actorUserId: event.actorUserId,
            action: event.action,
            targetType: event.targetType,
            targetId: event.targetId,
            outcome: event.outcome,
            message: event.message,
        }),
    });
    registerRunRoutes({ app, authStore, runs, analyticsStore });
    registerRenderRoutes({
        app,
        renderClient,
        pngRenderClient,
        pdfRenderClient,
        resolveUserId: activeUserIdFromRequest,
        projectMembershipGuard,
    });
}
