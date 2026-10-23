// Owns project settings, provider policy, retention, and high-risk project actions.
import { Alert } from '../../../shared/ui/alert.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui/card.js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProjectBackgroundKey } from "../../../../../shared/contracts/index.js";
import { Archive, Loader2 } from "lucide-react";
import { Button } from "../../../shared/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog.js";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "../../../shared/ui/field.js";
import { Input } from "../../../shared/ui/input.js";
import { SelectControl } from "../../../shared/ui/select.js";
import { PageHeader } from "../../../shared/template/layout/page.js";
import { cn } from "../../../shared/ui/utils.js";
import { useFloatingAlert } from "../../../shared/ui/floating-alert.js";
import { localizeCaughtFailure } from "../../../shared/i18n/api-errors.js";
import {
  platformApi,
  type PlatformProject,
  
} from "../services/platform-api.js";
import { ProjectBackgroundPicker } from "./project-background-picker.js";
import { ProjectWorkspaceSettings } from "./project-workspace-settings.js";

export function ProjectSettings({
  project,
  membershipRole,
  layout = "page",
  onProjectDeleted,
  pageTitle,
}: {
  project: PlatformProject;
  membershipRole?: string | null;
  layout?: "page" | "drawer";
  onProjectDeleted?: (projectId: string) => void;
  pageTitle?: string;
}) {
  const { t } = useTranslation();
  const { showAlert } = useFloatingAlert();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [backgroundKey, setBackgroundKey] = useState<ProjectBackgroundKey | null>(
    project.backgroundKey ?? null,
  );
  const [retentionPolicy, setRetentionPolicy] = useState(project.retentionPolicy ?? "manual");
  const [currentProject, setCurrentProject] = useState(project);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);


  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setBackgroundKey(project.backgroundKey ?? null);
    setRetentionPolicy(project.retentionPolicy ?? "manual");
    setCurrentProject(project);
    setDeleteDialogOpen(false);
    setDeletingProject(false);
  }, [project]);

  const saveProject = async () => {
    try {
      const response = await platformApi.updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        backgroundKey,
      });
      const retentionResponse = await platformApi.updateProjectRetentionPolicy(
        project.id,
        retentionPolicy,
      );
      setCurrentProject({ ...response.project, retentionPolicy: retentionResponse.project.retentionPolicy });
      showAlert({ title: t("projectSettings.messages.saved"), tone: "success" });
    } catch (saveError) {
      showAlert({ title: localizeCaughtFailure(saveError, t("projectSettings.errors.save")), tone: "destructive" });
    }
  };

  const archiveProject = async () => {
    if ((membershipRole && membershipRole !== "owner") || currentProject.status !== "active") return;
    if (!window.confirm(t("projectSettings.confirm.archive"))) return;
    try {
      const response = await platformApi.archiveProject(project.id);
      setCurrentProject(response.project);
      showAlert({ title: t("projectSettings.messages.archived"), tone: "success" });
    } catch (archiveError) {
      showAlert({ title: localizeCaughtFailure(archiveError, t("projectSettings.errors.archive")), tone: "destructive" });
    }
  };

  const restoreProject = async () => {
    if ((membershipRole && membershipRole !== "owner") || currentProject.status !== "archived") return;
    if (!window.confirm(t("projectSettings.confirm.restore"))) return;
    try {
      const response = await platformApi.restoreProject(project.id);
      setCurrentProject(response.project);
      showAlert({ title: t("projectSettings.messages.restored"), tone: "success" });
    } catch (restoreError) {
      showAlert({ title: localizeCaughtFailure(restoreError, t("projectSettings.errors.restore")), tone: "destructive" });
    }
  };



  const confirmDeleteProject = async () => {
    if (deletingProject) return;
    setDeletingProject(true);
    try {
      await platformApi.deleteProject(project.id);
      setCurrentProject((current) => ({ ...current, status: "deleted" }));
      showAlert({ title: t("projectSettings.messages.deleted"), tone: "success" });
      setDeleteDialogOpen(false);
      onProjectDeleted?.(project.id);
    } catch (deleteError) {
      showAlert({ title: localizeCaughtFailure(deleteError, t("projectSettings.errors.delete")), tone: "destructive" });
    } finally {
      setDeletingProject(false);
    }
  };

  const settingGridClass =
    layout === "drawer" ? "grid min-w-0 max-w-full gap-4 overflow-hidden" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]";
  const sectionClass = layout === "drawer" ? "min-w-0 max-w-full overflow-hidden" : "";
  const canManageProjectSettings =
    !membershipRole || membershipRole === "owner";
  const settingsBlockedReason = t("projectSettings.permissionDenied");
  return (
    <>
    <div className={cn(layout === "page" && "grid min-w-0 gap-6")}>
      {layout === "page" && (
        <PageHeader
          title={pageTitle ?? t("projectSettings.basic")}
          description={t("projectSettings.basicDescription")}
          className="mb-0 lg:mb-0"
        />
      )}
      <div className={settingGridClass}>
        <Card as="section" className={cn("gap-6 shadow-none", sectionClass)}>
          {layout === "drawer" && (
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t("projectSettings.basic")}</CardTitle>
              <CardDescription className="text-xs">
                {t("projectSettings.basicDescription")}
              </CardDescription>
            </CardHeader>
          )}
          <CardContent>
            <FieldGroup className={cn(layout === "drawer" && "gap-4")}>
              {!canManageProjectSettings && (
                <Alert className="text-xs">
                  {settingsBlockedReason}
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="settings-project-name">{t("projectSettings.name")}</FieldLabel>
                <Input
                  id="settings-project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!canManageProjectSettings}
                  title={!canManageProjectSettings ? settingsBlockedReason : undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-project-description">{t("projectSettings.description")}</FieldLabel>
                <Input
                  id="settings-project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("projectSettings.noDescription")}
                  disabled={!canManageProjectSettings}
                  title={!canManageProjectSettings ? settingsBlockedReason : undefined}
                />
              </Field>
              <ProjectWorkspaceSettings projectId={project.id} canManage={canManageProjectSettings} active={currentProject.status === "active"} />
              <Field>
                <FieldLabel>{t("projectSettings.background")}</FieldLabel>
                <ProjectBackgroundPicker
                  value={backgroundKey}
                  onChange={setBackgroundKey}
                  disabled={!canManageProjectSettings}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-retention-policy">{t("projectSettings.retention.title")}</FieldLabel>
                <SelectControl
                  id="settings-retention-policy"
                  value={retentionPolicy}
                  onValueChange={setRetentionPolicy}
                  disabled={!canManageProjectSettings}
                  options={[
                    { value: "semester_180_days", label: t("projectSettings.retention.semester") },
                    { value: "one_year_365_days", label: t("projectSettings.retention.year") },
                    { value: "manual", label: t("projectSettings.retention.manual") },
                  ]}
                />
              </Field>
              <Button
                type="button"
                className="w-fit"
                onClick={() => void saveProject()}
                disabled={!canManageProjectSettings}
                title={!canManageProjectSettings ? settingsBlockedReason : undefined}
              >
                {t("projectSettings.save")}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card as="section" className={cn("gap-6 border border-destructive/40 shadow-none", sectionClass)}>
          <CardHeader>
            <CardTitle className="text-base">{t("projectSettings.danger.title")}</CardTitle>
            <CardDescription>
              {t("projectSettings.danger.description", { status: t(`projectSettings.status.${currentProject.status}`, { defaultValue: currentProject.status }) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {currentProject.status === "active" && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void archiveProject()}
              disabled={!canManageProjectSettings}
              title={!canManageProjectSettings ? settingsBlockedReason : undefined}
            >
              <Archive className="size-4" />
              {t("projectSettings.actions.archive")}
            </Button>
            )}
            {currentProject.status === "archived" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void restoreProject()}
              disabled={!canManageProjectSettings}
              title={!canManageProjectSettings ? settingsBlockedReason : undefined}
            >
              {t("projectSettings.actions.restore")}
            </Button>
            )}

            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={!canManageProjectSettings || deletingProject}
              title={!canManageProjectSettings ? settingsBlockedReason : undefined}
            >
              {deletingProject ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("projectSettings.actions.delete")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("projectSettings.deleteDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("projectSettings.deleteDialog.description", { name: currentProject.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deletingProject}
          >
            {t("projectSettings.deleteDialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirmDeleteProject()}
            disabled={deletingProject}
          >
            {deletingProject ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("projectSettings.deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
