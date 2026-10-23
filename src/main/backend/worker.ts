// Runs the local backend in an Electron utility process, outside the renderer and window event loop.
import { startDesktopBackend, type DesktopBackendOptions } from "./server.js";
let backend: Awaited<ReturnType<typeof startDesktopBackend>> | undefined;
process.parentPort.on(
  "message",
  async ({ data }: { data: DesktopBackendOptions & { kind: string } }) => {
    try {
      if (data.kind === "start") {
        if (backend) throw new Error("本地服务已启动");
        backend = await startDesktopBackend(data);
        process.parentPort.postMessage({
          kind: "ready",
          origin: backend.origin,
        });
      } else if (data.kind === "close") {
        await backend?.close();
        process.exit(0);
      }
    } catch (error) {
      process.parentPort.postMessage({
        kind: "error",
        error: String((error as Error).message ?? error),
      });
    }
  },
);
