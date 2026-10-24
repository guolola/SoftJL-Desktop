// Verifies that excluded services are absent while core routes remain registered.
import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../../index.js";
