// Hosts the protected local modeling API and its persistent desktop identity.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import staticFiles from "@fastify/static";
import {
  createApiServer,
  createPostgresAuthRepository,
  createPostgresProviderConfigRepository,
  createPostgresRunRecordStore,
  createFileDocumentLibrary,
  createPostgresDocumentLibrary,
  type AuthStore,
  type ProviderConfigStore,
} from "../modeling/application/index.js";
import {
  renderSvgWithPlantUml,
  renderPngWithPlantUml,
  renderPdfWithPlantUml,
  svgToVectorPdf,
} from "../rendering/index.js";
import { openDatabase } from "./storage/database.js";
import { ConversationCodingService } from "./conversation/coding-service.js";
import { registerConversationCodingRoutes } from "../modeling/routes/coding/register-conversation-coding-routes.js";
import { IntegrationStore } from "./integrations/integration-store.js";
import { createAgentIntegrationRuntime } from "./integrations/agent-integration-runtime.js";
import { registerIntegrationRoutes } from "../modeling/routes/integrations/register-integration-routes.js";
export type DesktopBackendOptions = {
  directorySelectionCapability?: string;
  dataDir: string;
  secret: string;
  capability: string;
  rendererDir?: string;
  jarPath: string;
  javaPath: string;
};
const equal = (left: unknown, right: string) =>
  typeof left === "string" &&
  left.length === right.length &&
  timingSafeEqual(Buffer.from(left), Buffer.from(right));
