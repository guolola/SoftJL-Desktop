// Reuses the original settings preview, segmented controls and palette swatches for the desktop dialog.
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../shared/ui/button.js";
import { themePresets } from "../../../shared/ui/theme-provider.js";
import { Block37Preview, Segmented, SelectField, SettingRow } from "./block37-preferences.js";
import type { AppearancePage, useAppearancePreferences } from "../hooks/use-appearance-preferences.js";

export function AppearancePreferencesPanel({ page, preferences }: {
  page: AppearancePage; preferences: ReturnType<typeof useAppearancePreferences>;
}) {
  const { t } = useTranslation();
  const { draft, setDraft, resolvedTheme } = preferences;
  const previewMode = draft.mode === "system" ? resolvedTheme : draft.mode;
  return <>
    <Block37Preview draft={draft} resolvedTheme={resolvedTheme} kind={page === "language" ? "locale" : "app"} />
    {page === "theme" && <>
      <SettingRow label={t("account.block37.mode")} hint={t("account.block37.modeHint")}>
        <Segmented label={t("account.block37.mode")} value={draft.mode} onChange={mode => setDraft(current => ({ ...current, mode }))}
          options={[
            { value: "light", label: t("account.block37.light"), icon: <Sun className="size-4" /> },
            { value: "dark", label: t("account.block37.dark"), icon: <Moon className="size-4" /> },
            { value: "system", label: t("account.block37.system"), icon: <Monitor className="size-4" /> },
          ]} />
      </SettingRow>
      <SettingRow label={t("account.block37.palette")} hint={t("account.block37.paletteHint")}>
        <div role="group" aria-label={t("account.block37.palette")} className="grid w-fit grid-cols-5 gap-2.5 py-2">
          {[{ key: "default", label: t("account.block37.defaultPalette"), color: previewMode === "dark" ? "#e5e5e5" : "#262626" },
            ...Object.entries(themePresets).map(([key, preset]) => ({ key, label: preset.label, color: preset.styles[previewMode].primary }))]
            .map(({ key, label, color }) => <Button key={key} variant="ghost" size="icon" className="size-8 rounded-full p-0"
              aria-label={label} aria-pressed={draft.preset === key} title={label}
              style={{ backgroundColor: color }}
              onClick={() => setDraft(current => ({ ...current, preset: key as typeof draft.preset }))}>
              {draft.preset === key && <Check className="size-4 text-white mix-blend-difference" />}
            </Button>)}
        </div>
      </SettingRow>
    </>}
    {page === "layout" && <SettingRow label={t("account.block37.sidebar")} hint={t("account.block37.sidebarHint")}>
      <Segmented label={t("account.block37.sidebar")} value={draft.sidebar}
        onChange={sidebar => setDraft(current => ({ ...current, sidebar }))}
        options={[{ value: "expanded", label: t("account.block37.expanded") }, { value: "collapsed", label: t("account.block37.collapsed") }]} />
    </SettingRow>}
    {page === "language" && <SettingRow label={t("account.block37.language")} hint={t("account.block37.languageHint")} htmlFor="settings-language">
      <SelectField id="settings-language" value={draft.language}
        onChange={language => setDraft(current => ({ ...current, language }))}
        options={[{ value: "system", label: t("account.block37.system") }, { value: "zh-CN", label: "中文" }, { value: "en", label: "English" }]} />
    </SettingRow>}
  </>;
}
