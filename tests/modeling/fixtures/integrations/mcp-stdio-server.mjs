// Provides a local stdio MCP peer for testing process startup, discovery and tool execution.
import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  const message = JSON.parse(line);
  if (message.id === undefined) continue;
  let result = {};
  switch (message.method) {
    case "initialize":
      result = { protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "softjl-stdio-peer", version: "1" } };
      break;
    case "tools/list":
      result = { tools: [
        { name: "read_record", description: "Read a modeling record", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
        { name: "write_file", description: "Write a file", inputSchema: { type: "object", properties: {} } },
      ] };
      break;
    case "tools/call":
      result = { content: [{ type: "text", text: JSON.stringify({ record: "actual MCP evidence", input: message.params.arguments }) }] };
      break;
    default:
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }) + "\n");
      continue;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\n");
}
