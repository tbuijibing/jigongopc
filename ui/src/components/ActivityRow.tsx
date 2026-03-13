import { useTranslation } from "react-i18next";
import { Link } from "@/lib/router";
import { Identity } from "./Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { deriveProjectUrlKey, type ActivityEvent, type Agent } from "@Jigongai/shared";

const ACTION_VERB_KEYS: Record<string, string> = {
  "issue.created": "activity.verbs.issueCreated",
  "issue.updated": "activity.verbs.issueUpdated",
  "issue.checked_out": "activity.verbs.issueCheckedOut",
  "issue.released": "activity.verbs.issueReleased",
  "issue.comment_added": "activity.verbs.issueCommentAdded",
  "issue.attachment_added": "activity.verbs.issueAttachmentAdded",
  "issue.attachment_removed": "activity.verbs.issueAttachmentRemoved",
  "issue.commented": "activity.verbs.issueCommented",
  "issue.deleted": "activity.verbs.issueDeleted",
  "agent.created": "activity.verbs.agentCreated",
  "agent.updated": "activity.verbs.agentUpdated",
  "agent.paused": "activity.verbs.agentPaused",
  "agent.resumed": "activity.verbs.agentResumed",
  "agent.terminated": "activity.verbs.agentTerminated",
  "agent.key_created": "activity.verbs.agentKeyCreated",
  "agent.budget_updated": "activity.verbs.agentBudgetUpdated",
  "agent.runtime_session_reset": "activity.verbs.agentSessionReset",
  "heartbeat.invoked": "activity.verbs.heartbeatInvoked",
  "heartbeat.cancelled": "activity.verbs.heartbeatCancelled",
  "approval.created": "activity.verbs.approvalCreated",
  "approval.approved": "activity.verbs.approvalApproved",
  "approval.rejected": "activity.verbs.approvalRejected",
  "project.created": "activity.verbs.projectCreated",
  "project.updated": "activity.verbs.projectUpdated",
  "project.deleted": "activity.verbs.projectDeleted",
  "goal.created": "activity.verbs.goalCreated",
  "goal.updated": "activity.verbs.goalUpdated",
  "goal.deleted": "activity.verbs.goalDeleted",
  "cost.reported": "activity.verbs.costReported",
  "cost.recorded": "activity.verbs.costRecorded",
  "company.created": "activity.verbs.companyCreated",
  "company.updated": "activity.verbs.companyUpdated",
  "company.archived": "activity.verbs.companyArchived",
  "company.budget_updated": "activity.verbs.companyBudgetUpdated",
};

function humanizeValue(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "none");
  return value.replace(/_/g, " ");
}

function useFormatVerb() {
  const { t } = useTranslation();

  return (action: string, details?: Record<string, unknown> | null): string => {
    if (action === "issue.updated" && details) {
      const previous = (details._previous ?? {}) as Record<string, unknown>;
      if (details.status !== undefined) {
        const from = previous.status;
        return from
          ? t("activity.verbs.changedStatusFromTo", { from: humanizeValue(from), to: humanizeValue(details.status) })
          : t("activity.verbs.changedStatusTo", { to: humanizeValue(details.status) });
      }
      if (details.priority !== undefined) {
        const from = previous.priority;
        return from
          ? t("activity.verbs.changedPriorityFromTo", { from: humanizeValue(from), to: humanizeValue(details.priority) })
          : t("activity.verbs.changedPriorityTo", { to: humanizeValue(details.priority) });
      }
    }
    const key = ACTION_VERB_KEYS[action];
    return key ? t(key) : action.replace(/[._]/g, " ");
  };
}

function entityLink(entityType: string, entityId: string, name?: string | null): string | null {
  switch (entityType) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlKey(name, entityId)}`;
    case "goal": return `/goals/${entityId}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

interface ActivityRowProps {
  event: ActivityEvent;
  agentMap: Map<string, Agent>;
  entityNameMap: Map<string, string>;
  entityTitleMap?: Map<string, string>;
  className?: string;
}

export function ActivityRow({ event, agentMap, entityNameMap, entityTitleMap, className }: ActivityRowProps) {
  const { t } = useTranslation();
  const formatVerb = useFormatVerb();
  const verb = formatVerb(event.action, event.details);

  const isHeartbeatEvent = event.entityType === "heartbeat_run";
  const heartbeatAgentId = isHeartbeatEvent
    ? (event.details as Record<string, unknown> | null)?.agentId as string | undefined
    : undefined;

  const name = isHeartbeatEvent
    ? (heartbeatAgentId ? entityNameMap.get(`agent:${heartbeatAgentId}`) : null)
    : entityNameMap.get(`${event.entityType}:${event.entityId}`);

  const entityTitle = entityTitleMap?.get(`${event.entityType}:${event.entityId}`);

  const link = isHeartbeatEvent && heartbeatAgentId
    ? `/agents/${heartbeatAgentId}/runs/${event.entityId}`
    : entityLink(event.entityType, event.entityId, name);

  const actor = event.actorType === "agent" ? agentMap.get(event.actorId) : null;
  const actorName = actor?.name ?? (event.actorType === "system" ? t("activity.actors.system") : event.actorType === "user" ? t("activity.actors.board") : event.actorId || t("activity.actors.unknown"));

  const inner = (
    <div className="flex gap-3">
      <p className="flex-1 min-w-0 truncate">
        <Identity
          name={actorName}
          size="xs"
          className="align-baseline"
        />
        <span className="text-muted-foreground ml-1">{verb} </span>
        {name && <span className="font-medium">{name}</span>}
        {entityTitle && <span className="text-muted-foreground ml-1">— {entityTitle}</span>}
      </p>
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{timeAgo(event.createdAt)}</span>
    </div>
  );

  const classes = cn(
    "px-4 py-2 text-sm",
    link && "cursor-pointer hover:bg-accent/50 transition-colors",
    className,
  );

  if (link) {
    return (
      <Link to={link} className={cn(classes, "no-underline text-inherit block")}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes}>
      {inner}
    </div>
  );
}
