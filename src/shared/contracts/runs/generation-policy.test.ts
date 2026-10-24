// Keeps the shared repair budget used by current conversation model generation.
import test from "node:test";
import assert from "node:assert/strict";
import { MAX_GENERATION_REPAIR_ATTEMPTS } from "./generation-policy.js";
test("model repair retains its existing bounded retry budget", () => { assert.equal(MAX_GENERATION_REPAIR_ATTEMPTS, 5); });
