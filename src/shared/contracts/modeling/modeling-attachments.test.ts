// Checks the retained conversation attachment schema and rejects unsupported file formats.
import assert from "node:assert/strict";
import test from "node:test";
import { standardAttachmentSchema } from "../workspace/standard-project.js";
const attachment = { id: "doc", name: "scope.md", type: "document", contentType: "text/markdown", text: "用户可以创建预约。" };
test("conversation documents retain their actual text and MIME type", () => { assert.deepEqual(standardAttachmentSchema.parse(attachment), attachment); });
test("unsupported MIME types do not become valid conversation attachments", () => { assert.equal(standardAttachmentSchema.safeParse({ ...attachment, contentType: "application/pdf" }).success, false); });
