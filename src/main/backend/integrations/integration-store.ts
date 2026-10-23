// Persists desktop integrations atomically and materializes immutable Skill revisions for running turns.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { integrationIdSchema, mcpSaveSchema, skillSaveSchema, type McpSave, type McpTest, type McpView, type SkillSave, type SkillView } from "../../../shared/contracts/agent-integrations.js";
import { createSecretKey, decryptSecret, encryptSecret } from "../../modeling/provider-configs/provider-config-secrets.js";
import { readStandardModelingResource, standardModelingResourceRoot } from "../../modeling/runs/pipelines/standard/standard-modeling-knowledge.js";
import { integrationReadiness, testMcpConnection } from "../../modeling/adapters/mcp/mcp-connection.js";
import { recommendedServers, recommendedSkills } from "./integration-catalog.js";

const persistedSchema = z.object({ version: z.literal(1), servers: z.array(mcpSaveSchema.extend({ id: integrationIdSchema })), skills: z.array(skillSaveSchema.extend({ id: integrationIdSchema })) }).strict();
type State = z.infer<typeof persistedSchema>;
export class IntegrationInputError extends Error { statusCode = 400; }
const required = ["uml-graduation-modeling", "graduation-deliverables"];

export class IntegrationStore {
  private tail: Promise<unknown> = Promise.resolve();
  private tests = new Map<string, McpTest>();
  private constructor(readonly directory: string, private secret: Buffer, private state: State) {}
  static async open(directory: string, secret: string) {
    await mkdir(directory, { recursive: true });
    const key = createSecretKey(secret);
    let state: State;
    try {
      const envelope = z.object({ version: z.literal(1), encrypted: z.string() }).strict().parse(JSON.parse(await readFile(join(directory, "integrations.json"), "utf8")));
      state = persistedSchema.parse(JSON.parse(decryptSecret(envelope.encrypted, key)));
      const ids = [...state.servers.map(item => `mcp:${item.id}`), ...state.skills.map(item => `skill:${item.id}`)];
      if (new Set(ids).size !== ids.length) throw new Error("重复的集成标识");
      if (state.skills.some(item => required.includes(item.id))) throw new Error("不能覆盖核心建模技能");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("集成配置格式不兼容或无法解密，请检查本地数据与密钥。", { cause: error });
      state = { version: 1, servers: recommendedServers.map(({ id, name, description, enabled, exposure, config }) => ({ id, name, description, enabled, exposure, config })),
        skills: recommendedSkills.map(item => ({ id: item.id, name: item.id, description: item.description, content: `# ${item.title}\n\n${item.instructions}\n\n方法参考：[公开 Skill](${item.sourceUrl})。本文为 SoftJL 工具与契约适配的工作流，不包含上游脚本。`, enabled: true })) };
    }
    const store = new IntegrationStore(directory, key, state);
    await store.persist(state);
    return store;
  }
  private async persist(state: State) {
    const temp = join(this.directory, `integrations-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify({ version: 1, encrypted: encryptSecret(JSON.stringify(state), this.secret) }), { mode: 0o600 });
    await rename(temp, join(this.directory, "integrations.json"));
  }
  private mutate(update: (state: State) => void) {
    const task = this.tail.then(async () => {
      const next = structuredClone(this.state);
      update(next);
      await this.persist(next);
      this.state = next;
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async overview() {
    await this.tail;
    const servers: McpView[] = this.state.servers.map(server => {
      const preset = recommendedServers.find(item => item.id === server.id);
      const config = server.config.type === "http" ? { type: "http" as const, url: server.config.url } : { type: "stdio" as const, command: server.config.command, args: server.config.args, cwd: server.config.cwd };
      return { ...server, config, sourceUrl: preset?.sourceUrl, setup: integrationReadiness(server.id, server.config) ?? preset?.setup ?? "配置服务运行环境后，先测试连接，再启用。", envKeys: server.config.type === "stdio" ? Object.keys(server.config.env ?? {}) : [], headerKeys: server.config.type === "http" ? Object.keys(server.config.headers ?? {}) : [], test: this.tests.get(server.id) };
    });
    const skills: SkillView[] = await Promise.all(required.map(async id => ({ id, name: id, title: id === required[0] ? "UML 与业务建模" : "测试与工程说明书", description: "核心建模流程使用的内置技能", content: (await readStandardModelingResource(`skills/${id}/SKILL.md`)).toString("utf8"), enabled: true, builtin: true, required: true, prerequisites: "由现有建模与文档工具提供。" })));
    skills.push(...this.state.skills.map(item => {
      const preset = recommendedSkills.find(preset => preset.id === item.id);
      return { ...item, title: preset?.title ?? item.name, builtin: Boolean(preset), required: false, sourceUrl: preset?.sourceUrl, prerequisites: preset?.prerequisites ?? "技能只提供指导，所需工具需单独配置。" };
    }));
    return { servers, skills };
  }
  async saveServer(id: string, input: McpSave) {
    integrationIdSchema.parse(id);
    const parsed = mcpSaveSchema.parse(input);
    let configChanged = false;
    await this.mutate(state => {
      const index = state.servers.findIndex(item => item.id === id);
      const old = state.servers[index];
      const config = structuredClone(parsed.config);
      // Omitted secret maps preserve saved credentials; an explicit empty object clears them.
      if (config.type === "http" && config.headers === undefined && old?.config.type === "http") config.headers = old.config.headers;
      if (config.type === "stdio" && config.env === undefined && old?.config.type === "stdio") config.env = old.config.env;
      const reason = integrationReadiness(id, config);
      if (parsed.enabled && reason) throw new IntegrationInputError(reason);
      const server = { id, ...parsed, config };
      configChanged = JSON.stringify(old?.config) !== JSON.stringify(config);
      if (index < 0) state.servers.push(server); else state.servers[index] = server;
    });
    if (configChanged) this.tests.delete(id);
  }
  async deleteServer(id: string) { await this.mutate(state => { state.servers = state.servers.filter(item => item.id !== id); }); this.tests.delete(id); }
  async testServer(id: string) {
    await this.tail;
    const server = this.state.servers.find(item => item.id === id);
    if (!server) throw new IntegrationInputError("MCP 服务不存在");
    const snapshot = JSON.stringify(server.config);
    const reason = integrationReadiness(id, server.config);
    const result = reason ? { ok: false, checkedAt: new Date().toISOString(), message: reason, tools: [] } : await testMcpConnection(server.config);
    // A slow check must not certify a configuration edited while it was connecting.
    if (JSON.stringify(this.state.servers.find(item => item.id === id)?.config) === snapshot) this.tests.set(id, result);
    return result;
  }
  async saveSkill(id: string, input: SkillSave) {
    integrationIdSchema.parse(id);
    if (required.includes(id)) throw new IntegrationInputError("核心技能由应用维护，不能覆盖");
    const parsed = skillSaveSchema.parse(input);
    if (parsed.name !== id) throw new IntegrationInputError("技能名称必须与标识一致");
    await this.mutate(state => {
      const index = state.skills.findIndex(item => item.id === id);
      if (index < 0) state.skills.push({ id, ...parsed }); else state.skills[index] = { id, ...parsed };
    });
  }
  async deleteSkill(id: string) {
    if (required.includes(id)) throw new IntegrationInputError("核心技能不能删除");
    await this.mutate(state => { state.skills = state.skills.filter(item => item.id !== id); });
  }
  async runtimeSnapshot() {
    await this.tail;
    const state = structuredClone(this.state);
    const skillPaths = await Promise.all(state.skills.filter(item => item.enabled).map(async skill => {
      const content = `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n${skill.content}`;
      const revision = createHash("sha256").update(content).digest("hex").slice(0, 20);
      const path = join(this.directory, "skills", `${skill.id}-${revision}`);
      await mkdir(path, { recursive: true });
      await writeFile(join(path, "SKILL.md"), content, { mode: 0o600 });
      return path;
    }));
    return { servers: state.servers.filter(item => item.enabled), skillPaths, skillRoots: [standardModelingResourceRoot, ...skillPaths] };
  }
}
