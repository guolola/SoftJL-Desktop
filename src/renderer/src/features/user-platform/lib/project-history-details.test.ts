// Shows only current conversation runs in project history.
import { expect, it } from "vitest";
import { getHistoryOperation, HISTORY_OPERATIONS } from "./project-history-details.js";
it("offers the project conversation category", () => {
  expect(HISTORY_OPERATIONS).toEqual(["quick"]);
  expect(getHistoryOperation({ runId: "chat", operationType: "quick_modeling", status: "failed" })).toBe("quick");
});
