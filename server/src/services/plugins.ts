import type { Db } from "@jigongai/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  plugins,
  pluginConfig,
  pluginState,
  pluginEntities,
  pluginJobs,
  pluginJobRuns,
  pluginWebhookDeliveries,
  pluginLogs,
} from "@jigongai/db/schema";
import type {
  Plugin,
  PluginConfig as PluginConfigType,
  PluginState as PluginStateType,
  PluginEntity,
  PluginJob,
  PluginJobRun,
  PluginLog,
} from "@jigongai/shared";

export function pluginService(db: Db) {
  async function list(companyId: string): Promise<Plugin[]> {
    const rows = await db
      .select()
      .from(plugins)
      .where(eq(plugins.companyId, companyId))
      .orderBy(desc(plugins.installedAt));
    return rows.map(rowToPlugin);
  }

  async function get(pluginId: string): Promise<Plugin | null> {
    const rows = await db.select().from(plugins).where(eq(plugins.id, pluginId));
    const row = rows[0] ?? null;
    return row ? rowToPlugin(row) : null;
  }

  async function install(
    companyId: string,
    input: {
      name: string;
      slug: string;
      version: string;
      description: string | null;
      author: string | null;
      manifest: Record<string, unknown>;
    },
  ): Promise<Plugin> {
    const rows = await db
      .insert(plugins)
      .values({
        companyId,
        ...input,
        status: "inactive",
      })
      .returning();
    return rowToPlugin(rows[0]);
  }

  async function updateStatus(
    pluginId: string,
    status: "inactive" | "active" | "error",
    error?: string | null,
  ): Promise<Plugin | null> {
    const rows = await db
      .update(plugins)
      .set({
        status,
        error: error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(plugins.id, pluginId))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToPlugin(row) : null;
  }

  async function remove(pluginId: string): Promise<{ ok: true }> {
    await db.delete(plugins).where(eq(plugins.id, pluginId));
    return { ok: true };
  }

  // Plugin Config
  async function getConfig(companyId: string, pluginId: string): Promise<PluginConfigType[]> {
    const rows = await db
      .select()
      .from(pluginConfig)
      .where(and(eq(pluginConfig.companyId, companyId), eq(pluginConfig.pluginId, pluginId)));
    return rows.map(rowToPluginConfig);
  }

  async function updateConfig(
    companyId: string,
    pluginId: string,
    input: {
      configKey: string;
      configValue: Record<string, unknown> | null;
      isSecret: boolean;
    },
  ): Promise<PluginConfigType> {
    const existing = await db
      .select()
      .from(pluginConfig)
      .where(
        and(
          eq(pluginConfig.companyId, companyId),
          eq(pluginConfig.pluginId, pluginId),
          eq(pluginConfig.configKey, input.configKey),
        ),
      );

    if (existing.length > 0) {
      const rows = await db
        .update(pluginConfig)
        .set({
          configValue: input.configValue,
          isSecret: input.isSecret,
          updatedAt: new Date(),
        })
        .where(eq(pluginConfig.id, existing[0].id))
        .returning();
      return rowToPluginConfig(rows[0]);
    }

    const rows = await db
      .insert(pluginConfig)
      .values({
        companyId,
        pluginId,
        ...input,
      })
      .returning();
    return rowToPluginConfig(rows[0]);
  }

  // Plugin State
  async function getState(companyId: string, pluginId: string): Promise<PluginStateType[]> {
    const rows = await db
      .select()
      .from(pluginState)
      .where(and(eq(pluginState.companyId, companyId), eq(pluginState.pluginId, pluginId)));
    return rows.map(rowToPluginState);
  }

  async function updateState(
    companyId: string,
    pluginId: string,
    input: {
      stateKey: string;
      stateValue: Record<string, unknown> | null;
    },
  ): Promise<PluginStateType> {
    const existing = await db
      .select()
      .from(pluginState)
      .where(
        and(
          eq(pluginState.companyId, companyId),
          eq(pluginState.pluginId, pluginId),
          eq(pluginState.stateKey, input.stateKey),
        ),
      );

    if (existing.length > 0) {
      const rows = await db
        .update(pluginState)
        .set({
          stateValue: input.stateValue,
          updatedAt: new Date(),
        })
        .where(eq(pluginState.id, existing[0].id))
        .returning();
      return rowToPluginState(rows[0]);
    }

    const rows = await db
      .insert(pluginState)
      .values({
        companyId,
        pluginId,
        ...input,
      })
      .returning();
    return rowToPluginState(rows[0]);
  }

  // Plugin Entities
  async function getEntities(
    companyId: string,
    pluginId: string,
    entityType?: string,
  ): Promise<PluginEntity[]> {
    const conditions = [
      eq(pluginEntities.companyId, companyId),
      eq(pluginEntities.pluginId, pluginId),
    ];
    if (entityType) {
      conditions.push(eq(pluginEntities.entityType, entityType));
    }

    const rows = await db
      .select()
      .from(pluginEntities)
      .where(and(...conditions))
      .orderBy(desc(pluginEntities.createdAt));
    return rows.map(rowToPluginEntity);
  }

  async function createEntity(
    companyId: string,
    pluginId: string,
    input: {
      entityType: string;
      entityData: Record<string, unknown>;
    },
  ): Promise<PluginEntity> {
    const rows = await db
      .insert(pluginEntities)
      .values({
        companyId,
        pluginId,
        ...input,
      })
      .returning();
    return rowToPluginEntity(rows[0]);
  }

  async function updateEntity(
    entityId: string,
    entityData: Record<string, unknown>,
  ): Promise<PluginEntity | null> {
    const rows = await db
      .update(pluginEntities)
      .set({
        entityData,
        updatedAt: new Date(),
      })
      .where(eq(pluginEntities.id, entityId))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToPluginEntity(row) : null;
  }

  async function removeEntity(entityId: string): Promise<{ ok: true }> {
    await db.delete(pluginEntities).where(eq(pluginEntities.id, entityId));
    return { ok: true };
  }

  // Plugin Jobs
  async function getJobs(companyId: string, pluginId: string): Promise<PluginJob[]> {
    const rows = await db
      .select()
      .from(pluginJobs)
      .where(and(eq(pluginJobs.companyId, companyId), eq(pluginJobs.pluginId, pluginId)))
      .orderBy(desc(pluginJobs.createdAt));
    return rows.map(rowToPluginJob);
  }

  async function createJob(
    companyId: string,
    pluginId: string,
    input: {
      jobType: string;
      payload: Record<string, unknown> | null;
      priority: number;
      scheduledAt: Date | null;
    },
  ): Promise<PluginJob> {
    const rows = await db
      .insert(pluginJobs)
      .values({
        companyId,
        pluginId,
        ...input,
        jobStatus: "pending",
      })
      .returning();
    return rowToPluginJob(rows[0]);
  }

  async function updateJob(
    jobId: string,
    input: {
      jobStatus?: string;
      result?: Record<string, unknown> | null;
      error?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
  ): Promise<PluginJob | null> {
    const rows = await db
      .update(pluginJobs)
      .set(input)
      .where(eq(pluginJobs.id, jobId))
      .returning();
    const row = rows[0] ?? null;
    return row ? rowToPluginJob(row) : null;
  }

  async function createJobRun(
    companyId: string,
    pluginId: string,
    jobId: string,
    runStatus: string,
    log?: string | null,
  ): Promise<PluginJobRun> {
    const rows = await db
      .insert(pluginJobRuns)
      .values({
        companyId,
        pluginId,
        jobId,
        runStatus,
        log: log ?? null,
      })
      .returning();
    return rowToPluginJobRun(rows[0]);
  }

  // Plugin Logs
  async function getLogs(companyId: string, pluginId: string, limit = 100): Promise<PluginLog[]> {
    const rows = await db
      .select()
      .from(pluginLogs)
      .where(and(eq(pluginLogs.companyId, companyId), eq(pluginLogs.pluginId, pluginId)))
      .orderBy(desc(pluginLogs.createdAt))
      .limit(limit);
    return rows.map(rowToPluginLog);
  }

  async function log(
    companyId: string,
    pluginId: string,
    level: string,
    message: string,
    context?: Record<string, unknown> | null,
  ): Promise<void> {
    await db.insert(pluginLogs).values({
      companyId,
      pluginId,
      level,
      message,
      context: context ?? null,
    });
  }

  return {
    list,
    get,
    install,
    updateStatus,
    remove,
    getConfig,
    updateConfig,
    getState,
    updateState,
    getEntities,
    createEntity,
    updateEntity,
    removeEntity,
    getJobs,
    createJob,
    updateJob,
    createJobRun,
    getLogs,
    log,
  };
}

function rowToPlugin(row: typeof plugins.$inferSelect): Plugin {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    slug: row.slug,
    version: row.version,
    description: row.description,
    author: row.author,
    manifest: row.manifest as Plugin["manifest"],
    status: row.status as Plugin["status"],
    error: row.error,
    installedAt: row.installedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToPluginConfig(row: typeof pluginConfig.$inferSelect): PluginConfigType {
  return {
    id: row.id,
    companyId: row.companyId,
    pluginId: row.pluginId,
    configKey: row.configKey,
    configValue: row.configValue as PluginConfigType["configValue"],
    isSecret: row.isSecret,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToPluginState(row: typeof pluginState.$inferSelect): PluginStateType {
  return {
    id: row.id,
    companyId: row.companyId,
    pluginId: row.pluginId,
    stateKey: row.stateKey,
    stateValue: row.stateValue as PluginStateType["stateValue"],
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToPluginEntity(row: typeof pluginEntities.$inferSelect): PluginEntity {
  return {
    id: row.id,
    companyId: row.companyId,
    pluginId: row.pluginId,
    entityType: row.entityType,
    entityData: row.entityData as PluginEntity["entityData"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToPluginJob(row: typeof pluginJobs.$inferSelect): PluginJob {
  return {
    id: row.id,
    companyId: row.companyId,
    pluginId: row.pluginId,
    jobType: row.jobType,
    jobStatus: row.jobStatus as PluginJob["jobStatus"],
    priority: row.priority,
    payload: row.payload as PluginJob["payload"],
    result: row.result as PluginJob["result"],
    error: row.error,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function rowToPluginJobRun(row: typeof pluginJobRuns.$inferSelect): PluginJobRun {
  return {
    id: row.id,
    companyId: row.companyId,
    pluginId: row.pluginId,
    jobId: row.jobId,
    runStatus: row.runStatus,
    log: row.log,
    createdAt: row.createdAt.toISOString(),
  };
}

function rowToPluginLog(row: typeof pluginLogs.$inferSelect): PluginLog {
  return {
    id: row.id,
    companyId: row.companyId,
    pluginId: row.pluginId,
    level: row.level as PluginLog["level"],
    message: row.message,
    context: row.context as PluginLog["context"],
    createdAt: row.createdAt.toISOString(),
  };
}
