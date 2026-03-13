/**
 * CollaborationPage — sidebar entry page with tabs:
 *   Notifications, Language, Timezone, Presence
 *
 * All data fetched via /api/modules/global-collab/* endpoints.
 * Requirements: 16.2, 16.5
 */
import { useState, useEffect, useCallback } from "react";
import { i18nInstance } from "./index.js";
import { resolveDisplayTimestamp, type DateFormat } from "../services/timezone.js";

const API = "/api/modules/global-collab";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserPreferences {
  timezone: string;
  locale: string;
  dateFormat: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId: string;
  readAt: string | null;
  createdAt: string;
}

interface PresenceEntry {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

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

// ─── Tab Components ─────────────────────────────────────────────────────────

function NotificationsTab({ prefs }: { prefs: UserPreferences | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = i18nInstance.t.bind(i18nInstance);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const query = unreadOnly ? "?unreadOnly=true" : "";
      const data = await apiFetch<Notification[]>(`/notifications${query}`);
      setNotifications(data);
    } catch {
      // silently handle — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
  };

  const markAllRead = async () => {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
  };

  const formatTime = (iso: string) => {
    if (!prefs) return iso;
    return resolveDisplayTimestamp(iso, prefs.timezone, prefs.dateFormat as DateFormat);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{t("notifications.title")}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            {t("notifications.unreadOnly")}
          </label>
          <button onClick={markAllRead} style={btnStyle}>
            {t("notifications.markAllRead")}
          </button>
        </div>
      </div>
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : notifications.length === 0 ? (
        <p style={{ color: "#888" }}>{t("notifications.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {notifications.map((n) => (
            <li
              key={n.id}
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #eee",
                background: n.readAt ? "transparent" : "#f0f7ff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontWeight: n.readAt ? "normal" : 600, marginBottom: 4 }}>
                  <span style={badgeStyle(n.type)}>{t(`notifications.types.${n.type}`, n.type)}</span>
                  {" "}{n.title}
                </div>
                {n.body && <div style={{ fontSize: 13, color: "#666" }}>{n.body}</div>}
                <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{formatTime(n.createdAt)}</div>
              </div>
              {!n.readAt && (
                <button onClick={() => markRead(n.id)} style={{ ...btnStyle, fontSize: 12 }}>
                  {t("notifications.markRead")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LanguageTab({ prefs, onSave }: { prefs: UserPreferences | null; onSave: (p: Partial<UserPreferences>) => Promise<void> }) {
  const [locale, setLocale] = useState(prefs?.locale ?? "en");
  const [saving, setSaving] = useState(false);
  const t = i18nInstance.t.bind(i18nInstance);

  useEffect(() => { if (prefs) setLocale(prefs.locale); }, [prefs]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ locale });
      i18nInstance.changeLanguage(locale);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3>{t("language.title")}</h3>
      <label style={{ display: "block", marginBottom: 8 }}>
        {t("language.select")}
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          style={{ ...selectStyle, marginLeft: 8 }}
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </label>
      <button onClick={save} disabled={saving} style={btnStyle}>
        {saving ? t("common.loading") : t("common.save")}
      </button>
    </div>
  );
}

function TimezoneTab({ prefs, onSave }: { prefs: UserPreferences | null; onSave: (p: Partial<UserPreferences>) => Promise<void> }) {
  const [timezone, setTimezone] = useState(prefs?.timezone ?? "UTC");
  const [dateFormat, setDateFormat] = useState(prefs?.dateFormat ?? "relative");
  const [saving, setSaving] = useState(false);
  const t = i18nInstance.t.bind(i18nInstance);

  useEffect(() => {
    if (prefs) {
      setTimezone(prefs.timezone);
      setDateFormat(prefs.dateFormat);
    }
  }, [prefs]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ timezone, dateFormat });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3>{t("timezone.title")}</h3>
      <label style={{ display: "block", marginBottom: 8 }}>
        {t("timezone.select")}
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{ ...selectStyle, marginLeft: 8 }}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        {t("timezone.dateFormat")}
        <select
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value)}
          style={{ ...selectStyle, marginLeft: 8 }}
        >
          <option value="relative">{t("timezone.dateFormats.relative")}</option>
          <option value="absolute">{t("timezone.dateFormats.absolute")}</option>
          <option value="both">{t("timezone.dateFormats.both")}</option>
        </select>
      </label>
      <button onClick={save} disabled={saving} style={btnStyle}>
        {saving ? t("common.loading") : t("common.save")}
      </button>
    </div>
  );
}

function PresenceTab({ prefs }: { prefs: UserPreferences | null }) {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const t = i18nInstance.t.bind(i18nInstance);

  useEffect(() => {
    apiFetch<PresenceEntry[]>("/presence")
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (iso: string) => {
    if (!prefs) return iso;
    return resolveDisplayTimestamp(iso, prefs.timezone, prefs.dateFormat as DateFormat);
  };

  const statusColor = (s: string) =>
    s === "online" ? "#22c55e" : s === "away" ? "#f59e0b" : "#94a3b8";

  return (
    <div>
      <h3>{t("presence.title")}</h3>
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "#888" }}>{t("presence.members", { count: 0 })}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map((e) => (
            <li
              key={e.userId}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #eee",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusColor(e.status),
                  display: "inline-block",
                }}
              />
              <span style={{ flex: 1 }}>{e.userId}</span>
              <span style={{ fontSize: 13, color: "#888" }}>
                {t(`presence.${e.status}`)}
              </span>
              <span style={{ fontSize: 12, color: "#aaa" }}>
                {formatTime(e.lastSeenAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #d1d5db",
  borderRadius: 4,
  fontSize: 13,
};

function badgeStyle(type: string): React.CSSProperties {
  const colors: Record<string, string> = {
    mention: "#3b82f6",
    assignment: "#8b5cf6",
    status_change: "#f59e0b",
    comment: "#6b7280",
    handoff_request: "#ef4444",
  };
  return {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 11,
    color: "#fff",
    background: colors[type] ?? "#6b7280",
  };
}

// ─── Main Page ──────────────────────────────────────────────────────────────

type TabKey = "notifications" | "language" | "timezone" | "presence";

export function CollaborationPage() {
  const [tab, setTab] = useState<TabKey>("notifications");
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const t = i18nInstance.t.bind(i18nInstance);

  useEffect(() => {
    apiFetch<UserPreferences>("/preferences").then(setPrefs).catch(() => {});
  }, []);

  const savePrefs = async (patch: Partial<UserPreferences>) => {
    const updated = await apiFetch<UserPreferences>("/preferences", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    setPrefs(updated);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "notifications", label: t("collaboration.tabs.notifications") },
    { key: "language", label: t("collaboration.tabs.language") },
    { key: "timezone", label: t("collaboration.tabs.timezone") },
    { key: "presence", label: t("collaboration.tabs.presence") },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>{t("collaboration.title")}</h2>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: tab === tb.key ? "2px solid #3b82f6" : "2px solid transparent",
              background: "transparent",
              cursor: "pointer",
              fontWeight: tab === tb.key ? 600 : 400,
              color: tab === tb.key ? "#3b82f6" : "#6b7280",
              fontSize: 14,
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>
      {tab === "notifications" && <NotificationsTab prefs={prefs} />}
      {tab === "language" && <LanguageTab prefs={prefs} onSave={savePrefs} />}
      {tab === "timezone" && <TimezoneTab prefs={prefs} onSave={savePrefs} />}
      {tab === "presence" && <PresenceTab prefs={prefs} />}
    </div>
  );
}

export default CollaborationPage;
