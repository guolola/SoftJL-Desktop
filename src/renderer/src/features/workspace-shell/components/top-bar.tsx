// Renders workspace-level navigation, run controls, and account/project entry points.
import {
Home,
Moon,
Sun
} from "lucide-react";
import { AnimatePresence,motion,useReducedMotion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdmincnHeader } from "../../../shared/template/layout/header.js";
import { ProfileDropdown } from './profile-dropdown.js';



import { Button } from "../../../shared/ui/button.js";

import { useTheme } from "../../../shared/ui/theme-provider.js";
import { AccountDialog } from "../../user-platform/components/account-dialog.js";
import { useAuthenticatedRouteSession } from "../../user-platform/components/authenticated-route-session.js";

import {
type ShellRoutePath
} from "../../../entities/workspace/modules.js";
import { LanguagePreferenceMenu } from "../../../shared/i18n/components/language-preference-menu.js";
import { ThemePresetMenu } from "../../../shared/template/layout/theme-preset-menu.js";

export type { ShellRoutePath };

export type TopBarProps = {
  currentRoute: string | null;
  onNavigate: (route: string) => void;
  accountDialogOpen?: boolean;
  onAccountDialogOpenChange?: (open: boolean) => void;
  globalSettingsRequestId?: number;
};

const topBarActionButtonClass =
  "size-9 shrink-0";

const themeIconVariants = {
  initial: { opacity: 0, rotate: -90, scale: 0.5 },
  animate: {
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 200, damping: 15 },
  },
  exit: {
    opacity: 0,
    rotate: 90,
    scale: 0.5,
    transition: { duration: 0.15, ease: "easeIn" as const },
  },
};

const reducedThemeIconVariants = {
  initial: { opacity: 1, rotate: 0, scale: 1 },
  animate: { opacity: 1, rotate: 0, scale: 1, transition: { duration: 0 } },
  exit: { opacity: 1, rotate: 0, scale: 1, transition: { duration: 0 } },
};

export function TopBar({
  currentRoute,
  onNavigate,
  accountDialogOpen: controlledAccountDialogOpen,
  onAccountDialogOpenChange,
  globalSettingsRequestId,
}: TopBarProps) {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const reduceMotion = useReducedMotion();
  const authSession = useAuthenticatedRouteSession();
  const [uncontrolledAccountDialogOpen, setUncontrolledAccountDialogOpen] =
    useState(false);
  const accountDialogOpen =
    controlledAccountDialogOpen ?? uncontrolledAccountDialogOpen;
  const setAccountDialogOpen =
    onAccountDialogOpenChange ?? setUncontrolledAccountDialogOpen;
  return <AdmincnHeader showSidebar navigation={<Button variant="ghost" onClick={() => onNavigate("/projects")}><Home className="size-4" />{t("nav.home")}</Button>} actions={<>
        <LanguagePreferenceMenu className={topBarActionButtonClass} />
        <ThemePresetMenu className={topBarActionButtonClass} />
        <Button
          variant="ghost"
          size="icon"
          className={topBarActionButtonClass}
          onClick={toggle}
          title={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
          aria-label={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
          aria-pressed={theme === "dark"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              data-slot="theme-toggle-icon"
              variants={reduceMotion ? reducedThemeIconVariants : themeIconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex items-center justify-center"
            >
              {theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </Button>
        {authSession === null ? (
          <span aria-hidden="true" className="size-9 animate-pulse rounded-full bg-muted" />
        ) : (
          <ProfileDropdown user={authSession?.user ?? null} onAccount={() => setAccountDialogOpen(true)} onNavigate={onNavigate} />
        )}
        <AccountDialog
          showTrigger={false}
          open={accountDialogOpen}
          onOpenChange={setAccountDialogOpen}
          onNavigate={onNavigate}
          initialUser={authSession?.user ?? null}
          globalSettingsRequestId={globalSettingsRequestId}
        />
    </>}
  />;
}
