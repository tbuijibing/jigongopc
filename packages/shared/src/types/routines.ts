export interface Routine {
  id: string;
  companyId: string;
  projectId: string;
  goalId: string | null;
  parentIssueId: string | null;
  title: string;
  description: string | null;
  assigneeAgentId: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "active" | "paused" | "completed" | "archived";
  concurrencyPolicy: "coalesce_if_active" | "allow_multiple" | "skip_if_active";
  catchUpPolicy: "skip_missed" | "run_all_missed" | "run_latest_only";
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  lastTriggeredAt: string | null;
  lastEnqueuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineTrigger {
  id: string;
  companyId: string;
  routineId: string;
  kind: "cron" | "webhook" | "event";
  label: string | null;
  enabled: boolean;
  cronExpression: string | null;
  timezone: string | null;
  nextRunAt: string | null;
  lastFiredAt: string | null;
  publicId: string | null;
  secretId: string | null;
  signingMode: string | null;
  replayWindowSec: number | null;
  lastRotatedAt: string | null;
  lastResult: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineRun {
  id: string;
  companyId: string;
  routineId: string;
  triggerId: string | null;
  source: "cron" | "webhook" | "manual" | "event";
  status: "received" | "queued" | "running" | "completed" | "failed" | "coalesced";
  triggeredAt: string;
  idempotencyKey: string | null;
  triggerPayload: Record<string, unknown> | null;
  linkedIssueId: string | null;
  coalescedIntoRunId: string | null;
  failureReason: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface RoutineDetail extends Routine {
  triggers: RoutineTrigger[];
  runs: RoutineRun[];
}
