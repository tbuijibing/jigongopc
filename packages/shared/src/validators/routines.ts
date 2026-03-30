import { z } from "zod";

export const createRoutineSchema = z.object({
  projectId: z.string().uuid(),
  goalId: z.string().uuid().optional().nullable(),
  parentIssueId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assigneeAgentId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  concurrencyPolicy: z.enum(["coalesce_if_active", "allow_multiple", "skip_if_active"]).default("coalesce_if_active"),
  catchUpPolicy: z.enum(["skip_missed", "run_all_missed", "run_latest_only"]).default("skip_missed"),
});

export const updateRoutineSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  assigneeAgentId: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  concurrencyPolicy: z.enum(["coalesce_if_active", "allow_multiple", "skip_if_active"]).optional(),
  catchUpPolicy: z.enum(["skip_missed", "run_all_missed", "run_latest_only"]).optional(),
});

export const createRoutineTriggerSchema = z.object({
  routineId: z.string().uuid(),
  kind: z.enum(["cron", "webhook", "event"]),
  label: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  cronExpression: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
});

export const updateRoutineTriggerSchema = z.object({
  label: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  cronExpression: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
});

export const rotateRoutineTriggerSecretSchema = z.object({
  triggerId: z.string().uuid(),
});

export const runRoutineSchema = z.object({
  routineId: z.string().uuid(),
  payload: z.record(z.unknown()).optional().nullable(),
});
