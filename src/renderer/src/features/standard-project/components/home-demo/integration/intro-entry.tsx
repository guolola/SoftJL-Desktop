// Places the supplied welcome blocks around the original composer only while the thread is empty.
import { useAuiState } from "@assistant-ui/react";
import { Composer as OriginalComposer } from "../source/composer.js";
import { IntroSuggestions } from "./intro/intro-suggestions.js";
import Miscellaneous70 from "./intro/miscellaneous-70.js";

export { EditComposer } from "../source/composer.js";
export { FollowUps } from "../source/suggestions.js";

export function Composer() {
  const isEmpty = useAuiState(state => state.thread.messages.length === 0
    && (!state.thread.isLoading || state.threads.isLoading));

  return <>
    {/* The physics floor touches the composer's top edge; the input stays outside the drag surface. */}
    {isEmpty && <div className="agent-intro-badges" data-testid="agent-intro-badges">
      <Miscellaneous70 />
    </div>}
    <OriginalComposer />
  </>;
}

export function Suggestions() {
  return <IntroSuggestions />;
}
