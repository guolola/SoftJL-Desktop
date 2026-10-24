// Health checks retain the current provider schema without retired generation formats.
import test from "node:test";
import assert from "node:assert/strict";
import { HEALTHCHECK_RESPONSE_FORMAT } from "./general-response-formats.js";
test("health check requests a strict boolean result", () => { assert.equal(HEALTHCHECK_RESPONSE_FORMAT.type, "json_schema"); assert.deepEqual(HEALTHCHECK_RESPONSE_FORMAT.json_schema.schema.required, ["ok"]); });
