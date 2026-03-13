import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { authApi } from "../api/auth";
import { collaborationApi, type Notification, type PresenceEntry } from "../api/collaboration";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Globe, Bell, Users, Clock, Check, Languages } from "lucide-react";
import { cn } from "../lib/utils";
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
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

type TabKey = "notifications" | "preferences" | "presence" | "dictionaries";

function useCollabContext() {
  const { selectedCompanyId } = useCompany();
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const userId = sessionQuery.data?.user?.id ?? sessionQuery.data?.session?.userId ?? null;
  return { userId, companyId: selectedCompanyId };
}

// ─── Notifications Tab ──────────────────────────────────────────────────────

function NotificationsTab() {
  const { userId, companyId } = useCollabContext();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: [...queryKeys.collaboration.notifications(companyId!), unreadOnly],
    queryFn: () => collaborationApi.listNotifications(userId!, companyId!, unreadOnly),
    enabled: !!userId && !!companyId,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      collaborationApi.markNotificationRead(userId!, companyId!, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collaboration.notifications(companyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collaboration.unreadCount(companyId!) });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => collaborationApi.markAllNotificationsRead(userId!, companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collaboration.notifications(companyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collaboration.unreadCount(companyId!) });
    },
  });

  const notifications = notificationsQuery.data ?? [];

  const typeBadgeColor: Record<string, string> = {
    mention: "bg-blue-500",
    assignment: "bg-violet-500",
    status_change: "bg-amber-500",
    comment: "bg-gray-500",
    handoff_request: "bg-red-500",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded"
            />
            Unread only
          </label>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          Mark all read
        </Button>
      </div>

      {notificationsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications.</p>
      ) : (
        <div className="space-y-1">
          {notifications.map((n: Notification) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5",
                !n.readAt && "bg-accent/30"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                      typeBadgeColor[n.type] ?? "bg-gray-500"
                    )}
                  >
                    {n.type.replace(/_/g, " ")}
                  </span>
                  <span className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                )}
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.readAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-xs"
                  onClick={() => markReadMutation.mutate(n.id)}
                  disabled={markReadMutation.isPending}
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preferences Tab ────────────────────────────────────────────────────────

