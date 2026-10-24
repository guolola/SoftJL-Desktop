// Exercises the shared semantic validation boundary before manual models reach the renderer.
import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { modelFixture } from "../../../../shared/contracts/testing/index.js";
import { registerRenderRoutes } from "./register-render-routes.js";

for (const format of ["png", "pdf"] as const) {
  test(`${format} export enforces project view access and handles validation and conversion errors`, async () => {
    const app = Fastify();
    let userId: string | null = null;
    let allowed = false;
    let fail = false;
    let calls = 0;
    const metadata = { engine: "plantuml", generatedAt: "now", sourceLength: 6, durationMs: 1 };
    const verify = (artifact: { diagramKind: string; source: string }) => {
      calls++;
      assert.equal(artifact.diagramKind, "sequence");
      assert.equal(artifact.source, "source");
      if (fail) throw new Error("conversion unavailable");
    };
    registerRenderRoutes({ app, resolveUserId: async () => userId,
      projectMembershipGuard: async (input) => { assert.equal(input.permission, "view_project"); return allowed; },
      renderClient: async () => { throw new Error("unexpected SVG"); },
      pngRenderClient: async (artifact, signal) => { verify(artifact); assert.ok(signal instanceof AbortSignal); return { png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), renderMeta: metadata }; },
      pdfRenderClient: async (artifact, signal) => { verify(artifact); assert.ok(signal instanceof AbortSignal); return { pdf: Buffer.from("%PDF-1.7"), renderMeta: metadata }; },
    });
    const request = (payload: unknown = { diagramKind: "sequence", plantUmlSource: "source" }) => app.inject({ method: "POST", url: `/api/render/${format}`, headers: { "x-uml-project-id": "project" }, payload });
    try {
      assert.equal((await request()).statusCode, 401);
      userId = "user";
      assert.equal((await request()).statusCode, 403);
      assert.equal(calls, 0);
      allowed = true;
      assert.equal((await request({ diagramKind: "sequence", plantUmlSource: "" })).statusCode, 400);
      assert.equal(calls, 0);
      const exported = await request();
      assert.equal(exported.statusCode, 200);
      assert.ok(exported.json()[`${format}Base64`]);
      fail = true;
      const failed = await request();
      assert.equal(failed.statusCode, 400);
      assert.equal(failed.json().error.code, "VALIDATION_FAILED");
      assert.doesNotMatch(failed.body, /conversion unavailable/);
    } finally { await app.close(); }
  });
}

for (const format of ["png", "pdf"] as const) {
  test(`${format} export cancels its upstream request when the client disconnects`, async () => {
    const app = Fastify();
    let disconnect!: () => void;
    let upstreamSignal!: AbortSignal;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    app.addHook("onRequest", (_request, reply, done) => {
      disconnect = () => { reply.raw.emit("close"); };
      done();
    });
    const convert = async (_artifact: unknown, signal?: AbortSignal): Promise<never> => {
      upstreamSignal = signal!;
      markStarted();
      return new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new Error("download cancelled")), { once: true }));
    };
    registerRenderRoutes({ app, resolveUserId: async () => "user", projectMembershipGuard: async () => true,
      renderClient: async () => { throw new Error("unexpected SVG"); },
      pngRenderClient: convert, pdfRenderClient: convert,
    });
    try {
      const response = app.inject({ method: "POST", url: `/api/render/${format}`, headers: { "x-uml-project-id": "project" }, payload: { diagramKind: "class", plantUmlSource: "source" } }).then((result) => result);
      await started;
      disconnect();
      await assert.rejects(response, { code: "LIGHT_ECONNRESET" });
      assert.equal(upstreamSignal.aborted, true);
    } finally { await app.close(); }
  });
}
