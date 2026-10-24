// Composes profile, model and agent integration settings with independent drafts.
import { useEffect, useRef, useState } from "react";
import { BookOpen, Cable, Settings, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../../../shared/ui/dialog.js";
import { Button } from "../../../shared/ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/tabs.js";
import { useIsMobile } from "../../../shared/hooks/use-mobile.js";
import { GlobalSettingsPanel, type GlobalSettingsActions } from "../../settings/components/global-settings-panel.js";
import { useAuthenticatedRouteSession } from "./authenticated-route-session.js";
import type { PlatformUser } from "../services/platform-api.js";
import { ProfilePreferencesPanel } from "./profile-preferences-panel.js";
import { AgentIntegrationsPanel } from "../../settings/components/agent-integrations-panel.js";

type SettingsPage = "models" | "profile" | "mcp" | "skills";
type Props = {
  showTrigger?: boolean;
  onNavigate: (path: string) => void;
  initialUser?: PlatformUser | null;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
  globalSettingsRequestId?: number;
};

function SettingsContent({ user, onNavigate, onCancel, globalSettingsRequestId }: {
  user?: PlatformUser | null; onNavigate: (path: string) => void; onCancel: () => void;
  globalSettingsRequestId?: number;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const models = useRef<GlobalSettingsActions>(null);
  const profile = useRef<GlobalSettingsActions>(null);
  const [page, setPage] = useState<SettingsPage>("profile");
  const [modelDirty, setModelDirty] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [mcpDirty, setMcpDirty] = useState(false);
  const [skillsDirty, setSkillsDirty] = useState(false);
  const [mcpBusy, setMcpBusy] = useState(false);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const integrationsPage = page === "mcp" || page === "skills";
  const busy = profileBusy || mcpBusy || skillsBusy;
  const anyDirty = modelDirty || profileDirty || mcpDirty || skillsDirty;
  const dirty = page === "models" ? modelDirty : page === "profile" ? profileDirty : page === "mcp" ? mcpDirty : skillsDirty;
  useEffect(() => { if (globalSettingsRequestId) setPage("models"); }, [globalSettingsRequestId]);

  const pages = [
    { id: "profile", title: t("account.profile"), description: t("account.profileDescription"), Icon: UserRound },
    { id: "models", title: t("account.block37.models"), description: t("account.globalSettingsDescription"), Icon: Settings },
    { id: "mcp", title: t("integrations.mcpTitle"), description: t("integrations.mcpDescription"), Icon: Cable },
    { id: "skills", title: t("integrations.skillsTitle"), description: t("integrations.skillsDescription"), Icon: BookOpen },
  ] as const;
  const reset = () => {
    if (page === "models") models.current?.reset();
    else if (page === "profile") profile.current?.reset();
  };
  const save = () => {
    if (page === "models") models.current?.save();
    else if (page === "profile") profile.current?.save();
  };
  return <Tabs value={page} onValueChange={value => setPage(value as SettingsPage)} orientation={isMobile ? "horizontal" : "vertical"}
    className="size-full min-h-0 gap-0 max-md:flex-col">
    <aside className="flex min-w-0 shrink-0 flex-col border-b bg-muted/30 p-4 md:w-54 md:border-r md:border-b-0">
      <DialogTitle className="text-base font-semibold">{t("account.settings")}</DialogTitle>
      <DialogDescription className="mt-1 text-xs">{t("account.preferences")}</DialogDescription>
      {/* Only the mobile row scrolls horizontally; sidebar tabs do not use the shared protruding line indicator. */}
      <TabsList aria-label={t("account.settings")} className="mt-4 h-auto! w-full items-stretch justify-start gap-1 overflow-x-auto bg-transparent p-0 md:overflow-x-hidden">
        {pages.map(({ id, title, Icon }) => <TabsTrigger key={id} value={id} aria-label={title}
          className="h-9 min-w-0 flex-none justify-start gap-2 px-3 after:hidden data-active:border-border data-active:bg-muted data-active:shadow-none">
          <Icon className="size-4" /><span className="truncate">{title}</span>
        </TabsTrigger>)}
      </TabsList>
    </aside>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {pages.map(({ id, title, description }) => <TabsContent key={id} value={id} keepMounted className="space-y-4">
          <div><h2 className="text-lg font-semibold">{title}</h2>
            <p data-page-description className="mt-1 text-sm text-muted-foreground">{description.replace(/[。.]+$/u, "")}</p>
          </div>
          {/* Keep independent drafts mounted so switching pages preserves unsaved edits. */}
          {id === "models" && user && <GlobalSettingsPanel ref={models} active currentUserId={user.id}
            onNavigate={onNavigate} onDirtyChange={setModelDirty} embedded />}
          {id === "profile" && user && <ProfilePreferencesPanel ref={profile} user={user} onDirtyChange={setProfileDirty} onBusyChange={setProfileBusy} />}
          {id === "mcp" && <AgentIntegrationsPanel kind="mcp" active={page === id} onDirtyChange={setMcpDirty} onBusyChange={setMcpBusy} />}
          {id === "skills" && <AgentIntegrationsPanel kind="skills" active={page === id} onDirtyChange={setSkillsDirty} onBusyChange={setSkillsBusy} />}
        </TabsContent>)}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
        <span role="status" className="text-xs text-muted-foreground">{t(anyDirty ? "account.block37.unsaved" : integrationsPage ? "integrations.immediate" : "account.block37.allSaved")}</span>
        <div className="ml-auto flex items-center gap-2">
          {!integrationsPage && <Button variant="ghost" onClick={reset} disabled={busy}>{t("account.block37.reset")}</Button>}
          <Button variant="outline" onClick={onCancel} disabled={busy}>{t("account.block37.cancel")}</Button>
          {!integrationsPage && <Button onClick={save} disabled={!dirty || busy}>{t("account.block37.save")}</Button>}
        </div>
      </footer>
    </div>
  </Tabs>;
}

export function AccountDialog({ showTrigger = true, open: controlledOpen, onOpenChange, onNavigate,
  initialUser, globalSettingsRequestId }: Props) {
  const { t } = useTranslation();
  const inheritedUser = useAuthenticatedRouteSession()?.user;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const close = () => { setOpen(false); };
  // Dismissal discards this dialog's drafts; only explicit save actions persist edits.
  return <Dialog open={open} onOpenChange={setOpen}>
    {showTrigger && <DialogTrigger render={<Button variant="ghost" aria-label={t("account.settings")} />}>
      <Settings className="size-4" />{t("account.settings")}
    </DialogTrigger>}
    <DialogContent showCloseButton={false} className="flex h-[min(720px,calc(100dvh-3rem))] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
      {open && <SettingsContent user={initialUser ?? inheritedUser} onNavigate={onNavigate} onCancel={close}
        globalSettingsRequestId={globalSettingsRequestId} />}
    </DialogContent>
  </Dialog>;
}
