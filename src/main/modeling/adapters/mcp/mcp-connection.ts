// Reuses Pi's MCP transports for both connection checks and session execution.
import { McpClient, StdioTransport, StreamableHttpTransport } from "@earendil-works/pi-mcp";
import type { McpConfig, McpTest } from "../../../../shared/contracts/agent-integrations.js";

export function createIntegrationTransport(config: McpConfig) {
  if (config.type === "http") return new StreamableHttpTransport({ url: config.url, headers: config.headers });
  // Resolve only explicitly saved variables. Never evaluate Pi's !command syntax or shell strings.
  const expand = (value: string) => value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/gu, (_, key: string) => {
    const resolved = config.env?.[key];
    if (!resolved) throw new Error(`请配置环境变量 ${key}`);
    return resolved;
  });
  return new StdioTransport({ command: config.command, args: config.args.map(expand), cwd: config.cwd || undefined, env: config.env, stderr: "pipe" });
}

export function integrationReadiness(id: string, config: McpConfig): string | undefined {
  if (id === "filesystem" && config.type === "stdio" && !config.args.some(value => /^(?:[A-Za-z]:[\\/]|\/|\\\\)/u.test(value))) return "请在参数中添加允许访问的绝对目录";
  if (id === "github" && config.type === "http" && !Object.entries(config.headers ?? {}).some(([key, value]) => key.toLowerCase() === "authorization" && value.trim())) return "请配置 GitHub Authorization 请求头";
  if (config.type === "stdio") {
    for (const argument of config.args) for (const match of argument.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/gu)) {
      if (!config.env?.[match[1]]) return `请配置环境变量 ${match[1]}`;
    }
  }
  return undefined;
}

export async function testMcpConnection(config: McpConfig): Promise<McpTest> {
  const client = new McpClient({ name: "softjl-desktop", version: "0.1.0", requestTimeoutMs: 20000 });
  let transport: ReturnType<typeof createIntegrationTransport> | undefined;
  const checkedAt = new Date().toISOString();
  try {
    transport = createIntegrationTransport(config);
    await client.connect(transport);
    const tools = (await client.listTools()).map(({ name, description }) => ({ name, description }));
    return { ok: true, checkedAt, message: `连接成功，发现 ${tools.length} 个工具`, tools };
  } catch (error) {
    let message = error instanceof Error ? error.message : "连接失败";
    // Server errors can echo arguments or headers. Do not persist or return configured secrets.
    const secrets = Object.values(config.type === "http" ? config.headers ?? {} : config.env ?? {});
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) message = message.split(secret).join("[已隐藏]");
    return { ok: false, checkedAt, message: message.slice(0, 1000), tools: [] };
  } finally {
    await client.close().catch(() => {});
    await transport?.close().catch(() => {});
  }
}
