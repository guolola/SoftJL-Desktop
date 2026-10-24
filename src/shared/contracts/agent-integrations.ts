// Shares desktop integration configuration without returning saved credentials to the renderer.
import { z } from "zod";

export const integrationIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);
export const mcpExposureSchema = z.enum(["codemode", "deferred", "direct"]);
const values = z.record(z.string().max(16000));
export const mcpConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stdio"), command: z.string().trim().min(1).max(1000), args: z.array(z.string().max(4000)).max(100), cwd: z.string().max(2000).optional(), env: values.optional() }).strict(),
  z.object({ type: z.literal("http"), url: z.string().url().refine(value => ["http:", "https:"].includes(new URL(value).protocol)), headers: values.optional() }).strict(),
]);
export const mcpSaveSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(1000), enabled: z.boolean(), exposure: mcpExposureSchema.default("direct"), config: mcpConfigSchema }).strict();
export const skillSaveSchema = z.object({ name: integrationIdSchema, description: z.string().trim().min(1).max(1000), content: z.string().trim().min(1).max(48000), enabled: z.boolean() }).strict();
export type McpConfig = z.infer<typeof mcpConfigSchema>;
export type McpSave = z.infer<typeof mcpSaveSchema>;
export type SkillSave = z.infer<typeof skillSaveSchema>;
export type McpTest = { ok: boolean; checkedAt: string; message: string; tools: { name: string; description?: string }[] };
export type McpView = Omit<McpSave, "config"> & { id: string; sourceUrl?: string; setup: string; config: McpConfig; envKeys: string[]; headerKeys: string[]; test?: McpTest };
export type SkillView = SkillSave & { id: string; title: string; builtin: boolean; required: boolean; sourceUrl?: string; prerequisites: string };
export type IntegrationOverview = { servers: McpView[]; skills: SkillView[] };
