// Mounts the unchanged upstream content area; settings, drafts and commands stay behind data adapters.
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { StandardProjectState } from "../../../../../shared/contracts/index.js";
import { Thread } from "./home-demo/source/thread.js";
import { CommandInstructions } from "./home-demo/source/commands.js";
import { HomeDemoEnvironment } from "./home-demo/integration/environment.js";
import { HomeDemoPortals } from "./home-demo/integration/portals.js";
import { configureHomeModels } from "./home-demo/integration/model.js";
import { homeEffortPreference, usePersistedPreference } from "./home-demo/integration/persisted-preference.js";
import { useConversationRuntime, type SendConversationCommand } from "../hooks/use-conversation-runtime.js";
import { useConversationSettings } from "../hooks/use-conversation-settings.js";
import { useConversationDraft, saveConversationDraft } from "../hooks/use-conversation-draft.js";
import { generationModelBlockedReason } from "../../../shared/lib/generation-model.js";
import { loadUserSettings } from "../../../shared/lib/user-settings.js";
import { requestProviderRequiredNotice } from "../../../shared/lib/provider-required-notice.js";
import { floatingAlert } from "../../../shared/ui/floating-alert.js";
import { ConversationCoding } from "./conversation-coding.js";
import { ConversationCodingContext, useConversationCoding } from "../hooks/use-conversation-coding.js";

function DraftBinding({ projectId }: { projectId: string }) { useConversationDraft(projectId); return null; }
export function ProjectConversation({ projectId, state, disabled, canCancel, canEdit = true, displayName, onSend, onCancel, onFeedback }: {
  projectId: string; state: StandardProjectState; disabled: boolean; canCancel: boolean; canEdit?: boolean; displayName?: string;
  onSend: SendConversationCommand; onCancel: () => Promise<unknown>; onFeedback: (id: string, type: "positive" | "negative") => Promise<unknown>;
}) {
  const { i18n } = useTranslation();
  const coding = useConversationCoding(projectId);
  const { settings, modelContext } = useConversationSettings(projectId);
  const reasoning = usePersistedPreference(homeEffortPreference) === "medium";
  const providerRequired = !settings.providerConfigId || settings.providerModelOptions.length === 0;
  const guardedSend: SendConversationCommand = async command => {
    if (disabled) return false;
    const current = loadUserSettings();
    const reason = generationModelBlockedReason("provider", current);
    if (reason) {
      if (!current.providerConfigId || current.providerModelOptions.length === 0) requestProviderRequiredNotice();
      else floatingAlert.warning(reason);
      return false;
    }
    return onSend(command);
  };
  const runtime = useConversationRuntime({ state, projectId, disabled, canCancel, onSend: guardedSend, onCancel, onFeedback, modelContext, reasoning });
  const modelRevision = configureHomeModels(settings, modelContext, disabled, state.tokenUsage);
  return <ConversationCodingContext.Provider value={coding.status}><AssistantRuntimeProvider runtime={runtime}>
    <HomeDemoEnvironment value={{ projectId, displayName, model: settings.defaultModel, modelRevision, modelContext, state, disabled, providerRequired,
      onAnswer: command => guardedSend({ ...command, language: i18n.language.startsWith("zh") ? "zh-CN" : "en", ...(modelContext?.capacity.capabilities?.reasoning ? { reasoning } : {}) }) }}>
      <HomeDemoPortals>
        {/* The embedded theme maps body styles onto this root; let the host canvas show through. */}
        <div className="homepage-theme homepage-conversation flex min-h-0 min-w-0 flex-col" style={{ "--thread-max-width": "42rem", backgroundColor: "transparent", overflow: "hidden" } as CSSProperties}
          onChangeCapture={event => { if (event.target instanceof HTMLTextAreaElement && event.target.hasAttribute("data-composer-input")) saveConversationDraft(projectId, event.target.value); }}>
          <ConversationCoding coding={coding} state={state} canEdit={canEdit} disabled={disabled} canCancel={canCancel} onCancel={onCancel} />
          <div className="min-h-0 flex-1"><DraftBinding projectId={projectId} /><CommandInstructions /><Thread /></div>
        </div>
      </HomeDemoPortals>
    </HomeDemoEnvironment>
  </AssistantRuntimeProvider></ConversationCodingContext.Provider>;
}
