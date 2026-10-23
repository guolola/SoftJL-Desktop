// Shares the original avatar menu composition with only destinations supported by the local desktop app.
import { BookOpen, FolderKanban, LayoutDashboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "../../../shared/ui/avatar.js";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "../../../shared/ui/dropdown-menu.js";
import type { PlatformUser } from "../../user-platform/services/platform-api.js";

export function UserIdentity({ user, compact = false }: { user?: PlatformUser | null; compact?: boolean }) {
  const { t } = useTranslation();
  const name = user?.displayName || t("desktopShell.localName");
  return <>
    <Avatar className="size-8 rounded-lg">
      <AvatarImage src={user?.avatarUrl || "/avatars/chiikawa-shy.gif"} alt="" />
      <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
    </Avatar>
    {!compact && <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
      <span className="truncate font-semibold">{name}</span>
      <span className="mt-0.5 truncate text-xs text-muted-foreground">{user?.username || t("desktopShell.localOnly")}</span>
    </div>}
  </>;
}

export function UserMenuContent({ user, onSettings, onNavigate, onSelect }: {
  user?: PlatformUser | null; onSettings: () => void; onNavigate: (path: string) => void; onSelect?: () => void;
}) {
  const { t } = useTranslation();
  return <>
    <DropdownMenuLabel className="flex items-center gap-2 py-2 text-foreground"><UserIdentity user={user} /></DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => { onSelect?.(); onSettings(); }}><Settings />{t("account.settings")}</DropdownMenuItem>
    {[
      { label: t("nav.dashboard"), path: "/dashboard", Icon: LayoutDashboard },
      { label: t("nav.projects"), path: "/projects", Icon: FolderKanban },
    ].map(({ label, path, Icon }) => <DropdownMenuItem key={path} onClick={() => { onSelect?.(); onNavigate(path); }}>
      <Icon />{label}
    </DropdownMenuItem>)}
    <DropdownMenuItem render={<a href="https://jianglisoftware.com/tutorial" target="_blank" rel="noopener noreferrer" />} onClick={onSelect}>
      <BookOpen />{t("nav.tutorial")}
    </DropdownMenuItem>
  </>;
}
