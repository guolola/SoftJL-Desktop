// Edits the local user's display name and avatar through the existing profile contracts.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CHARACTER_AVATARS, accountProfileUpdateRequestSchema } from "../../../../../shared/contracts/index.js";
import { Avatar, AvatarFallback, AvatarImage } from "../../../shared/ui/avatar.js";
import { Button } from "../../../shared/ui/button.js";
import { Input } from "../../../shared/ui/input.js";
import { Label } from "../../../shared/ui/label.js";
import { floatingAlert } from "../../../shared/ui/floating-alert.js";
import type { GlobalSettingsActions } from "../../settings/components/global-settings-panel.js";
import { platformApi, type PlatformUser } from "../services/platform-api.js";
import { useAuthenticatedRouteUserUpdate } from "./authenticated-route-session.js";

type Props = {
  user: PlatformUser;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
};
const fields = (user: PlatformUser) => ({ displayName: user.displayName, avatarUrl: user.avatarUrl ?? null });

export const ProfilePreferencesPanel = forwardRef<GlobalSettingsActions, Props>(function ProfilePreferencesPanel({ user, onDirtyChange, onBusyChange }, ref) {
  const { t, i18n } = useTranslation();
  const updateUser = useAuthenticatedRouteUserUpdate();
  const [saved, setSaved] = useState(user);
  const [draft, setDraft] = useState(() => fields(user));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  const saving = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = draft.displayName !== saved.displayName || draft.avatarUrl !== (saved.avatarUrl ?? null) || !!file;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!file) { setPreview(undefined); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const save = async () => {
    if (saving.current) return;
    const input = accountProfileUpdateRequestSchema.safeParse({ displayName: draft.displayName });
    if (!input.success) { setError(t("account.displayNamePlaceholder")); return; }
    saving.current = true;
    onBusyChange(true);
    setError("");
    try {
      if (file) {
        const uploaded = await platformApi.uploadAccountAvatar(file);
        // Upload persists its URL. Retain that success even if the following name update fails.
        setSaved(uploaded.user);
        setDraft(current => ({ ...current, avatarUrl: uploaded.user.avatarUrl ?? null }));
        setFile(null);
        updateUser?.(uploaded.user);
      }
      const response = await platformApi.updateAccountProfile({
        displayName: input.data.displayName!,
        // Uploaded local URLs are server-owned and must not be resubmitted as external avatar URLs.
        ...(!file && draft.avatarUrl !== (saved.avatarUrl ?? null) ? { avatarUrl: draft.avatarUrl } : {}),
      });
      setSaved(response.user);
      setDraft(fields(response.user));
      updateUser?.(response.user);
      floatingAlert.success(t("account.profileSaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("account.profileSaveFailed"));
    } finally {
      saving.current = false;
      onBusyChange(false);
    }
  };
  useImperativeHandle(ref, () => ({ save: () => { void save(); }, reset: () => {
    if (saving.current) return;
    setDraft(fields(saved)); setFile(null); setError("");
  } }));

  return <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Avatar className="size-20 rounded-xl">
        <AvatarImage src={preview ?? draft.avatarUrl ?? "/avatars/chiikawa-shy.gif"} alt={t("account.avatarAria")} />
        <AvatarFallback>{draft.displayName.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <Button variant="outline" disabled={saving.current} onClick={() => fileInput.current?.click()}>{t("account.changeAvatar")}</Button>
        <p className="text-xs text-muted-foreground">{t("account.avatarHint")}</p>
        {file && <p className="text-xs">{t("account.avatarSelected", { name: file.name })}</p>}
      </div>
      <input ref={fileInput} type="file" className="sr-only" disabled={saving.current} aria-label={t("account.changeAvatar")}
        accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (!selected) return;
          if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(selected.type)) { setError(t("account.avatarTypeError")); return; }
          if (selected.size > 2 * 1024 * 1024) { setError(t("account.avatarSizeError")); return; }
          setFile(selected); setError("");
        }} />
    </div>
    <fieldset disabled={saving.current} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="profile-display-name">{t("account.displayName")}</Label>
        <Input id="profile-display-name" maxLength={120} required value={draft.displayName}
          placeholder={t("account.displayNamePlaceholder")} onChange={event => setDraft(current => ({ ...current, displayName: event.target.value }))} /></div>
      <div className="space-y-2"><Label htmlFor="profile-username">{t("account.username")}</Label>
        <Input id="profile-username" value={saved.username} readOnly /></div>
      <div className="space-y-2"><p className="text-sm font-medium">{t("account.defaultAvatars")}</p>
        <p className="text-xs text-muted-foreground">{t("account.defaultAvatarsHint")}</p>
        <div className="flex flex-wrap gap-2">{CHARACTER_AVATARS.map(avatar => {
          const name = i18n.language.startsWith("zh") ? avatar.zh : avatar.en;
          return <Button key={avatar.url} variant="outline" size="icon" className="size-14 p-1 aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/30" aria-label={name}
            aria-pressed={!file && draft.avatarUrl === avatar.url} onClick={() => { setFile(null); setDraft(current => ({ ...current, avatarUrl: avatar.url })); }}>
            <img src={avatar.url} alt="" className="size-full object-contain" />
          </Button>;
        })}</div>
      </div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
});
