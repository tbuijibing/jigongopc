import { ApiError } from "./client";

const MODULE_BASE = "/api/modules/global-collab";

export interface UserPreferences {
  timezone: string;
  locale: string;
  dateFormat: string;
}

export interface Notification {
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

export interface PresenceEntry {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: string;
}

export interface DictionaryEntry {
  category: string;
  key: string;
  locale: string;
  label: string;
}

async function moduleRequest<T>(
  path: string,
  userId: string,
  companyId: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  headers.set("x-user-id", userId);
  headers.set("x-company-id", companyId);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${MODULE_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      (body as { error?: string } | null)?.error ?? `Request failed: ${res.status}`,
      res.status,
      body,
    );
  }
  return res.json();
}

export const collaborationApi = {
  // Preferences
  getPreferences: (userId: string, companyId: string) =>
    moduleRequest<UserPreferences>("/preferences", userId, companyId),

  updatePreferences: (userId: string, companyId: string, patch: Partial<UserPreferences>) =>
    moduleRequest<UserPreferences>("/preferences", userId, companyId, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // Notifications
  listNotifications: (userId: string, companyId: string, unreadOnly = false) =>
    moduleRequest<Notification[]>(
      `/notifications${unreadOnly ? "?unreadOnly=true" : ""}`,
      userId,
      companyId,
    ),

  getUnreadCount: (userId: string, companyId: string) =>
    moduleRequest<{ count: number }>("/notifications/unread-count", userId, companyId),

  markNotificationRead: (userId: string, companyId: string, notificationId: string) =>
    moduleRequest<{ ok: boolean }>(`/notifications/${notificationId}/read`, userId, companyId, {
      method: "PUT",
    }),

  markAllNotificationsRead: (userId: string, companyId: string) =>
    moduleRequest<{ ok: boolean }>("/notifications/read-all", userId, companyId, {
      method: "PUT",
    }),

  // Presence
  getPresence: (userId: string, companyId: string) =>
    moduleRequest<PresenceEntry[]>("/presence", userId, companyId),

  sendHeartbeat: (userId: string, companyId: string) =>
    moduleRequest<{ ok: boolean }>("/presence/heartbeat", userId, companyId, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  // Dictionaries
  getDictionaries: (userId: string, companyId: string, locale: string) =>
    moduleRequest<Record<string, Record<string, string>>>(`/dictionaries?locale=${encodeURIComponent(locale)}`, userId, companyId),

  getDictionaryCategory: (userId: string, companyId: string, category: string, locale: string) =>
    moduleRequest<Record<string, string>>(`/dictionaries/${encodeURIComponent(category)}?locale=${encodeURIComponent(locale)}`, userId, companyId),
};
