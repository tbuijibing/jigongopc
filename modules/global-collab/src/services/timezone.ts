import { formatInTimeZone } from "date-fns-tz";
import { formatDistance, formatDistanceToNow } from "date-fns";

export type DateFormat = "relative" | "absolute" | "both";

/**
 * Convert a UTC ISO timestamp to a display string based on user preferences.
 * Pure function — no side effects.
 *
 * @param utcIsoString - Valid ISO 8601 UTC time string
 * @param timezone - Valid IANA timezone identifier (e.g., "Asia/Shanghai")
 * @param dateFormat - One of "relative", "absolute", "both"
 * @param now - Optional reference time for relative calculations (for testing)
 * @returns Formatted display string
 */
export function resolveDisplayTimestamp(
  utcIsoString: string,
  timezone: string,
  dateFormat: DateFormat,
  now?: Date,
): string {
  const date = new Date(utcIsoString);

  if (dateFormat === "relative") {
    return relativeTime(date, now);
  }

  if (dateFormat === "absolute") {
    return formatInTimeZone(date, timezone, "yyyy-MM-dd HH:mm zzz");
  }

  // "both"
  const relative = relativeTime(date, now);
  const absolute = formatInTimeZone(date, timezone, "yyyy-MM-dd HH:mm zzz");
  return `${relative} (${absolute})`;
}

function relativeTime(date: Date, now?: Date): string {
  if (now) {
    return formatDistance(date, now, { addSuffix: true });
  }
  return formatDistanceToNow(date, { addSuffix: true });
}
