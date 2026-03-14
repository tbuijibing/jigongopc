import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { deriveAgentUrlKey, deriveProjectUrlKey } from "@Jigongai/shared";
import { i18n } from "@/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get the user's preferred timezone.
 * Checks localStorage first (set by UserPreferencesSection), then falls back to browser timezone.
 */
export function getUserTimezone(): string {
  try {
    const stored = localStorage.getItem("Jigong.timezone");
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Format a date using the user's locale and timezone.
 * Uses i18n for localization.
 */
export function formatDate(date: Date | string, timezone?: string): string {
  const d = new Date(date);
  const tz = timezone || getUserTimezone();
  const locale = i18n.language || "en";

  return d.toLocaleDateString(locale, {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date and time using the user's locale and timezone.
 * Uses i18n for localization.
 */
export function formatDateTime(date: Date | string, timezone?: string): string {
  const d = new Date(date);
  const tz = timezone || getUserTimezone();
  const locale = i18n.language || "en";

  return d.toLocaleString(locale, {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a date in short format (month and day only).
 * Uses i18n for localization.
 */
export function formatShortDate(date: Date | string, timezone?: string): string {
  const d = new Date(date);
  const tz = timezone || getUserTimezone();
  const locale = i18n.language || "en";

  return d.toLocaleDateString(locale, {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns a relative time string (e.g., "2 hours ago", "just now").
 * Uses i18n for translations.
 */
export function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.round((now - then) / 1000);

  const t = i18n.getResourceBundle(i18n.language, "translation")?.time || {};

  if (diffSec < 60) {
    return t.justNow || "just now";
  }

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return (t.minutesAgo || "{{count}}m ago").replace("{{count}}", String(diffMin));
  }

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return (t.hoursAgo || "{{count}}h ago").replace("{{count}}", String(diffHr));
  }

  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) {
    return (t.daysAgo || "{{count}}d ago").replace("{{count}}", String(diffDay));
  }

  // For older dates, show the formatted date
  return formatDate(date);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Build an issue URL using the human-readable identifier when available. */
export function issueUrl(issue: { id: string; identifier?: string | null }): string {
  return `/issues/${issue.identifier ?? issue.id}`;
}

/** Build an agent route URL using the short URL key when available. */
export function agentRouteRef(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return agent.urlKey ?? deriveAgentUrlKey(agent.name, agent.id);
}

/** Build an agent URL using the short URL key when available. */
export function agentUrl(agent: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/agents/${agentRouteRef(agent)}`;
}

/** Build a project route reference using the short URL key when available. */
export function projectRouteRef(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return project.urlKey ?? deriveProjectUrlKey(project.name, project.id);
}

/** Build a project URL using the short URL key when available. */
export function projectUrl(project: { id: string; urlKey?: string | null; name?: string | null }): string {
  return `/projects/${projectRouteRef(project)}`;
}
