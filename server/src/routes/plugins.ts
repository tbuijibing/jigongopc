import { Router, type Request } from "express";
import type { Db } from "@jigongai/db";
import {
  installPluginSchema,
  updatePluginConfigSchema,
  updatePluginStateSchema,
  createPluginEntitySchema,
  updatePluginEntitySchema,
  createPluginJobSchema,
  updatePluginJobSchema,
} from "@jigongai/shared/validators";
import { validate } from "../middleware/validate.js";
import { pluginService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { forbidden } from "../errors.js";

export function pluginRoutes(db: Db) {
  const router = Router();
  const svc = pluginService(db);

  async function assertCanManagePlugins(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);

    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      return;
    }

    if (!req.actor.agentId) {
      throw forbidden("Agent authentication required");
    }
  }

  // List plugins
  router.get("/companies/:companyId/plugins", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  // Get plugin
  router.get("/companies/:companyId/plugins/:pluginId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const pluginId = req.params.pluginId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.get(pluginId);
    if (!result || result.companyId !== companyId) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }
    res.json(result);
  });

  // Install plugin
  router.post(
    "/companies/:companyId/plugins",
    validate(installPluginSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManagePlugins(req, companyId);

      const actor = getActorInfo(req);
      const plugin = await svc.install(companyId, req.body);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "plugin.installed",
        entityType: "plugin",
        entityId: plugin.id,
        details: { name: plugin.name, version: plugin.version },
      });

      res.status(201).json(plugin);
    },
  );

  // Update plugin status
  router.patch("/plugins/:pluginId/status", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const { status, error } = req.body as { status: "inactive" | "active" | "error"; error?: string };

    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    await assertCanManagePlugins(req, plugin.companyId);

    const updated = await svc.updateStatus(pluginId, status, error);
    if (!updated) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    res.json(updated);
  });

  // Uninstall plugin
  router.delete("/plugins/:pluginId", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    await assertCanManagePlugins(req, plugin.companyId);

    const actor = getActorInfo(req);
    await svc.remove(pluginId);

    await logActivity(db, {
      companyId: plugin.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "plugin.uninstalled",
      entityType: "plugin",
      entityId: pluginId,
    });

    res.json({ ok: true });
  });

  // Get plugin config
  router.get("/plugins/:pluginId/config", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    const result = await svc.getConfig(plugin.companyId, pluginId);
    res.json(result);
  });

  // Update plugin config
  router.patch(
    "/plugins/:pluginId/config",
    validate(updatePluginConfigSchema),
    async (req, res) => {
      const pluginId = req.params.pluginId as string;
      const plugin = await svc.get(pluginId);
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }

      assertCompanyAccess(req, plugin.companyId);
      await assertCanManagePlugins(req, plugin.companyId);

      const result = await svc.updateConfig(plugin.companyId, pluginId, req.body);
      res.json(result);
    },
  );

  // Get plugin state
  router.get("/plugins/:pluginId/state", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    const result = await svc.getState(plugin.companyId, pluginId);
    res.json(result);
  });

  // Update plugin state
  router.patch(
    "/plugins/:pluginId/state",
    validate(updatePluginStateSchema),
    async (req, res) => {
      const pluginId = req.params.pluginId as string;
      const plugin = await svc.get(pluginId);
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }

      assertCompanyAccess(req, plugin.companyId);
      await assertCanManagePlugins(req, plugin.companyId);

      const result = await svc.updateState(plugin.companyId, pluginId, req.body);
      res.json(result);
    },
  );

  // Get plugin entities
  router.get("/plugins/:pluginId/entities", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    const entityType = req.query.entityType as string | undefined;
    const result = await svc.getEntities(plugin.companyId, pluginId, entityType);
    res.json(result);
  });

  // Create plugin entity
  router.post(
    "/plugins/:pluginId/entities",
    validate(createPluginEntitySchema),
    async (req, res) => {
      const pluginId = req.params.pluginId as string;
      const plugin = await svc.get(pluginId);
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }

      assertCompanyAccess(req, plugin.companyId);
      await assertCanManagePlugins(req, plugin.companyId);

      const result = await svc.createEntity(plugin.companyId, pluginId, req.body);
      res.status(201).json(result);
    },
  );

  // Update plugin entity
  router.patch(
    "/plugins/:pluginId/entities/:entityId",
    validate(updatePluginEntitySchema),
    async (req, res) => {
      const pluginId = req.params.pluginId as string;
      const plugin = await svc.get(pluginId);
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }

      assertCompanyAccess(req, plugin.companyId);
      await assertCanManagePlugins(req, plugin.companyId);

      const result = await svc.updateEntity(req.params.entityId as string, req.body.entityData);
      if (!result) {
        res.status(404).json({ error: "Entity not found" });
        return;
      }
      res.json(result);
    },
  );

  // Delete plugin entity
  router.delete("/plugins/:pluginId/entities/:entityId", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    await assertCanManagePlugins(req, plugin.companyId);

    await svc.removeEntity(req.params.entityId as string);
    res.json({ ok: true });
  });

  // Get plugin jobs
  router.get("/plugins/:pluginId/jobs", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    const result = await svc.getJobs(plugin.companyId, pluginId);
    res.json(result);
  });

  // Create plugin job
  router.post(
    "/plugins/:pluginId/jobs",
    validate(createPluginJobSchema),
    async (req, res) => {
      const pluginId = req.params.pluginId as string;
      const plugin = await svc.get(pluginId);
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }

      assertCompanyAccess(req, plugin.companyId);
      await assertCanManagePlugins(req, plugin.companyId);

      const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
      const result = await svc.createJob(plugin.companyId, pluginId, {
        jobType: req.body.jobType,
        payload: req.body.payload ?? null,
        priority: req.body.priority,
        scheduledAt,
      });
      res.status(201).json(result);
    },
  );

  // Update plugin job
  router.patch(
    "/plugins/:pluginId/jobs/:jobId",
    validate(updatePluginJobSchema),
    async (req, res) => {
      const pluginId = req.params.pluginId as string;
      const plugin = await svc.get(pluginId);
      if (!plugin) {
        res.status(404).json({ error: "Plugin not found" });
        return;
      }

      assertCompanyAccess(req, plugin.companyId);
      await assertCanManagePlugins(req, plugin.companyId);

      const result = await svc.updateJob(req.params.jobId as string, req.body);
      if (!result) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json(result);
    },
  );

  // Get plugin logs
  router.get("/plugins/:pluginId/logs", async (req, res) => {
    const pluginId = req.params.pluginId as string;
    const plugin = await svc.get(pluginId);
    if (!plugin) {
      res.status(404).json({ error: "Plugin not found" });
      return;
    }

    assertCompanyAccess(req, plugin.companyId);
    const limit = parseInt(req.query.limit as string) || 100;
    const result = await svc.getLogs(plugin.companyId, pluginId, limit);
    res.json(result);
  });

  return router;
}
