// Preserves the original sidebar avatar and popup layout with the local desktop's available actions.
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../../../shared/ui/dropdown-menu.js";
import { useAuthenticatedRouteSession } from "../../user-platform/components/authenticated-route-session.js";
import { UserIdentity, UserMenuContent } from "./user-menu-content.js";
import { cn } from "../../../shared/ui/utils.js";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../../shared/ui/sidebar.js";
export type SidebarUserDropdownProps = {
  onOpenAccount: () => void;
  onNavigate: (path: string) => void;
};
export function SidebarUserDropdown({
  onOpenAccount, onNavigate,
}: SidebarUserDropdownProps) {
  const { t } = useTranslation();
  const user = useAuthenticatedRouteSession()?.user;
  const [open, setOpen] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="h-12 gap-2 data-popup-open:bg-sidebar-accent"
            aria-label={`${t("desktopShell.userMenu")}：${user?.displayName || t("desktopShell.localName")}`} />}>
            <UserIdentity user={user} />
            <ChevronLeft aria-hidden="true" data-slot="user-menu-chevron" className={cn("ml-auto size-4 transition-transform duration-200 motion-reduce:transition-none group-data-[collapsible=icon]:hidden", open && "rotate-180")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" sideOffset={8} className="min-w-60">
            <UserMenuContent user={user} onSettings={onOpenAccount} onNavigate={onNavigate} onSelect={() => setOpenMobile(false)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
