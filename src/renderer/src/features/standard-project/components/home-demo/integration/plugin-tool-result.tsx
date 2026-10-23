// Binds Pi plugin results to official assistant-ui elements without recreating their presentation.
import { useState } from "react";
import { TaskCard } from "../../../../../shared/assistant-ui/elements/task-card.js";
import { WebSearch } from "../../../../../shared/assistant-ui/elements/web-search.js";
import { Sources } from "../../../../../shared/assistant-ui/elements/sources.js";
import { pluginSources, pluginAgentState, record } from "../../../lib/plugin-tool-data.js";

export function PluginToolResult({ name, args, data, output, running, failed }: {
  name: string; args: Record<string, unknown>; data: unknown; output?: string; running: boolean; failed: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (["subagent", "get_subagent_result"].includes(name)) {
    const result = record(data);
    return <div className="my-2"><TaskCard label={String(result.description ?? args.description ?? args.prompt ?? "子代理")}
      meta={[result.displayName ?? args.subagent_type, result.modelName ?? result.model].filter(value => typeof value === "string").join(" · ")}
      state={pluginAgentState(data, running, failed)}
      result={output && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{output}</pre>} />
    </div>;
  }
  const sources = pluginSources(data);
  return <div className="my-2 space-y-2">
    {name === "web_search" && <WebSearch query={String(args.query ?? (Array.isArray(args.queries) ? args.queries.join(" · ") : ""))}
      results={sources} visibleResults={sources.length} searching={running} cycle={0} className="max-w-none" />}
    {sources.length > 0 && <Sources sources={sources} open={open} onOpenChange={setOpen} layout="list" />}
    {output && <details><summary className="cursor-pointer text-xs text-muted-foreground">{failed ? "执行失败 / Failed" : "工具输出 / Tool output"}</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{output}</pre></details>}
  </div>;
}
