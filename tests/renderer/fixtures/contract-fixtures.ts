// Builds complete current API and render fixtures for component regressions.
import type { AuthSessionResponse, ProjectInvitationDto, ProjectInvitationResponse, RenderSvgResponse, RunSnapshot } from "../../../src/shared/contracts/index.js";
export function createAuthSessionResponse(overrides: {
  user?: Partial<AuthSessionResponse["user"]>;
  session?: Partial<AuthSessionResponse["session"]>;
} = {}): AuthSessionResponse {
  const timestamp = "2026-05-22T02:00:00.000Z";
  const user: AuthSessionResponse["user"] = {
    id: "user-new", username: "new_student", displayName: "new-student", avatarUrl: null,
    status: "active", mfaEnabled: false, systemRoles: [], createdAt: timestamp, updatedAt: timestamp,
    lastLoginAt: timestamp, ...overrides.user,
  };
  return {
    user,
    session: { id: "session-login", userId: user.id, createdAt: timestamp, expiresAt: "2026-06-01T02:00:00.000Z",
      lastSeenAt: timestamp, ipAddress: null, userAgent: null, ...overrides.session },
  };
}

export function createProjectInvitationResponse(overrides: Partial<ProjectInvitationDto> = {}): ProjectInvitationResponse {
  const timestamp = "2026-05-22T02:00:00.000Z";
  return { invitation: { id: "invitation", projectId: "project-members-test", username: "invitee", role: "viewer",
    status: "invited", invitedByUserId: "owner", invitedAt: timestamp, createdAt: timestamp, updatedAt: timestamp, ...overrides } };
}

export function createRenderMeta(
  overrides: Partial<RenderSvgResponse["renderMeta"]> = {},
): RenderSvgResponse["renderMeta"] {
  return {
    engine: "plantuml",
    generatedAt: "2026-06-05T00:00:00.000Z",
    sourceLength: 0,
    durationMs: 0,
    ...overrides,
  };
}

export function createRunSnapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return { runId: "run-test", operationType: "quick_modeling", outputManifest: [], currentStage: null, status: "completed", error: null,
    standardRun: { operation: "chat", model: "test", providerConfigId: "provider", baseline: {}, artifacts: [] }, ...overrides };
}
