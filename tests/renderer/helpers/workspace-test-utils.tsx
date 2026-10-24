// Mounts retained component tests with application chrome, localization and dialogs.
import type { ReactNode } from "react";
import { SidebarProvider } from "../../../src/renderer/src/shared/ui/sidebar.js";
import { TooltipProvider } from "../../../src/renderer/src/shared/ui/tooltip.js";
import { AppI18nProvider } from "../../../src/renderer/src/shared/i18n/i18n-provider.js";
import { ThemeProvider } from "../../../src/renderer/src/shared/ui/theme-provider.js";
import { FeedbackDialogProvider } from "../../../src/renderer/src/shared/ui/feedback-dialog.js";
export function withWorkspaceProviders(children: ReactNode) {
  return <AppI18nProvider><ThemeProvider><FeedbackDialogProvider><SidebarProvider><TooltipProvider>{children}</TooltipProvider></SidebarProvider></FeedbackDialogProvider></ThemeProvider></AppI18nProvider>;
}
