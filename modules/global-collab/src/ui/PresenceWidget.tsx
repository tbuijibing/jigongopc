/**
 * PresenceWidget — dashboard widget showing online/offline member counts and status list.
 * Data from /api/modules/global-collab/presence
 *
 * Requirements: 16.3, 16.5
 */
import { useState, useEffect } from "react";
import { i18nInstance } from "./index.js";
import { resolveDisplayTimestamp, type DateFormat } from "../services/timezone.js";

const API = "/api/modules/global-collab";

interface PresenceEntry {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: string;
}

interface UserPreferences {
  timezone: string;
  locale: string;
  dateFormat: string;
}

export function PresenceWidget() {
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const t = i18nInstance.t.bind(i18nInstance);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/presence`, { headers: { "Content-Type": "application/json" } })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch(`${API}/preferences`, { headers: { "Content-Type": "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([presenceData, prefsData]) => {
      setEntries(presenceData as PresenceEntry[]);
      setPrefs(prefsData as UserPreferences | null);
      setLoading(false);
    });
  }, []);

  const online = entries.filter((e) => e.status === "online");
  const away = entries.filter((e) => e.status === "away");
  const offline = entries.filter((e) => e.status === "offline");

  const statusColor = (s: string) =>
    s === "online" ? "#22c55e" : s === "away" ? "#f59e0b" : "#94a3b8";

  const formatTime = (iso: string) => {
    if (!prefs) return iso;
    return resolveDisplayTimestamp(iso, prefs.timezone, prefs.dateFormat as DateFormat);
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
      <h4 style={{ margin: "0 0 12px 0" }}>{t("presence.widget.title")}</h4>
      {loading ? (
        <p style={{ color: "#888", fontSize: 13 }}>{t("common.loading")}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: "#22c55e" }}>● {t("presence.widget.onlineCount", { count: online.length })}</span>
            <span style={{ color: "#f59e0b" }}>● {t("presence.widget.awayCount", { count: away.length })}</span>
            <span style={{ color: "#94a3b8" }}>● {t("presence.widget.offlineCount", { count: offline.length })}</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 200, overflowY: "auto" }}>
            {entries.map((e) => (
              <li
                key={e.userId}
                style={{
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: statusColor(e.status),
                    display: "inline-block",
                  }}
                />
                <span style={{ flex: 1 }}>{e.userId}</span>
                <span style={{ color: "#aaa", fontSize: 12 }}>{formatTime(e.lastSeenAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default PresenceWidget;
