// Verifies DOCX rendering passes diagram model-scoped PlantUML sources to image rendering.
import assert from "node:assert/strict";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import {
  renderDocumentBuffer,
  resolvePngImageTransformation,
} from "./document-renderer.js";
import { type PngRenderClient } from "../../adapters/render/png-render-client.js";

const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function pngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function extractDocxEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocdOffset = index; break; }
  }
  assert.notEqual(eocdOffset, -1);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(centralOffset), 0x02014b50);
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed));
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function withDocumentPlantUmlEnv<T>(
  env: { fontName?: string; dpi?: string },
  run: () => Promise<T>,
) {
  const previousFontName = process.env.UML_DOCUMENT_PLANTUML_FONT_NAME;
  const previousDpi = process.env.UML_DOCUMENT_PLANTUML_DPI;
  try {
    if (env.fontName === undefined) {
      delete process.env.UML_DOCUMENT_PLANTUML_FONT_NAME;
    } else {
      process.env.UML_DOCUMENT_PLANTUML_FONT_NAME = env.fontName;
    }
    if (env.dpi === undefined) {
      delete process.env.UML_DOCUMENT_PLANTUML_DPI;
    } else {
      process.env.UML_DOCUMENT_PLANTUML_DPI = env.dpi;
    }
    return await run();
  } finally {
    if (previousFontName === undefined) {
      delete process.env.UML_DOCUMENT_PLANTUML_FONT_NAME;
    } else {
      process.env.UML_DOCUMENT_PLANTUML_FONT_NAME = previousFontName;
    }
    if (previousDpi === undefined) {
      delete process.env.UML_DOCUMENT_PLANTUML_DPI;
    } else {
      process.env.UML_DOCUMENT_PLANTUML_DPI = previousDpi;
    }
  }
}

test("renderDocumentBuffer renders same-kind sequence sections by diagramModelId", async () => {
  const calls: Parameters<PngRenderClient>[0][] = [];
  const renderPng: PngRenderClient = async (request) => {
    calls.push(request);
    return {
      png: VALID_PNG,
      renderMeta: {
        engine: "plantuml",
        generatedAt: "2026-06-14T00:00:00.000Z",
        sourceLength: request.source.length,
        durationMs: 1,
      },
    };
  };
  const missingArtifacts: string[] = [];

  const buffer = await withDocumentPlantUmlEnv(
    { fontName: "Noto Sans CJK SC", dpi: "200" },
    () =>
      renderDocumentBuffer(
        "softwareDesignSpec",
        [
          {
            level: 3,
            title: "报名活动用例实现设计",
            body: [],
            diagramKind: "sequence",
            diagramModelId: "sequence:uc_apply",
          },
          {
            level: 3,
            title: "取消报名用例实现设计",
            body: [],
            diagramKind: "sequence",
            diagramModelId: "sequence:uc_cancel",
          },
        ],
        new Map([
          ["sequence:uc_apply", "@startuml\nparticipant Apply\n@enduml"],
          ["sequence:uc_cancel", "@startuml\nparticipant Cancel\n@enduml"],
        ]),
        new Set(),
        renderPng,
        missingArtifacts,
        { includeTableOfContents: false, autoNumberHeadings: false },
      ),
  );

  assert.ok(buffer.byteLength > 0);
  assert.deepEqual(missingArtifacts, []);
  assert.deepEqual(
    calls.map((call) => call.modelId),
    ["sequence:uc_apply", "sequence:uc_cancel"],
  );
  assert.match(calls[0]?.source ?? "", /participant Apply/u);
  assert.match(calls[1]?.source ?? "", /participant Cancel/u);
  assert.ok(
    calls.every((call) =>
      call.source.includes('skinparam defaultFontName "Noto Sans CJK SC"'),
    ),
  );
  assert.ok(
    calls.every((call) =>
      call.source.includes("skinparam dpi 200"),
    ),
  );
});

test("renderDocumentBuffer injects document fonts into MindMap diagrams", async () => {
  const calls: Parameters<PngRenderClient>[0][] = [];
  const renderPng: PngRenderClient = async (request) => {
    calls.push(request);
    return {
      png: VALID_PNG,
      renderMeta: {
        engine: "plantuml",
        generatedAt: "2026-06-14T00:00:00.000Z",
        sourceLength: request.source.length,
        durationMs: 1,
      },
    };
  };

  const buffer = await withDocumentPlantUmlEnv(
    { fontName: "Noto Sans CJK SC", dpi: "240" },
    () =>
      renderDocumentBuffer(
        "requirementsSpec",
        [
          {
            level: 2,
            title: "功能结构",
            body: [],
            diagramKind: "function",
          },
        ],
        new Map([["function", "@startmindmap\n* 系统功能\n@endmindmap"]]),
        new Set(),
        renderPng,
        [],
        { includeTableOfContents: false, autoNumberHeadings: false },
      ),
  );

  assert.ok(buffer.byteLength > 0);
  assert.match(calls[0]?.source ?? "", /@startmindmap\nskinparam dpi 240/u);
  assert.match(calls[0]?.source ?? "", /skinparam defaultFontName "Noto Sans CJK SC"/u);
});

test("renderDocumentBuffer uses the actual project name on specification covers", async () => {
  const buffer = await renderDocumentBuffer(
    "requirementsSpec",
    [],
    new Map(),
    new Set(),
    async () => ({ png: Buffer.from("png") }),
    [],
    undefined,
    { projectName: "可信链路复测 A" },
  );

  const documentXml =
    extractDocxEntries(buffer).get("word/document.xml")?.toString("utf8") ?? "";
  assert.match(documentXml, /项目名称：可信链路复测 A/u);
  assert.match(documentXml, /文档版本：V1\.0/u);
  assert.doesNotMatch(documentXml, /项目名称：软件系统/u);
});

test("resolvePngImageTransformation preserves diagram aspect ratios", () => {
  assert.deepEqual(resolvePngImageTransformation(pngHeader(1600, 400)), {
    width: 560,
    height: 140,
  });
  assert.deepEqual(resolvePngImageTransformation(pngHeader(400, 1600)), {
    width: 170,
    height: 680,
  });
  assert.deepEqual(resolvePngImageTransformation(pngHeader(120, 80)), {
    width: 120,
    height: 80,
  });
});
