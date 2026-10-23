// Keeps appearance drafts isolated from the live workbench until their own settings page is saved.
import { useState } from "react";
import { useAppI18n } from "../../../shared/i18n/i18n-provider.js";
import { useSidebar } from "../../../shared/ui/sidebar.js";
import { useTheme } from "../../../shared/ui/theme-provider.js";
import type { PreferencesDraft } from "../components/block37-preferences.js";

export type AppearancePage = "theme" | "layout" | "language";
const fields = { theme: ["mode", "preset"], layout: ["sidebar"], language: ["language"] } as const;
const defaults: PreferencesDraft = { mode: "system", preset: "default", sidebar: "expanded", language: "system" };

export function useAppearancePreferences() {
  const theme = useTheme();
  const sidebar = useSidebar();
  const locale = useAppI18n();
  const [draft, setDraft] = useState<PreferencesDraft>(() => ({
    mode: theme.mode, preset: theme.themePreset, sidebar: sidebar.state, language: locale.preference,
  }));
  const [saved, setSaved] = useState(draft);
  const dirty = (page: AppearancePage) => fields[page].some(key => draft[key] !== saved[key]);
  const reset = (page: AppearancePage) => setDraft(current => ({ ...current,
    ...Object.fromEntries(fields[page].map(key => [key, defaults[key]])),
  }));
  const save = (page: AppearancePage) => {
    if (page === "theme") { theme.setMode(draft.mode); theme.setThemePreset(draft.preset); }
    if (page === "layout") sidebar.setOpen(draft.sidebar === "expanded");
    if (page === "language") locale.setPreference(draft.language);
    // Saving one page must not silently apply drafts from another page.
    setSaved(current => ({ ...current, ...Object.fromEntries(fields[page].map(key => [key, draft[key]])) }));
  };
  return { draft, setDraft, dirty, reset, save, resolvedTheme: theme.systemTheme,
    anyDirty: JSON.stringify(draft) !== JSON.stringify(saved) };
}
