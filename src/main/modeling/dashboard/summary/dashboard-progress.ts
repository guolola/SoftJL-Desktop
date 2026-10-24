// Counts distinct output types in the current project workspace and document library.
import { dashboardProgressArtifactTypes, dashboardProgressStages, type DashboardSummary, type DocumentLibraryItem } from "../../../../shared/contracts/index.js";

type ProgressDocument = Pick<DocumentLibraryItem, "status" | "documentKind">;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function buildDashboardProgress(state: Record<string, unknown>, documents: ProgressDocument[]): NonNullable<DashboardSummary["projects"][number]["progress"]> {
  const generated = new Set<string>();
  const conversation = record(state.standardProject);
  for (const diagram of Object.values(record(conversation.diagrams))) {
    const item = record(diagram), model = record(item.model);
    if (item.status !== "completed" || model.diagramKind !== item.kind || typeof item.svg !== "string" || !item.svg.trim()) continue;
    const stage = ["function", "usecase", "activity"].includes(String(item.kind)) ? "requirements" : "design";
    generated.add(`${stage}:${item.kind}`);
  }
  for (const document of documents) if (document.status !== "deleted") generated.add(`document:${document.documentKind}`);
  const stages = dashboardProgressStages.map(kind => {
    const types = dashboardProgressArtifactTypes.filter(type => type.startsWith(`${kind}:`));
    return { kind, completed: types.filter(type => generated.has(type)).length, total: types.length };
  });
  const completed = stages.reduce((sum, stage) => sum + stage.completed, 0);
  const total = stages.reduce((sum, stage) => sum + stage.total, 0);
  return { completed, total, percentage: total ? Math.round(completed / total * 1000) / 10 : null, stages };
}
