// Supplies a deterministic Streamable HTTP MCP peer for connection and native Pi integration tests.
import { createServer } from "node:http";
export async function startMcpTestServer() {
  const calls: { name: string; arguments: unknown }[] = [];
  const server = createServer(async (request, response) => {
    if (request.method !== "POST") { response.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const message = JSON.parse(Buffer.concat(chunks).toString()) as { id?: number; method: string; params?: Record<string, unknown> };
    if (message.id === undefined) { response.writeHead(202).end(); return; }
    let result: unknown = {};
    if (message.method === "initialize") result = { protocolVersion: message.params?.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "softjl-test-peer", version: "1" } };
    if (message.method === "tools/list") result = { tools: [
      { name: "read_record", description: "Read a modeling record", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
      { name: "write_file", description: "Write a file", inputSchema: { type: "object", properties: {} } },
    ] };
    if (message.method === "tools/call") { calls.push({ name: String(message.params?.name), arguments: message.params?.arguments }); result = { content: [{ type: "text", text: JSON.stringify({ record: "actual MCP evidence", input: message.params?.arguments }) }] }; }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing MCP test address");
  return { url: `http://127.0.0.1:${address.port}/mcp`, calls, close: async () => {
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}