function PreferencesTab() {
  const { userId, companyId } = useCollabContext();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const prefsQuery = useQuery({
    queryKey: queryKeys.collaboration.preferences(companyId!),
    queryFn: () => collaborationApi.getPreferences(userId!, companyId!),
    enabled: !!userId && !!companyId,
  });

  const prefsMutation = useMutation({
    mutationFn: (patch: { timezone?: string; locale?: string; dateFormat?: string }) =>
      collaborationApi.updatePreferences(userId!, companyId!, patch),
    onMutate: async (patch) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.collaboration.preferences(companyId!) });
      const previous = queryClient.getQueryData(queryKeys.collaboration.preferences(companyId!));
      // Optimistically update the cache so the dropdown reflects the change immediately
      queryClient.setQueryData(queryKeys.collaboration.preferences(companyId!), (old: any) => ({
        timezone: "UTC",
        locale: "en",
        dateFormat: "relative",
        ...old,
        ...patch,
      }));
      return { previous };
    },
    onError: (_err, _patch, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.collaboration.preferences(companyId!), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collaboration.preferences(companyId!) });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const save = useCallback(
    (patch: { timezone?: string; locale?: string; dateFormat?: string }) => {
      if (userId && companyId) prefsMutation.mutate(patch);
    },
    [userId, companyId, prefsMutation],
  );

  const prefs = prefsQuery.data;

  if (prefsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border px-4 py-4">
        <Field label="Timezone" hint="Your preferred timezone for displaying dates and times.">
          <select
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={prefs?.timezone ?? "UTC"}
            onChange={(e) => save({ timezone: e.target.value })}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
        <Field label="Language" hint="Your preferred display language.">
          <select
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={prefs?.locale ?? "en"}
            onChange={(e) => save({ locale: e.target.value })}
          >
            {SUPPORTED_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Date format" hint="How dates are displayed throughout the app.">
          <select
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={prefs?.dateFormat ?? "relative"}
            onChange={(e) => save({ dateFormat: e.target.value })}
          >
            <option value="relative">Relative (e.g. 2 hours ago)</option>
            <option value="absolute">Absolute (e.g. 2026-03-09 14:30)</option>
            <option value="both">Both</option>
          </select>
        </Field>
      </div>
      <div className="h-5 flex items-center">
        {prefsMutation.isPending && (
          <span className="text-xs text-muted-foreground">Saving...</span>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
        {prefsMutation.isError && (
          <span className="text-xs text-destructive">
            {prefsMutation.error instanceof Error
              ? prefsMutation.error.message
              : "Failed to save"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Presence Tab ───────────────────────────────────────────────────────────

function PresenceTab() {
  const { userId, companyId } = useCollabContext();

  // Send heartbeat on mount and every 20s
  const heartbeatFn = useCallback(() => {
    if (userId && companyId) {
      collaborationApi.sendHeartbeat(userId, companyId).catch(() => {});
    }
  }, [userId, companyId]);

  useEffect(() => {
    heartbeatFn();
    const timer = setInterval(heartbeatFn, 20_000);
    return () => clearInterval(timer);
  }, [heartbeatFn]);

  const presenceQuery = useQuery({
    queryKey: queryKeys.collaboration.presence(companyId!),
    queryFn: () => collaborationApi.getPresence(userId!, companyId!),
    enabled: !!userId && !!companyId,
    refetchInterval: 15_000,
  });

  const entries = presenceQuery.data ?? [];

  const statusColor = (s: string) =>
    s === "online" ? "bg-green-500" : s === "away" ? "bg-amber-500" : "bg-gray-400";

  const statusLabel = (s: string) =>
    s === "online" ? "Online" : s === "away" ? "Away" : "Offline";

  return (
    <div className="space-y-4">
      {presenceQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team members online.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e: PresenceEntry) => (
            <div
              key={e.userId}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", statusColor(e.status))} />
              <span className="flex-1 text-sm truncate">{e.userId}</span>
              <span className="text-xs text-muted-foreground">{statusLabel(e.status)}</span>
              <span className="text-[11px] text-muted-foreground/60">
                {new Date(e.lastSeenAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dictionaries Tab ───────────────────────────────────────────────────────

const DICTIONARY_CATEGORIES = [
  "issue_status",
  "issue_priority",
  "agent_status",
  "agent_role",
  "approval_status",
  "project_status",
  "goal_status",
  "cost_type",
  "activity_type",
  "notification_type",
  "presence_status",
  "date_format",
  "deployment_mode",
  "adapter_type",
  "run_status",
  "run_outcome",
];

function DictionariesTab() {
  const { userId, companyId } = useCollabContext();
  const [locale, setLocale] = useState("en");
  const [selectedCategory, setSelectedCategory] = useState(DICTIONARY_CATEGORIES[0]);

  const dictQuery = useQuery({
    queryKey: queryKeys.collaboration.dictionaries(companyId!, locale),
    queryFn: () => collaborationApi.getDictionaries(userId!, companyId!, locale),
    enabled: !!userId && !!companyId,
  });

  const allData = dictQuery.data ?? {};
  const categoryData = allData[selectedCategory] ?? {};
  const entries = Object.entries(categoryData);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Field label="Locale" hint="">
          <select
            className="w-40 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            {SUPPORTED_LOCALES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Category" hint="">
          <select
            className="w-48 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {DICTIONARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
      </div>

      {dictQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : dictQuery.isError ? (
        <p className="text-sm text-destructive">
          {dictQuery.error instanceof Error ? dictQuery.error.message : "Failed to load dictionaries"}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No translations for "{selectedCategory.replace(/_/g, " ")}" in {locale}. Seed data may not be loaded yet.
        </p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Key</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Label ({locale})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(([key, label]) => (
                <tr key={key}>
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{key}</td>
                  <td className="px-3 py-1.5">{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function Collaboration() {
  const { selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [tab, setTab] = useState<TabKey>("notifications");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Collaboration" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "notifications", label: "Notifications", icon: <Bell className="h-3.5 w-3.5" /> },
    { key: "preferences", label: "Preferences", icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "dictionaries", label: "Dictionaries", icon: <Languages className="h-3.5 w-3.5" /> },
    { key: "presence", label: "Presence", icon: <Users className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Collaboration</h1>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px",
              tab === t.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "notifications" && <NotificationsTab />}
      {tab === "preferences" && <PreferencesTab />}
      {tab === "dictionaries" && <DictionariesTab />}
      {tab === "presence" && <PresenceTab />}
    </div>
  );
}
