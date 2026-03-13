import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentMemories } from "@jigongai/db";
import { MEMORY_LAYERS, MEMORY_TYPES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

function validateMemoryLayer(memoryLayer: string): void {
  if (!(MEMORY_LAYERS as readonly string[]).includes(memoryLayer)) {
    throw unprocessable(
      `Invalid memoryLayer '${memoryLayer}'. Must be one of: ${MEMORY_LAYERS.join(", ")}`,
    );
  }
}

function validateMemoryType(memoryType: string): void {
  if (!(MEMORY_TYPES as readonly string[]).includes(memoryType)) {
    throw unprocessable(
      `Invalid memoryType '${memoryType}'. Must be one of: ${MEMORY_TYPES.join(", ")}`,
    );
  }
}

/**
 * Validate memoryLayer / scopeId consistency (Requirement 5.4):
 *  - agent layer → scopeId must be null
 *  - project layer → scopeId must be a non-null projectId
 *  - task layer → scopeId must be a non-null issueId
 */
function validateLayerScopeConsistency(
  memoryLayer: string,
  scopeId: string | null | undefined,
): void {
  if (memoryLayer === "agent") {
    if (scopeId != null) {
      throw unprocessable(
        "agent-layer memory must have scopeId = null",
      );
    }
  } else if (memoryLayer === "project") {
    if (!scopeId) {
      throw unprocessable(
        "project-layer memory requires a non-null scopeId (projectId)",
      );
    }
  } else if (memoryLayer === "task") {
    if (!scopeId) {
      throw unprocessable(
        "task-layer memory requires a non-null scopeId (issueId)",
      );
    }
  }
}

export function agentMemoryService(db: Db) {
  async function ensureAgentBelongsToCompany(
    companyId: string,
    agentId: string,
  ): Promise<void> {
    const agent = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!agent) {
      throw notFound("Agent not found in this company");
    }
  }

  /** Condition that excludes expired memories (expiresAt is null OR in the future). */
  function notExpired() {
    return or(
      isNull(agentMemories.expiresAt),
      gt(agentMemories.expiresAt, new Date()),
    );
  }

  return {
    /**
     * Write a new memory record.
     * Validates memoryLayer/scopeId consistency and memoryType.
     * Requirements: 5.1, 5.4, 5.6
     */
    writeMemory: async (
      companyId: string,
      agentId: string,
      data: {
        memoryLayer: string;
        scopeId?: string | null;
        key: string;
        value: string;
        memoryType: string;
        importance?: number;
        expiresAt?: Date | null;
      },
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);
      validateMemoryLayer(data.memoryLayer);
      validateMemoryType(data.memoryType);
      validateLayerScopeConsistency(data.memoryLayer, data.scopeId);

      const importance =
        data.importance !== undefined
          ? Math.max(0, Math.min(100, Math.floor(data.importance)))
          : 50;

      return db
        .insert(agentMemories)
        .values({
          companyId,
          agentId,
          memoryLayer: data.memoryLayer,
          scopeId: data.scopeId ?? null,
          key: data.key,
          value: data.value,
          memoryType: data.memoryType,
          importance,
          expiresAt: data.expiresAt ?? null,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    /**
     * Read memories for an agent with task → project → agent priority merge.
     * Excludes expired memories (expiresAt < now).
     * Requirements: 5.2, 5.5
     *
     * Options allow filtering by layer/scopeId. When no filter is given and
     * a taskScopeId + projectScopeId are provided, the service fetches all
     * three layers and deduplicates by key using nearest-scope-wins.
     */
    readMemories: async (
      companyId: string,
      agentId: string,
      options?: {
        layer?: string;
        scopeId?: string;
        taskScopeId?: string;
        projectScopeId?: string;
      },
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);

      // Simple filtered read — return matching rows directly
      if (options?.layer) {
        const conditions = [
          eq(agentMemories.companyId, companyId),
          eq(agentMemories.agentId, agentId),
          eq(agentMemories.memoryLayer, options.layer),
          notExpired(),
        ];
        if (options.scopeId) {
          conditions.push(eq(agentMemories.scopeId, options.scopeId));
        }
        const rows = await db
          .select()
          .from(agentMemories)
          .where(and(...conditions));

        // Bump accessCount for returned rows
        if (rows.length > 0) {
          await db
            .update(agentMemories)
            .set({
              accessCount: sql`${agentMemories.accessCount} + 1`,
              lastAccessedAt: new Date(),
            })
            .where(
              and(
                eq(agentMemories.companyId, companyId),
                eq(agentMemories.agentId, agentId),
                eq(agentMemories.memoryLayer, options.layer),
                notExpired(),
                options.scopeId
                  ? eq(agentMemories.scopeId, options.scopeId)
                  : undefined,
              ),
            );
        }
        return rows;
      }

      // Priority merge read: task → project → agent (nearest-scope-wins)
      // Fetch all relevant memories across layers, then deduplicate by key.
      const conditions = [
        eq(agentMemories.companyId, companyId),
        eq(agentMemories.agentId, agentId),
        notExpired(),
      ];

      // Build layer filter: include agent layer (scopeId null) plus any
      // provided project/task scopes.
      const layerFilters = [
        and(eq(agentMemories.memoryLayer, "agent"), isNull(agentMemories.scopeId)),
      ];
      if (options?.projectScopeId) {
        layerFilters.push(
          and(
            eq(agentMemories.memoryLayer, "project"),
            eq(agentMemories.scopeId, options.projectScopeId),
          ),
        );
      }
      if (options?.taskScopeId) {
        layerFilters.push(
          and(
            eq(agentMemories.memoryLayer, "task"),
            eq(agentMemories.scopeId, options.taskScopeId),
          ),
        );
      }

      const allMemories = await db
        .select()
        .from(agentMemories)
        .where(and(...conditions, or(...layerFilters)));

      // Deduplicate by key with priority: task > project > agent
      const LAYER_PRIORITY: Record<string, number> = {
        task: 0,
        project: 1,
        agent: 2,
      };

      const byKey = new Map<string, (typeof allMemories)[number]>();
      for (const mem of allMemories) {
        const existing = byKey.get(mem.key);
        if (
          !existing ||
          (LAYER_PRIORITY[mem.memoryLayer] ?? 99) <
            (LAYER_PRIORITY[existing.memoryLayer] ?? 99)
        ) {
          byKey.set(mem.key, mem);
        }
      }

      const result = Array.from(byKey.values());

      // Bump accessCount for returned rows
      if (result.length > 0) {
        const ids = result.map((r) => r.id);
        await db
          .update(agentMemories)
          .set({
            accessCount: sql`${agentMemories.accessCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(
            and(
              eq(agentMemories.companyId, companyId),
              inArray(agentMemories.id, ids),
            ),
          );
      }

      return result;
    },

    /**
     * Update an existing memory record.
     * Requirements: 5.7
     */
    updateMemory: async (
      companyId: string,
      agentId: string,
      memoryId: string,
      data: {
        value?: string;
        memoryType?: string;
        importance?: number;
        expiresAt?: Date | null;
      },
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);

      if (data.memoryType !== undefined) {
        validateMemoryType(data.memoryType);
      }

      const existing = await db
        .select()
        .from(agentMemories)
        .where(
          and(
            eq(agentMemories.id, memoryId),
            eq(agentMemories.companyId, companyId),
            eq(agentMemories.agentId, agentId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!existing) {
        throw notFound("Memory not found");
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.value !== undefined) patch.value = data.value;
      if (data.memoryType !== undefined) patch.memoryType = data.memoryType;
      if (data.importance !== undefined) {
        patch.importance = Math.max(0, Math.min(100, Math.floor(data.importance)));
      }
      if (data.expiresAt !== undefined) patch.expiresAt = data.expiresAt;

      return db
        .update(agentMemories)
        .set(patch)
        .where(eq(agentMemories.id, memoryId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    /**
     * Delete a memory record.
     * Requirements: 5.7
     */
    deleteMemory: async (
      companyId: string,
      agentId: string,
      memoryId: string,
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);

      const deleted = await db
        .delete(agentMemories)
        .where(
          and(
            eq(agentMemories.id, memoryId),
            eq(agentMemories.companyId, companyId),
            eq(agentMemories.agentId, agentId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!deleted) {
        throw notFound("Memory not found");
      }
      return deleted;
    },
  };
}
