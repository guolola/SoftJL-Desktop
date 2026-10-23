// Shares the native folder field between project creation and existing project settings.
import { FolderOpen, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../shared/ui/button.js";
import { Input } from "../../../shared/ui/input.js";
import { Field, FieldLabel } from "../../../shared/ui/field.js";

export function ProjectWorkspaceField({ directory, choosing, disabled, reason, error, onChoose, onClear }: {
  directory: string | null; choosing: boolean; disabled?: boolean; reason?: string; error?: string;
  onChoose: () => void; onClear?: () => void;
}) {
  const { t } = useTranslation();
  return <Field>
    <FieldLabel htmlFor="project-workspace-directory">{t("projectWorkspace.title")}</FieldLabel>
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Input id="project-workspace-directory" className="min-w-0 flex-1 basis-48" readOnly value={directory ?? ""} placeholder={t("projectWorkspace.unselected")} title={directory ?? ""} />
      <Button type="button" variant="outline" disabled={disabled || choosing} onClick={onChoose}>
        {choosing ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}{t(directory ? "projectWorkspace.change" : "projectWorkspace.choose")}
      </Button>
      {directory && onClear && <Button type="button" variant="ghost" disabled={disabled || choosing} onClick={onClear}>{t("projectWorkspace.clear")}</Button>}
    </div>
    <p className="text-xs text-muted-foreground">{t("projectWorkspace.hint")}</p>
    {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </Field>;
}
