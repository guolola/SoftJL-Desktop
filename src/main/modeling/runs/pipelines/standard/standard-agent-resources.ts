// Configures Pi's native resource loader for explicitly supplied server extensions, without host discovery.
import { DefaultResourceLoader, type SettingsManager } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { readStandardModelingResource, standardModelingResourceRoot, standardModelingSkillPaths } from "./standard-modeling-knowledge.js";

// Reuse Pi's options directly: installed packages can export a factory or supply a local extension/package path.
export type StandardAgentExtensionOptions = Pick<ConstructorParameters<typeof DefaultResourceLoader>[0], "extensionFactories" | "additionalExtensionPaths"> & {
  managedSkillPaths?: string[];
  skillResourceRoots?: string[];
  integrationContext?: string;
};
export type StandardAgentResourceProvider = () => Promise<{ options: StandardAgentExtensionOptions; close: () => Promise<void> }>;

export async function loadStandardAgentResources(cwd: string, settingsManager: SettingsManager, systemPrompt: string,
  options: StandardAgentExtensionOptions) {
  const agents = (await readStandardModelingResource("AGENTS.md")).toString("utf8");
  const { managedSkillPaths = [], skillResourceRoots: _roots, integrationContext, ...extensions } = options;
  const loader = new DefaultResourceLoader({
    cwd, agentDir: cwd, settingsManager, systemPrompt, appendSystemPrompt: [],
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    additionalSkillPaths: [...standardModelingSkillPaths, ...managedSkillPaths],
    agentsFilesOverride: () => ({ agentsFiles: [{ path: join(standardModelingResourceRoot, "AGENTS.md"), content: agents }] }),
    ...extensions,
    ...(integrationContext ? { appendSystemPrompt: [integrationContext] } : {}),
  });
  await loader.reload();
  // Pi reports failed factories, missing paths and name collisions as diagnostics. Do not start a partial toolset.
  if (loader.getExtensions().errors.length) throw new Error(`快速建模扩展加载失败：${loader.getExtensions().errors.map(error => error.error).join("；")}`);
  const loadedSkills = loader.getSkills();
  if (["uml-graduation-modeling", "graduation-deliverables"].some(name => !loadedSkills.skills.some(skill => skill.name === name))
    || loadedSkills.diagnostics.some(item => item.type === "error")) throw new Error("快速建模技能加载失败");
  return loader;
}
