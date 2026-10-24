// Persists bounded, displayable plugin results without treating tool data as execution authority.
export function boundedToolData(value: unknown, maxBytes = 48000): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { const json = JSON.stringify(value); return Buffer.byteLength(json) <= maxBytes ? JSON.parse(json) : undefined; }
  catch { return undefined; }
}
