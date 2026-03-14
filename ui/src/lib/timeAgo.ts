import { i18n } from "@/i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/**
 * Returns a relative time string (e.g., "2h ago", "just now").
 * Uses i18n for translations based on the current language.
 */
export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);

  // Get translation bundle for current language
  const t = i18n.getResourceBundle(i18n.language, "translation")?.time || {};

  if (seconds < MINUTE) {
    return t.justNow || "just now";
  }

  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return (t.minutesAgo || "{{count}}m ago").replace("{{count}}", String(m));
  }

  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return (t.hoursAgo || "{{count}}h ago").replace("{{count}}", String(h));
  }

  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return (t.daysAgo || "{{count}}d ago").replace("{{count}}", String(d));
  }

  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return (t.weeksAgo || "{{count}}w ago").replace("{{count}}", String(w));
  }

  const mo = Math.floor(seconds / MONTH);
  return (t.monthsAgo || "{{count}}mo ago").replace("{{count}}", String(mo));
}
