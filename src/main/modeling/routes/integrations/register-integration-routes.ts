// Parses desktop management requests and delegates persistence and connection checks to their owners.
import type { FastifyInstance } from "fastify";
import { integrationIdSchema, mcpSaveSchema, skillSaveSchema } from "../../../../shared/contracts/agent-integrations.js";
import type { IntegrationStore } from "../../../backend/integrations/integration-store.js";
import { IntegrationInputError } from "../../../backend/integrations/integration-store.js";
import type { FastifyReply } from "fastify";

export function registerIntegrationRoutes(app: FastifyInstance, store: IntegrationStore) {
  const root = "/api/desktop/integrations";
  const handle = async <T>(reply: FastifyReply, run: () => Promise<T>) => {
    try { return await run(); } catch (error) {
      if (error instanceof IntegrationInputError) return reply.code(400).send({ message: error.message });
      throw error;
    }
  };
  app.get(root, () => store.overview());
  const id = (params: unknown) => integrationIdSchema.parse((params as { id: string }).id);
  app.put(`${root}/mcp/:id`, (request, reply) => handle(reply, async () => { await store.saveServer(id(request.params), mcpSaveSchema.parse(request.body)); return store.overview(); }));
  app.delete(`${root}/mcp/:id`, (request, reply) => handle(reply, async () => { await store.deleteServer(id(request.params)); return store.overview(); }));
  app.post(`${root}/mcp/:id/test`, (request, reply) => handle(reply, () => store.testServer(id(request.params))));
  app.put(`${root}/skills/:id`, (request, reply) => handle(reply, async () => { await store.saveSkill(id(request.params), skillSaveSchema.parse(request.body)); return store.overview(); }));
  app.delete(`${root}/skills/:id`, (request, reply) => handle(reply, async () => { await store.deleteSkill(id(request.params)); return store.overview(); }));
}
