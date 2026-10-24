// Maps only structured upstream result fields; raw tool text remains available as the fallback.
export const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function pluginSources(value: unknown) {
  const data = record(value);
  const queries = Array.isArray(data.queries) ? data.queries : [];
  const curated = Array.isArray(data.curatedQueries) ? data.curatedQueries : [];
  const rows = [...queries.flatMap(query => Array.isArray(record(query).results) ? record(query).results as unknown[] : []),
    ...curated.flatMap(query => Array.isArray(record(query).sources) ? record(query).sources as unknown[] : []),
    ...(Array.isArray(data.urls) ? data.urls : [])];
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const item = record(row);
    if (typeof item.url !== "string") return [];
    try {
      const url = new URL(item.url);
      if (!["http:", "https:"].includes(url.protocol)) return [];
      if (seen.has(url.href)) return [];
      seen.add(url.href);
      return [{ url: url.href, domain: url.hostname, title: typeof item.title === "string" ? item.title : url.hostname,
        snippet: typeof item.snippet === "string" ? item.snippet : undefined }];
    } catch { return []; }
  }).slice(0, 30);
}

/** Upstream execution can fail with isError=false; the agent status remains authoritative. */
export function pluginAgentState(data: unknown, running: boolean, failed: boolean): "working" | "waiting" | "done" | "failed" | "cancelled" {
  const status = record(data).status;
  if (status === "error" || failed) return "failed";
  if (status === "aborted" || status === "stopped") return "cancelled";
  if (status === "completed") return "done";
  if (running || status === "running") return "working";
  return "waiting";
}
