import type { Db } from "@jigongai/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { routines, routineTriggers, routineRuns, issues } from "@jigongai/db/schema";
import type { Routine, RoutineDetail, RoutineTrigger, RoutineRun } from "@jigongai/shared";

export function routineService(db: Db) {
  async function list(companyId: string): Promise<Routine[]> {
    const rows = await db
      .select()
      .from(routines)
      .where(eq(routines.companyId, companyId))
      .orderBy(desc(routines.createdAt));
    return rows.map(rowToRoutine);
  }

  async function get(routineId: string): Promise<Routine | null> {
    const rows = await db
      .select()
      .from(routines)
      .where(eq(routines.id, routineId));
    const row = rows[0] ?? null;
    return row ? rowToRoutine(row) : null;
  }

  async function getDetail(routineId: string): Promise<RoutineDetail | null> {
    const routineRow = await get(routineId);
    if (!routineRow) return null;

    const triggers = await db
      .select()
      .from(routineTriggers)
      .where(eq(routineTriggers.routineId, routineId))
      .orderBy(desc(routineTriggers.createdAt));

    const runs = await db
      .select()
      .from(routineRuns)
      .where(eq(routineRuns.routineId, routineId))
      .orderBy(desc(routineRuns.createdAt))
      .limit(20);

    return {
      ...routineRow,
      triggers: triggers.map(rowToTrigger),
      runs: runs.map(rowToRun),
    };
  }

  async function create(
    companyId: string,
    input: {
      projectId: string;
      goalId: string | null;
      parentIssueId: string | null;
      title: string;
      description: string | null;
      assigneeAgentId: string;
      priority: string;
      status: string;
      concurrencyPolicy: string;
      catchUpPolicy: string;
    },
    actor: { agentId: string | null; userId: string | null },
  ): Promise<Routine> {
    const rows = await db
      .insert(routines)
      .values({
        companyId,
        ...input,
        createdByAgentId: actor.agentId,
        createdByUserId: actor.userId,
        updatedByAgentId: actor.agentId,
        updatedByUserId: actor.userId,
      })
      .returning();
    return rowToRoutine(rows[0]);
  }

  async function update(
    routineId: string,
    input: {
      title?: string;
      description?: string | null;
      assigneeAgentId?: string;
      priority?: string;
      status?: string;
      concurrencyPolicy?: string;
      catchUpPolicy?: string;
    },
    actor: { agentId: string | null; userId: string | null },
  ): Promise<Routine | null> {
    const rows = await db
      .update(routines)
      .set({
        ...input,
        updatedByAgentId: actor.agentId,
        updatedByUserId: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(routines.id, routineId))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToRoutine(row) : null;
  }

  async function remove(routineId: string): Promise<{ ok: true }> {
    await db.delete(routines).where(eq(routines.id, routineId));
    return { ok: true };
  }

  async function createTrigger(
    companyId: string,
    input: {
      routineId: string;
      kind: string;
      label: string | null;
      enabled: boolean;
      cronExpression: string | null;
      timezone: string | null;
    },
    actor: { agentId: string | null; userId: string | null },
  ): Promise<RoutineTrigger> {
    const rows = await db
      .insert(routineTriggers)
      .values({
        companyId,
        ...input,
        createdByAgentId: actor.agentId,
        createdByUserId: actor.userId,
        updatedByAgentId: actor.agentId,
        updatedByUserId: actor.userId,
      })
      .returning();
    return rowToTrigger(rows[0]);
  }

  async function updateTrigger(
    triggerId: string,
    input: {
      label?: string | null;
      enabled?: boolean;
      cronExpression?: string | null;
      timezone?: string | null;
    },
    actor: { agentId: string | null; userId: string | null },
  ): Promise<RoutineTrigger | null> {
    const rows = await db
      .update(routineTriggers)
      .set({
        ...input,
        updatedByAgentId: actor.agentId,
        updatedByUserId: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(routineTriggers.id, triggerId))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToTrigger(row) : null;
  }

  async function removeTrigger(triggerId: string): Promise<{ ok: true }> {
    await db.delete(routineTriggers).where(eq(routineTriggers.id, triggerId));
    return { ok: true };
  }

  async function createRun(
    companyId: string,
    input: {
      routineId: string;
      triggerId: string | null;
      source: string;
      triggerPayload: Record<string, unknown> | null;
    },
  ): Promise<RoutineRun> {
    const rows = await db
      .insert(routineRuns)
      .values({
        companyId,
        ...input,
        status: "received",
      })
      .returning();
    return rowToRun(rows[0]);
  }

  async function updateRun(
    runId: string,
    input: {
      status?: string;
      linkedIssueId?: string | null;
      coalescedIntoRunId?: string | null;
      failureReason?: string | null;
      completedAt?: Date | null;
    },
  ): Promise<RoutineRun | null> {
    const rows = await db
      .update(routineRuns)
      .set(input)
      .where(eq(routineRuns.id, runId))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToRun(row) : null;
  }

  return {
    list,
    get,
    getDetail,
    create,
    update,
    remove,
    createTrigger,
    updateTrigger,
    removeTrigger,
    createRun,
    updateRun,
  };
}

function rowToRoutine(row: typeof routines.$inferSelect): Routine {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    goalId: row.goalId,
    parentIssueId: row.parentIssueId,
    title: row.title,
    description: row.description,
    assigneeAgentId: row.assigneeAgentId,
    priority: row.priority as Routine["priority"],
    status: row.status as Routine["status"],
    concurrencyPolicy: row.concurrencyPolicy as Routine["concurrencyPolicy"],
    catchUpPolicy: row.catchUpPolicy as Routine["catchUpPolicy"],
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
    lastEnqueuedAt: row.lastEnqueuedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToTrigger(row: typeof routineTriggers.$inferSelect): RoutineTrigger {
  return {
    id: row.id,
    companyId: row.companyId,
    routineId: row.routineId,
    kind: row.kind,
    label: row.label,
    enabled: row.enabled,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    publicId: row.publicId,
    secretId: row.secretId,
    signingMode: row.signingMode,
    replayWindowSec: row.replayWindowSec,
    lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
    lastResult: row.lastResult,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToRun(row: typeof routineRuns.$inferSelect): RoutineRun {
  return {
    id: row.id,
    companyId: row.companyId,
    routineId: row.routineId,
    triggerId: row.triggerId,
    source: row.source,
    status: row.status as RoutineRun["status"],
    triggeredAt: row.triggeredAt.toISOString(),
    idempotencyKey: row.idempotencyKey,
    triggerPayload: row.triggerPayload as RoutineRun["triggerPayload"],
    linkedIssueId: row.linkedIssueId,
    coalescedIntoRunId: row.coalescedIntoRunId,
    failureReason: row.failureReason,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
