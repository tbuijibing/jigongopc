import { and, eq } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { agents, agentTools } from "@jigongai/db";
import { TOOL_TYPES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

function validateToolType(toolType: string): void {
  if (!(TOOL_TYPES as readonly string[]).includes(toolType)) {
    throw unprocessable(
      `Invalid toolType '${toolType}'. Must be one of: ${TOOL_TYPES.join(", ")}`,
    );
  }
}

function validateConfig(toolType: string, config: Record<string, unknown>): void {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw unprocessable("config must be a JSON object");
  }
}

export function agentToolService(db: Db) {
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

  return {
    listTools: async (companyId: string, agentId: string) => {
      await ensureAgentBelongsToCompany(companyId, agentId);
      return db
        .select()
        .from(agentTools)
        .where(
          and(
            eq(agentTools.companyId, companyId),
            eq(agentTools.agentId, agentId),
          ),
        );
    },

    createTool: async (
      companyId: string,
      agentId: string,
      data: {
        toolType: string;
        name: string;
        description?: string | null;
        config?: Record<string, unknown>;
        permissions?: Record<string, unknown>;
        enabled?: boolean;
      },
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);
      validateToolType(data.toolType);
      if (data.config) {
        validateConfig(data.toolType, data.config);
      }

      return db
        .insert(agentTools)
        .values({
          companyId,
          agentId,
          toolType: data.toolType,
          name: data.name,
          description: data.description ?? null,
          config: data.config ?? {},
          permissions: data.permissions ?? {},
          enabled: data.enabled ?? true,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updateTool: async (
      companyId: string,
      agentId: string,
      toolId: string,
      data: {
        name?: string;
        description?: string | null;
        toolType?: string;
        config?: Record<string, unknown>;
        permissions?: Record<string, unknown>;
        enabled?: boolean;
      },
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);

      if (data.toolType !== undefined) {
        validateToolType(data.toolType);
      }
      if (data.config !== undefined) {
        validateConfig(data.toolType ?? "", data.config);
      }

      const existing = await db
        .select()
        .from(agentTools)
        .where(
          and(
            eq(agentTools.id, toolId),
            eq(agentTools.companyId, companyId),
            eq(agentTools.agentId, agentId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!existing) {
        throw notFound("Tool not found");
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) patch.name = data.name;
      if (data.description !== undefined) patch.description = data.description;
      if (data.toolType !== undefined) patch.toolType = data.toolType;
      if (data.config !== undefined) patch.config = data.config;
      if (data.permissions !== undefined) patch.permissions = data.permissions;
      if (data.enabled !== undefined) patch.enabled = data.enabled;

      return db
        .update(agentTools)
        .set(patch)
        .where(eq(agentTools.id, toolId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    deleteTool: async (
      companyId: string,
      agentId: string,
      toolId: string,
    ) => {
      await ensureAgentBelongsToCompany(companyId, agentId);

      const deleted = await db
        .delete(agentTools)
        .where(
          and(
            eq(agentTools.id, toolId),
            eq(agentTools.companyId, companyId),
            eq(agentTools.agentId, agentId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!deleted) {
        throw notFound("Tool not found");
      }
      return deleted;
    },
  };
}
