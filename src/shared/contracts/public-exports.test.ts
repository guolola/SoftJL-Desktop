// Guards the runtime public export surface before splitting contract internals.
import assert from "node:assert/strict";
import test from "node:test";
import * as contracts from "./index.js";

const REQUIRED_RUNTIME_EXPORTS = ["standardProjectStateSchema", "storedStandardProjectStateSchema", "standardModelSchema", "standardDiagramKinds", "standardAttachmentSchema", "runSnapshotSchema", "runEventSchema", "providerConfigListResponseSchema", "projectDtoSchema", "accountProfileResponseSchema", "documentLibraryListResponseSchema", "renderSvgResponseSchema", "apiErrorResponseSchema"] as const;

test("contracts keep required runtime public exports available", () => {
  for (const exportName of REQUIRED_RUNTIME_EXPORTS) {
    assert.ok(exportName in contracts, `missing export ${exportName}`);
    assert.notEqual(contracts[exportName], undefined, `undefined export ${exportName}`);
  }
});
