import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

const STATUS_KEYS: Record<string, string> = {
  backlog: "issues.status.backlog",
  todo: "issues.status.todo",
  in_progress: "issues.status.in_progress",
  in_review: "issues.status.in_review",
  done: "issues.status.done",
  planned: "projects.newDialog.status.planned",
  completed: "projects.newDialog.status.completed",
  cancelled: "projects.newDialog.status.cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const key = STATUS_KEYS[status];
  const label = key ? t(key) : status.replace("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {label}
    </span>
  );
}
