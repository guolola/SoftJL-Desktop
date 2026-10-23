// Places the project's existing reasoning Switch beside the source model selector, outside its popup.
import { type ComponentProps } from "react";
import { useAuiState } from "@assistant-ui/react";
import { ModelingModelSelector } from "../../../../../shared/ui/modeling-model-selector.js";
import { canSelectHomeModel } from "./model.js";
import { useHomeDemo } from "./environment.js";
import { homeText, useHomeLocale } from "./home-locale.js";
import { ModelSelector as OriginalModelSelector } from "../source/elements/model-selector.aui.js";
import { useHomePortal } from "./portals.js";

export function ModelSelector({ models, effort, onEffortChange, ...props }: ComponentProps<typeof OriginalModelSelector>) {
  useHomeLocale();
  const { modelContext, providerRequired } = useHomeDemo();
  const portalContainer = useHomePortal();
  const disabled = useAuiState(state => state.thread.isDisabled || state.thread.isRunning);
  const supportsReasoning = modelContext?.model === props.value && modelContext?.capacity.capabilities?.reasoning === true;
  return <ModelingModelSelector {...props} models={models} translate={homeText} portalContainer={portalContainer}
    providerRequired={providerRequired}
    disabled={disabled || !canSelectHomeModel()} reasoning={effort === "medium"} reasoningSupported={supportsReasoning}
    onReasoningChange={(enabled) => onEffortChange?.(enabled ? "medium" : "low")} />;
}
