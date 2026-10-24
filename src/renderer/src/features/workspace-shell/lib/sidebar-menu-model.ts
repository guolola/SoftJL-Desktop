// Aggregates saved diagram status for the project navigation tree.
export type SidebarNodeStatus = "queued" | "running" | "completed" | "failed";
export function mergeSidebarStatus(current: SidebarNodeStatus | undefined, next: SidebarNodeStatus | null) {
  if (!next) return current;
  if (current === "running" || next === "running") return "running";
  if (current === "queued" || next === "queued") return "queued";
  if (current === "failed" || next === "failed") return "failed";
  return "completed";
}
