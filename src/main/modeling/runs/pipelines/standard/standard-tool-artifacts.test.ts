// Verifies real non-text tool results survive presentation without inventing files from output prose.
import assert from "node:assert/strict";
import test from "node:test";
import { standardToolArtifacts } from "./standard-tool-artifacts.js";

test("published documents use a project-scoped downloadable File result", () => {
  const result = { details: { document: { id: "document-1", filename: "需求规格说明书.docx" } } };
  assert.deepEqual(standardToolArtifacts("project-1", "generate_document", result), [{ type: "file", url: "/api/projects/project-1/documents/document-1/download", filename: "需求规格说明书.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }]);
  assert.deepEqual(standardToolArtifacts("p", "other", result), []);
  assert.deepEqual(standardToolArtifacts("p", "generate_document", { content: [{ type: "text", text: "已生成 report.docx" }] }), []);
});

test("native and raw MCP images are preserved once alongside embedded and linked files", () => {
  const image = { type: "image", mimeType: "image/png", data: "aGVsbG8=" };
  const artifacts = standardToolArtifacts("p", "mcp__fixture__render", { content: [image], structuredContent: { content: [image,
    { type: "resource_link", uri: "https://example.test/report.pdf", name: "report.pdf", mimeType: "application/pdf" },
    { type: "resource", resource: { uri: "resource://notes/readme.txt", mimeType: "text/plain", text: "actual evidence" } },
    { type: "resource_link", uri: "https://example.test/photo.png", name: "photo.png", mimeType: "image/png" },
    { type: "audio", mimeType: "audio/wav", data: "aGVsbG8=" },
    { type: "resource_link", uri: "https://example.test/demo.mp4", name: "demo.mp4", mimeType: "video/mp4" },
  ] } });
  assert.equal(artifacts.length, 6);
  assert.deepEqual(artifacts[0], { type: "image", url: "data:image/png;base64,aGVsbG8=" });
  assert.deepEqual(artifacts[2], { type: "file", url: `data:text/plain;base64,${Buffer.from("actual evidence").toString("base64")}`, filename: "readme.txt", mimeType: "text/plain" });
  assert.equal(artifacts[3]!.type, "image"); assert.equal(artifacts[4]!.type, "file");
  assert.deepEqual(artifacts[5], { type: "file", url: "https://example.test/demo.mp4", filename: "demo.mp4", mimeType: "video/mp4" });
});

test("failed results and non-downloadable or unsafe references do not become successful artifacts", () => {
  const image = { type: "image", mimeType: "image/png", data: "aGVsbG8=" };
  assert.deepEqual(standardToolArtifacts("p", "mcp", { content: [image], isError: true }), []);
  assert.deepEqual(standardToolArtifacts("p", "mcp", { structuredContent: { content: [image], isError: true } }), []);
  for (const uri of ["file:///C:/private.txt", "javascript:alert(1)", "resource://private/data", "//external.test/file"]) {
    assert.deepEqual(standardToolArtifacts("p", "mcp", { structuredContent: { content: [{ type: "resource_link", uri, name: "file" }] } }), []);
  }
});
