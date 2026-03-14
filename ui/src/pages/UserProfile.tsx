import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Check, Lock } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { usersApi, type UserUpdateInput } from "../api/users";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Field } from "../components/agent-config-primitives";

const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文（简体）" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt-BR", label: "Português (Brasil)" },
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Copenhagen",
  "Europe/Zurich",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Manila",
  "Asia/Ho_Chi_Minh",
  "Asia/Kuala_Lumpur",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Honolulu",
];

export function UserProfile() {
  const { t, i18n } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en");
  const [dateFormat, setDateFormat] = useState("relative");
  const [dirty, setDirty] = useState(false);

  // Password state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });

  const userId = sessionQuery.data?.user?.id ?? sessionQuery.data?.session?.userId ?? null;

  const userQuery = useQuery({
    queryKey: queryKeys.users.me,
    queryFn: () => usersApi.getCurrentUser(),
    enabled: !!userId,
  });

  const user = userQuery.data;

  // Sync local state from user data
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setTimezone(user.timezone ?? "UTC");
    setLocale(user.locale ?? "en");
    setDateFormat(user.dateFormat ?? "relative");
    setDirty(false);
  }, [user]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("profile.title") }]);
  }, [setBreadcrumbs, t]);

  const updateMutation = useMutation({
    mutationFn: (data: UserUpdateInput) => usersApi.updateCurrentUser(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(queryKeys.users.me, updatedUser);
      // Update i18n locale if changed
      if (updatedUser.locale && updatedUser.locale !== i18n.language) {
        i18n.changeLanguage(updatedUser.locale);
        localStorage.setItem("Jigong.locale", updatedUser.locale);
      }
      // Update timezone in localStorage
      if (updatedUser.timezone) {
        localStorage.setItem("Jigong.timezone", updatedUser.timezone);
      }
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      usersApi.updatePassword({
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: Error) => {
      setPasswordError(error.message);
    },
  });

  const handleSaveProfile = () => {
    updateMutation.mutate({
      name: name.trim() || undefined,
      timezone,
      locale,
      dateFormat,
    });
  };

  const handleFieldChange = (
    field: "name" | "timezone" | "locale" | "dateFormat",
    value: string
  ) => {
    setDirty(true);
    switch (field) {
      case "name":
        setName(value);
        break;
      case "timezone":
        setTimezone(value);
        break;
      case "locale":
        setLocale(value);
        break;
      case "dateFormat":
        setDateFormat(value);
        break;
    }
  };

  const handleUpdatePassword = () => {
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError(t("profile.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }

    passwordMutation.mutate();
  };

  if (userQuery.isLoading || sessionQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-sm text-muted-foreground">
        {t("profile.notFound")}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t("profile.title")}</h1>
      </div>

      {/* Personal Information Section */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("profile.information")}
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label={t("profile.name")}>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder={t("profile.namePlaceholder")}
            />
          </Field>
          <Field label={t("profile.email")}>
            <input
              className="w-full rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm outline-none cursor-not-allowed"
              type="email"
              value={user.email}
              disabled
            />
          </Field>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("profile.preferences")}
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label={t("profile.timezone")} hint={t("profile.timezoneHint")}>
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={timezone}
              onChange={(e) => handleFieldChange("timezone", e.target.value)}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("profile.language")} hint={t("profile.languageHint")}>
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={locale}
              onChange={(e) => handleFieldChange("locale", e.target.value)}
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("profile.dateFormat")} hint={t("profile.dateFormatHint")}>
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={dateFormat}
              onChange={(e) => handleFieldChange("dateFormat", e.target.value)}
            >
              <option value="relative">{t("profile.dateFormats.relative")}</option>
              <option value="absolute">{t("profile.dateFormats.absolute")}</option>
              <option value="both">{t("profile.dateFormats.both")}</option>
            </select>
          </Field>
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t("profile.saving") : t("profile.save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (user) {
                  setName(user.name ?? "");
                  setTimezone(user.timezone ?? "UTC");
                  setLocale(user.locale ?? "en");
                  setDateFormat(user.dateFormat ?? "relative");
                  setDirty(false);
                }
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        )}
        <div className="h-5 flex items-center">
          {updateMutation.isPending && (
            <span className="text-xs text-muted-foreground">{t("profile.saving")}</span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> {t("profile.saved")}
            </span>
          )}
          {updateMutation.isError && (
            <span className="text-xs text-destructive">
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : t("profile.failedSave")}
            </span>
          )}
        </div>
      </div>

      {/* Password Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("profile.changePassword")}
          </div>
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label={t("profile.currentPassword")}>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t("profile.currentPasswordPlaceholder")}
            />
          </Field>
          <Field label={t("profile.newPassword")}>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("profile.newPasswordPlaceholder")}
            />
          </Field>
          <Field label={t("profile.confirmPassword")}>
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("profile.confirmPasswordPlaceholder")}
            />
          </Field>
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleUpdatePassword}
              disabled={
                passwordMutation.isPending ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
            >
              {passwordMutation.isPending
                ? t("profile.updatingPassword")
                : t("profile.updatePassword")}
            </Button>
          </div>
          <div className="h-5 flex items-center">
            {passwordSuccess && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" /> {t("profile.passwordUpdated")}
              </span>
            )}
            {passwordError && (
              <span className="text-xs text-destructive">{passwordError}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