export async function startDesktopBackend(options: DesktopBackendOptions) {
  await mkdir(options.dataDir, { recursive: true });
  const storage = await openDatabase(join(options.dataDir, "database"));
  const { db } = storage;
  const repository = createPostgresAuthRepository(db);
  const identity = (await db.query<{ id: string }>(
    "select id from users where username in ('Admin', 'admin', 'local_workspace') order by case when username='Admin' then 0 else 1 end limit 1",
  )).rows[0];
  let user = identity ? await repository.getUser(identity.id) : null;
  if (!user)
    user = await repository.createUser({
      username: "admin",
      displayName: "Admin",
      passwordHash: randomBytes(64).toString("hex"),
    });
  if (!user) throw new Error("无法创建本地工作区");
  // Rename the existing desktop identity in place so project/provider ownership is retained.
  if (user.username !== "Admin") {
    await db.query("update users set username='Admin', display_name='Admin' where id=$1", [user.id]);
    user = (await repository.getUser(user.id))!;
  }
  const localUser = user;
  let privateSession = await repository.createSession({
    userId: user.id,
    ipAddress: null,
    userAgent: "SoftJL Desktop",
  });
  const providerConfigs = createPostgresProviderConfigRepository({
    db,
    secret: options.secret,
  }) as unknown as ProviderConfigStore;
  const runs = await createPostgresRunRecordStore(db);
  const documentLibrary = createPostgresDocumentLibrary({
    db,
    blobStorage: createFileDocumentLibrary(join(options.dataDir, "documents")),
  });
  // This process never uses a server database, hosted OAuth, Redis or development guest credentials.
  delete process.env.DATABASE_URL;
  // Installed applications may start in a read-only directory; catalogs belong to the local user data too.
  process.env.UML_MODEL_CATALOG_DIR = join(options.dataDir, "model-catalog");
  process.env.UML_AVATAR_STORAGE_DIR = join(options.dataDir, "avatars");
  process.env.UML_RUN_QUEUE_MODE = "local";
  process.env.PI_CODING_AGENT_DIR = join(options.dataDir, "pi-agent");
  process.env.UML_PLANTUML_JAVA_PATH = options.javaPath;
  process.env.UML_PLANTUML_JAR_PATH = options.jarPath;
  const integrations = await IntegrationStore.open(join(options.dataDir, "integrations"), options.secret);
  const coding = new ConversationCodingService({
    read: async id => (await db.query<{ value: string }>("select value from desktop_metadata where key=$1", [`conversation-directory:${id}`])).rows[0]?.value ?? null,
    write: async (id, directory) => {
      if (directory === null) await db.query("delete from desktop_metadata where key=$1", [`conversation-directory:${id}`]);
      else await db.query("insert into desktop_metadata(key,value) values($1,$2) on conflict(key) do update set value=excluded.value", [`conversation-directory:${id}`, directory]);
    },
  }, options.dataDir);
  const app = await createApiServer({
    codingHost: coding,
    agentResources: createAgentIntegrationRuntime(integrations),
    nodeEnv: "production",
    authStore: repository as unknown as AuthStore,
    providerConfigStore: providerConfigs,
    runRecordStore: runs,
    documentLibrary,
    renderClient: (input, signal) =>
      renderSvgWithPlantUml(
        { diagramKind: input.diagramKind, plantUmlSource: input.source },
        options.jarPath,
      ),
    pngRenderClient: async (input, signal) => {
      const result = await renderPngWithPlantUml(
        { diagramKind: input.diagramKind, plantUmlSource: input.source },
        options.jarPath,
      );
      return {
        png: Buffer.from(result.pngBase64, "base64"),
        renderMeta: result.renderMeta,
      };
    },
    pdfRenderClient: async (input) => {
      const result = await renderSvgWithPlantUml(
        { diagramKind: input.diagramKind, plantUmlSource: input.source },
        options.jarPath,
      );
      return {
        pdf: await svgToVectorPdf(result.svg),
        renderMeta: result.renderMeta,
      };
    },
  });
  app.log.level = "silent";
  registerConversationCodingRoutes(app, repository as unknown as AuthStore, coding, options.directorySelectionCapability);
  let origin = "";
  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0];
    if (!equal(request.headers["x-softjl-desktop"], options.capability))
      return reply.code(403).send({ message: "此接口仅供本机桌面应用使用。" });
    // Preserve the current application contracts while keeping all account and collaboration mutations inaccessible.
    if (
      (path.startsWith("/api/auth/") && path !== "/api/auth/me") ||
      path.includes("invitations") ||
      path.includes("invitees") ||
      path.includes("transfer-owner") ||
      (path.includes("/members") && request.method !== "GET") ||
      path.startsWith("/api/account/security") ||
      path.startsWith("/api/account/mfa") ||
      path.startsWith("/api/account/sessions")
    )
      return reply.code(404).send({ message: "个人桌面版不提供此功能。" });
    if (!(await repository.getActiveSession(privateSession.id)))
      privateSession = await repository.createSession({
        userId: localUser.id,
        ipAddress: null,
        userAgent: "SoftJL Desktop",
      });
    request.headers.cookie = "uml_session=" + privateSession.id;
  });
  registerIntegrationRoutes(app, integrations);
  if (options.rendererDir) {
    await app.register(staticFiles, {
      root: options.rendererDir,
      wildcard: false,
    });
    app.get("/*", (request, reply) =>
      request.url.startsWith("/api/")
        ? reply.code(404).send({ message: "接口不存在" })
        : reply.sendFile("index.html"),
    );
  }
  app.addHook("onClose", async () => {
    coding.close();
    try {
      await runs.flush();
    } finally {
      await storage.close();
    }
  });
  // Reuse the local origin so theme, provider selection and browser preferences survive restarts.
  const savedPort = Number(
    (
      await db.query<{ value: string }>(
        "select value from desktop_metadata where key='http-port'",
      )
    ).rows[0]?.value,
  );
  const port =
    Number.isInteger(savedPort) && savedPort > 0 && savedPort < 65536
      ? savedPort
      : 0;
  try {
    origin = await app.listen({ host: "127.0.0.1", port });
  } catch (error) {
    if (!port || (error as NodeJS.ErrnoException).code !== "EADDRINUSE")
      throw error;
    origin = await app.listen({ host: "127.0.0.1", port: 0 });
  }
  await db.query(
    "insert into desktop_metadata(key,value) values('http-port',$1) on conflict(key) do update set value=excluded.value",
    [new URL(origin).port],
  );
  return { app, origin, db, close: () => app.close() };
}
