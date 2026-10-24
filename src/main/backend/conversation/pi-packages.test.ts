// Loads the actual installed packages through Pi, so missing exports and native dependencies fail visibly.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { desktopPiPackages, piPackagePath, preparePiWorkspace } from "./pi-packages.js";
import { loadStandardAgentResources } from "../../modeling/runs/pipelines/standard/standard-agent-resources.js";

test("existing Pi settings retain preferences and unrelated packages while removing the uninstalled permission package", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "softjl-pi-settings-"));
  const path = join(cwd, ".pi/settings.json");
  try {
    await mkdir(join(cwd, ".pi"));
    await writeFile(path, JSON.stringify({ theme: "light", packages: ["./custom-extension", "@gotgenes/pi-permission-system",
      "npm:@gotgenes/pi-permission-system@41.0.0", "E:\\old-app\\node_modules\\@gotgenes\\pi-permission-system",
      { source: "E:/old-app/node_modules/@gotgenes/pi-permission-system", extensions: ["src/service.ts"] },
      { source: "./custom-object-extension", extensions: ["custom.ts"] }] }));
    const config = join(cwd, ".pi/extensions/pi-permission-system/config.json");
    await mkdir(join(cwd, ".pi/extensions/pi-permission-system"), { recursive: true });
    await writeFile(config, JSON.stringify({ permission: { "*": "ask" } }));
    await preparePiWorkspace(cwd, { provider: "test", id: "model" });
    const once = await readFile(path, "utf8");
    const settings = JSON.parse(once);
    assert.equal(settings.theme, "light");
    assert.ok(settings.packages.includes("./custom-extension"));
    assert.deepEqual(settings.packages, ["./custom-extension", { source: "./custom-object-extension", extensions: ["custom.ts"] },
      piPackagePath("pi-web-access"), piPackagePath("pi-fff")]);
    await assert.rejects(readFile(config), { code: "ENOENT" });
    await preparePiWorkspace(cwd, { provider: "test", id: "model" });
    assert.equal(await readFile(path, "utf8"), once);
    await writeFile(path, JSON.stringify({ packages: "obsolete" }));
    await assert.rejects(preparePiWorkspace(cwd, { provider: "test", id: "model" }), /packages/);
    assert.equal(JSON.parse(await readFile(path, "utf8")).packages, "obsolete");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("all selected upstream Pi packages load and expose their real tools", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "softjl-pi-packages-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = join(cwd, "agent");
  try {
    await preparePiWorkspace(cwd, { provider: "test", id: "model" });
    const loader = await loadStandardAgentResources(cwd, SettingsManager.inMemory(), "test", {
      additionalExtensionPaths: desktopPiPackages.map(piPackagePath),
    });
    const extensions = loader.getExtensions().extensions;
    const names = extensions.flatMap(extension => [...extension.tools.keys()]);
    for (const name of ["ask_user_question", "web_search", "fetch_content", "subagent"]) assert.ok(names.includes(name), `${name} is registered`);
    assert.ok(names.some(name => name.includes("fff")), "fff search is registered");
    assert.equal(extensions.length, 5);
    await assert.rejects(readFile(join(cwd, ".pi/extensions/pi-permission-system/config.json")), { code: "ENOENT" });
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(cwd, { recursive: true, force: true });
  }
});
