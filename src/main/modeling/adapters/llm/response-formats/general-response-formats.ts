// Formats the current provider health-check request without loading retired generation schemas.
import { getStructuredResponseFormat, type ModelCapabilitySource } from "../model-capabilities.js";
import type { JsonSchemaResponseFormat } from "../llm-transport.js";
export const HEALTHCHECK_RESPONSE_FORMAT: JsonSchemaResponseFormat = { type: "json_schema", json_schema: {
  name: "provider_healthcheck", strict: true, schema: { type: "object", additionalProperties: false,
    properties: { ok: { type: "boolean" } }, required: ["ok"] },
} };
export function getHealthcheckResponseFormat(model: ModelCapabilitySource) {
  return getStructuredResponseFormat(model, HEALTHCHECK_RESPONSE_FORMAT);
}
