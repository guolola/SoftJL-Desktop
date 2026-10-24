// Creates invitation-only projects from a single form with details and mode selection.
import { Textarea } from '../../../shared/ui/textarea.js';
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { floatingAlert } from "../../../shared/ui/floating-alert.js";
import { localizeCaughtFailure } from "../../../shared/i18n/api-errors.js";
import { Loader2 } from "lucide-react";
import { Button } from "../../../shared/ui/button.js";
import { Input } from "../../../shared/ui/input.js";
import { Field, FieldGroup, FieldLabel, FieldSet } from "../../../shared/ui/field.js";
import { platformApi, type PlatformProject } from "../services/platform-api.js";
import { randomProjectBackground } from "../lib/project-backgrounds.js";
import { queueProjectIntroduction } from "../../../shared/lib/project-introduction.js";
import { ProjectWorkspaceField } from "./project-workspace-field.js";

type Navigate = (path: string) => void;

export function ProjectCreateForm({ onNavigate }: { onNavigate: Navigate }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Assign a default once; users can change the background in project settings after creation.
  const [backgroundKey] = useState(() => randomProjectBackground().key);
  const [creating, setCreating] = useState(false);
  const [workspace, setWorkspace] = useState<{ selectionId: string; directory: string } | null>(null);
  const [choosingWorkspace, setChoosingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const createdProject = useRef<PlatformProject | null>(null);
  const assignedSelection = useRef<string | null>(null);
  const workspaceAvailable = typeof window.desktop?.chooseProjectWorkspace === "function" && typeof window.desktop?.assignProjectWorkspace === "function";
  const mounted = useRef(false);
  const navigationTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the form must cancel its delayed redirect, including during route transitions.
      window.clearTimeout(navigationTimer.current);
    };
  }, []);

  const chooseWorkspace = async () => {
    if (creating || choosingWorkspace || !workspaceAvailable) return;
    setChoosingWorkspace(true); setWorkspaceError("");
    try { const selected = await window.desktop.chooseProjectWorkspace(); if (selected && mounted.current) setWorkspace(selected); }
    catch (cause) { if (mounted.current) setWorkspaceError(cause instanceof Error ? cause.message : t("projectWorkspace.failed")); }
    finally { if (mounted.current) setChoosingWorkspace(false); }
  };
  const createProject = async () => {
    if (creating || choosingWorkspace || !name.trim()) return;
    setCreating(true);
    try {
      const response = createdProject.current ? { project: createdProject.current } : await platformApi.createProject({
        name: name.trim(),
        description: description.trim() || null,
        backgroundKey,
      });
      // Retain successful creation if native directory binding fails so retry never duplicates the project.
      createdProject.current = response.project;
      if (workspace && assignedSelection.current !== workspace.selectionId) {
        await window.desktop.assignProjectWorkspace(response.project.id, workspace.selectionId);
        assignedSelection.current = workspace.selectionId;
      }
      setWorkspaceError("");
      queueProjectIntroduction(response.project.id);
      if (!mounted.current) return;
      floatingAlert.success(t("projects.createForm.created"));
      navigationTimer.current = window.setTimeout(() => {
        if (mounted.current) onNavigate(`/projects/${response.project.id}`);
      }, 900);
    } catch (error) {
      if (mounted.current) {
        if (createdProject.current) setWorkspaceError(t("projectWorkspace.createdButNotAssigned", { message: error instanceof Error ? error.message : t("projectWorkspace.failed") }));
        floatingAlert.error(localizeCaughtFailure(error, t("projects.createForm.failed")));
      }
    } finally {
      if (mounted.current && navigationTimer.current === undefined) setCreating(false);
    }
  };

  return (
    <form className="grid gap-6" onSubmit={(event) => { event.preventDefault(); void createProject(); }}>
      <FieldSet disabled={creating}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="project-name">{t("projects.createForm.name")}</FieldLabel>
            <Input id="project-name" disabled={!!createdProject.current} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-description">{t("projects.createForm.description")}</FieldLabel>
            <Textarea
              id="project-description"
              disabled={!!createdProject.current}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("projects.createForm.descriptionPlaceholder")}
              rows={4}
              className="min-h-24 w-full resize-y"
            />
          </Field>
          <ProjectWorkspaceField directory={workspace?.directory ?? null} choosing={choosingWorkspace} disabled={creating || !workspaceAvailable}
            reason={!workspaceAvailable ? t("projectWorkspace.desktopOnly") : undefined} error={workspaceError}
            onChoose={() => void chooseWorkspace()} onClear={() => { setWorkspace(null); setWorkspaceError(""); }} />
        </FieldGroup>
      </FieldSet>
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{"项目与生成结果保存在本机，可随时继续建模并导出文档。"}</p>
        <Button type="submit" disabled={creating || choosingWorkspace || !name.trim()} className="shrink-0">
          {creating && <Loader2 className="size-4 animate-spin" />}
          {t("projects.createForm.submit")}
        </Button>
      </div>
    </form>
  );
}
