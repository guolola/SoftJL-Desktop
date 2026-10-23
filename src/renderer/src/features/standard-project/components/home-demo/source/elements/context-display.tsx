// Preserves upstream exports while both modeling modes render the shared context meter.
"use client";
import { type FC } from "react";
import { homeText, useHomeLocale } from "../../integration/home-locale.js";
import { useHomePortal } from "../../integration/portals.js";
import {
  ContextDisplayBar as SharedBar,
  ContextDisplayContent,
  ContextDisplayRing as SharedRing,
  ContextDisplayRoot as SharedRoot,
  ContextDisplayText as SharedText,
  ContextDisplayTrigger,
  type ContextDisplayRootProps,
  type PresetProps,
} from "../../../../../../shared/ui/modeling-context-display.js";

export type { ContextDisplayRootProps, PresetProps, TokenUsage } from "../../../../../../shared/ui/modeling-context-display.js";

function ContextDisplayRoot(props: ContextDisplayRootProps) {
  useHomeLocale();
  const portalContainer = useHomePortal();
  return <SharedRoot {...props} preserveLastUsage={false} translate={homeText} portalContainer={portalContainer} />;
}

function withHomeContext(Preset: FC<PresetProps>): FC<PresetProps> {
  return function HomeContextPreset(props) {
    useHomeLocale(true);
    const portalContainer = useHomePortal();
    return <Preset {...props} preserveLastUsage={false} translate={homeText} portalContainer={portalContainer} />;
  };
}

const ContextDisplayRing = withHomeContext(SharedRing);
const ContextDisplayBar = withHomeContext(SharedBar);
const ContextDisplayText = withHomeContext(SharedText);

export { ContextDisplayRoot, ContextDisplayTrigger, ContextDisplayContent, ContextDisplayRing, ContextDisplayBar, ContextDisplayText };
