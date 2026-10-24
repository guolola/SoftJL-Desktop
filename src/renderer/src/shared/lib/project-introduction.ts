// Carries project introduction requests from successful creation to a visible project workspace.
const key = (projectId: string) => `uml-project-introduction:${projectId}`;

export function queueProjectIntroduction(projectId: string) {
  try { sessionStorage.setItem(key(projectId), "pending"); } catch {
    // Restricted storage must not prevent successful project creation.
  }
}

export function hasPendingProjectIntroduction(projectId: string): boolean {
  try { return sessionStorage.getItem(key(projectId)) === "pending"; } catch { return false; }
}

export function consumeProjectIntroduction(projectId: string): boolean {
  try {
    if (!hasPendingProjectIntroduction(projectId)) return false;
    // Consume on display so reloading, revisiting or remounting cannot reopen the introduction.
    sessionStorage.removeItem(key(projectId));
    return true;
  } catch { return false; }
}
