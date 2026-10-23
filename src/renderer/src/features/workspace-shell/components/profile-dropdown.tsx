// Keeps the original header avatar menu while omitting unavailable account, billing and logout actions.
import { useTranslation } from "react-i18next";
import { Button } from "../../../shared/ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../../../shared/ui/dropdown-menu.js";
import type { PlatformUser } from "../../user-platform/services/platform-api.js";
import { UserIdentity, UserMenuContent } from "./user-menu-content.js";
export function ProfileDropdown({
  user, onAccount, onNavigate,
}: {
  user: PlatformUser | null;
  onAccount: () => void;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8 rounded-full"
        aria-label={t("desktopShell.userMenu")} />}><UserIdentity user={user} compact /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <UserMenuContent user={user} onSettings={onAccount} onNavigate={onNavigate} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
