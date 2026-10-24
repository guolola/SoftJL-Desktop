// Resolves installed Pi packages and prepares upstream configuration for desktop and child sessions.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const desktopPiPackages = ["@juicesharp/rpiv-ask-user-question", "pi-custom-compaction", "pi-web-access", "pi-fff", "@gotgenes/pi-subagents"] as const;
export function piPackagePath(name: string): string {
  const require = createRequire(import.meta.url);
  const root = require.resolve.paths(name)?.map(base => join(base, name)).find(path => existsSync(join(path, "package.json")));
  if (!root) throw new Error(`未安装 Pi 扩展：${name}`);
  return root;
}
export async function writePiDefault(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
}
async function ensureChildPackages(cwd: string) {
  const path = join(cwd, ".pi/settings.json");
  const required = ["pi-web-access", "pi-fff"].map(piPackagePath);
  await writePiDefault(path, { packages: required });
  const settings: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error(".pi/settings.json 必须是 Pi 配置对象");
  const current = settings as Record<string, unknown>;
  if (current.packages !== undefined && (!Array.isArray(current.packages) || current.packages.some(item =>
    typeof item !== "string" && (!item || typeof item !== "object" || typeof item.source !== "string"))))
    throw new Error(".pi/settings.json 的 packages 不符合当前 Pi 配置格式");
  const installed = (current.packages ?? []) as Array<string | { source: string }>;
  // Remove this uninstalled package's old registrations so restored child sessions cannot load stale paths.
  const packages = installed.filter(entry => {
    const source = (typeof entry === "string" ? entry : entry.source).replaceAll("\\", "/").replace(/\/+$/, "");
    return !/^(?:npm:)?@gotgenes\/pi-permission-system(?:@[^/]+)?$/.test(source)
      && !source.endsWith("/node_modules/@gotgenes/pi-permission-system");
  });
  // Child sessions discover their web and file-search packages from workspace settings.
  const missing = required.filter(source => !packages.some(item => item === source));
  if (missing.length || packages.length !== installed.length) await writeFile(path, JSON.stringify({ ...current, packages: [...packages, ...missing] }, null, 2) + "\n");
}
export async function preparePiWorkspace(cwd: string, model: { provider: string; id: string }) {
  // Configuration belongs to the upstream packages; the app does not implement their policies.
  await writePiDefault(join(cwd, ".pi/compaction-policy.json"), { enabled: true, models: [{ model: `${model.provider}/${model.id}` }],
    summary: { preservationInstruction: "保留目标、用户确认事实、约束、文件路径、图表 ID、已完成工作和未解决问题，区分建议与确认。" } });
  await ensureChildPackages(cwd);
  await rm(join(cwd, ".pi/extensions/pi-permission-system/config.json"), { force: true });
  await writePiDefault(join(cwd, ".pi/subagents.json"), { maxConcurrent: 3, defaultMaxTurns: 12 });
}
