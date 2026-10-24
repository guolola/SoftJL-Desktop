// Builds project route response payloads without owning endpoint authorization.
import {
projectDtoSchema,
projectInvitationDtoSchema,
projectMemberRolePermissions
} from "../../../shared/contracts/index.js";
import { toProjectDto,toProjectMemberDto } from "../auth/dto.js";
import type {
AuthStore,
ProjectMemberRecord,
ProjectRecord,
} from "../auth/in-memory-auth-store.js";

const DEFAULT_PROJECT_WORKSPACE_BODY_LIMIT_BYTES = 50 * 1024 * 1024;

export function toProjectInvitationDto(input: {
  member: Parameters<typeof toProjectMemberDto>[0];
  project?: Parameters<typeof toProjectDto>[0];
}) {
  return projectInvitationDtoSchema.parse({
    id: input.member.id,
    projectId: input.member.projectId,
    username: input.member.username,
    role: input.member.role,
    status: input.member.status,
    invitedByUserId: input.member.invitedByUserId,
    invitedAt: input.member.invitedAt,
    createdAt: input.member.createdAt,
    updatedAt: input.member.updatedAt,
    project: input.project ? toProjectDto(input.project) : undefined,
  });
}

export function projectPayload(input: {
  project: Parameters<typeof toProjectDto>[0];
  member: Parameters<typeof toProjectMemberDto>[0];
}) {
  return {
    project: toProjectDto(input.project),
    membership: toProjectMemberDto(input.member),
    currentUserRole: input.member.role,
    capabilities: projectMemberRolePermissions[input.member.role],
  };
}

function displayNameFromMember(member: ProjectMemberRecord) {
  return member.displayName?.trim() || member.username || member.userId || null;
}

function activeMemberPreviewSort(project: ProjectRecord) {
  return (left: ProjectMemberRecord, right: ProjectMemberRecord) => {
    if (left.userId === project.ownerUserId) return -1;
    if (right.userId === project.ownerUserId) return 1;
    return left.createdAt.localeCompare(right.createdAt);
  };
}

export async function projectListPayload(
  authStore: AuthStore,
  project: ProjectRecord,
) {
  const activeMembers = (await authStore.listProjectMembers(project.id))
    .filter((member) => member.status === "active")
    .sort(activeMemberPreviewSort(project));
  const ownerMember = activeMembers.find(
    (member) => member.userId === project.ownerUserId,
  );
  const ownerUser = await authStore.getUser(project.ownerUserId);
  const ownerDisplayName = ownerMember
    ? displayNameFromMember(ownerMember)
    : ownerUser?.displayName ?? ownerUser?.username ?? null;

  return projectDtoSchema.parse({
    ...project,
    ownerDisplayName,
    ownerAvatarUrl: ownerMember?.avatarUrl ?? ownerUser?.avatarUrl ?? null,
    memberCount: activeMembers.length,
    memberPreviews: activeMembers.slice(0, 3).map((member) => ({
      id: member.id,
      userId: member.userId,
      displayName: displayNameFromMember(member),
      avatarUrl: member.avatarUrl ?? null,
      role: member.role,
      status: member.status,
    })),
  });
}
