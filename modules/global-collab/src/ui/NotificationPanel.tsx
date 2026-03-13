/**
 * UnreadNotificationsWidget — dashboard widget showing unread notification count
 * and recent notification summary.
 * Data from /api/modules/global-collab/notifications
 *
 * Requirements: 16.4, 16.5
 */
import { useState, useEffect } from "react";
import { i18nInstance } from "./index.js";
import { resolveDisplayTimestamp, type DateFormat } from "../services/timezone.js";

const API = "/api/modules/global-collab";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

interface UserPreferences {
  timezone: string;
  locale: string;
  dateFormat: string;
}

export function UnreadNotificationsWidget() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const t = i18nInstance.t.bind(i18nInstance);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/notifications/unread-count`, { headers: { "Content-Type": "application/json" } })
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .catch(() => ({ count: 0 })),
      fetch(`${API}/notifications?unreadOnly=true`, { headers: { "Content-Type": "application/json" } })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API}/preferences`, { headers: { "Content-Type": "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([countData, notifData, prefsData]) => {
      setUnreadCount((countData as { count: number }).count);
      // Show at most 5 recent unread notifications
      setRecent((notifData as Notification[]).slice(0, 5));
      setPrefs(prefsData as UserPreferences | null);
      setLoading(false);
    });
  }, []);

  const formatTime = (iso: string) => {
    if (!prefs) return iso;
    return resolveDisplayTimestamp(iso, prefs.timezone, prefs.dateFormat as DateFormat);
  };

  const typeBadgeColor: Record<string, string> = {
    mention: "#3b82f6",
    assignment: "#8b5cf6",
    status_change: "#f59e0b",
    comment: "#6b7280",
    handoff_request: "#ef4444",
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}>{t("notifications.widget.title")}</h4>
        {unreadCount > 0 && (
          <span
            style={{
              background: "#ef4444",
              color: "#fff",
              borderRadius: 10,
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>
      {loading ? (
        <p style={{ color: "#888", fontSize: 13 }}>{t("common.loading")}</p>
      ) : recent.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13 }}>{t("notifications.widget.noUnread")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {recent.map((n) => (
            <li key={n.id} style={{ padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "1px 5px",
                    borderRadius: 3,
                    fontSize: 10,
                    color: "#fff",
                    background: typeBadgeColor[n.type] ?? "#6b7280",
                  }}
                >
                  {t(`notifications.types.${n.type}`, n.type)}
                </span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.title}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{formatTime(n.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default UnreadNotificationsWidget;
