// Shows the Elements loader only while a live modeling turn has no assistant content yet.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GenerationLoader } from "../../../shared/assistant-ui/elements/loading-state.js";
import { useHomeDemo } from "./home-demo/integration/environment.js";

export function ConversationLoading() {
  const { state } = useHomeDemo();
  const { i18n } = useTranslation();
  const latest = state.conversation?.at(-1);
  const waiting = state.run?.status === "running" && (!latest || latest.role === "user"
    || (!latest.text.trim() && !latest.reasoning?.trim() && !latest.tools?.length));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!waiting || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setTick(value => value + 1), 120);
    return () => clearInterval(timer);
  }, [waiting]);
  return waiting ? <GenerationLoader role="status" aria-live="polite" label={i18n.language.startsWith("zh") ? "正在处理，请稍候…" : "Preparing a response…"} tick={tick} className="mx-auto py-4" /> : null;
}
