// Defines project document access contracts shared by project-scoped routes.
import type { FastifyRequest } from "fastify";
import type { ProjectPermission } from "../../../../shared/contracts/index.js";


export interface DocumentProjectContext {
  projectId: string;
  userId: string;
  permission: ProjectPermission;
}

export type DocumentUserResolver = (
  request: FastifyRequest,
) => Promise<string | null> | string | null;

export type DocumentProjectMembershipGuard = (
  context: DocumentProjectContext,
  request: FastifyRequest,
) => Promise<boolean> | boolean;
