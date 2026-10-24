// Project creation has one workflow and rejects retired mode fields.
import test from "node:test";
import assert from "node:assert/strict";
import { projectCreateRequestSchema, projectUpdateRequestSchema } from "./projects.js";
test("project creation accepts names and rejects mode selectors", () => {
  assert.equal(projectCreateRequestSchema.parse({ name: "项目" }).name, "项目");
  for (const projectMode of ["standard", "professional"]) assert.equal(projectCreateRequestSchema.safeParse({ name: "项目", projectMode }).success, false);
  assert.equal(projectUpdateRequestSchema.safeParse({ projectMode: "professional" }).success, false);
});
