// Keeps the project sidebar shell, resize handle and footer identical in ordinary and professional modes.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DefaultSidebar } from "../../../shared/template/layout/default-sidebar.js";
import {
  SidebarUserDropdown,
  type SidebarUserDropdownProps,
} from "./sidebar-user-dropdown.js";

export function ProjectSidebar({
  children,
  ...accountActions
}: SidebarUserDropdownProps & {
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <DefaultSidebar
      resizeLabel={t("workspace.sidebar.resize")}
      footer={<SidebarUserDropdown {...accountActions} />}
    >
      {children}
    </DefaultSidebar>
  );
}
