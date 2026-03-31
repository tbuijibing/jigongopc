import { Router } from "express";
import type { Db } from "@jigongai/db";
import { projectAgentService, type ProjectAgentRole } from "../services/project-agents.js";
import { getActorInfo } from "./authz.js";

export function projectAgentRoutes(db: Db) {
  const router = Router();
  const svc = projectAgentService(db);

  /**
   * GET /projects/:projectId/agents
   * List all agents bound to a project
   */
  router.get("/projects/:projectId/agents", async (req, res) => {
    const { projectId } = req.params;
    try {
      const agents = await svc.listByProject(projectId);
      res.json(agents);
    } catch (error) {
      console.error("Error listing project agents:", error);
      res.status(500).json({ error: "Failed to list project agents" });
    }
  });

  /**
   * GET /agents/:agentId/projects
   * List all projects bound to an agent
   */
  router.get("/agents/:agentId/projects", async (req, res) => {
    const { agentId } = req.params;
    try {
      const projects = await svc.listByAgent(agentId);
      res.json(projects);
    } catch (error) {
      console.error("Error listing agent projects:", error);
      res.status(500).json({ error: "Failed to list agent projects" });
    }
  });

  /**
   * GET /projects/:projectId/agents/:agentId
   * Get a specific project-agent binding
   */
  router.get("/projects/:projectId/agents/:agentId", async (req, res) => {
    const { projectId, agentId } = req.params;
    try {
      const binding = await svc.getBinding(projectId, agentId);
      if (!binding) {
        res.status(404).json({ error: "Binding not found" });
        return;
      }
      res.json(binding);
    } catch (error) {
      console.error("Error getting project-agent binding:", error);
      res.status(500).json({ error: "Failed to get project-agent binding" });
    }
  });

  /**
   * POST /projects/:projectId/agents
   * Add or update an agent binding to a project
   * Body: { agentId: string, role?: "lead" | "member" | "observer" }
   */
  router.post("/projects/:projectId/agents", async (req, res) => {
    const { projectId } = req.params;
    const { agentId, role = "member" } = req.body as {
      agentId: string;
      role?: ProjectAgentRole;
    };

    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }

    try {
      const actor = getActorInfo(req);
      const binding = await svc.addBinding(projectId, agentId, role, actor, undefined);
      res.status(201).json(binding);
    } catch (error) {
      console.error("Error adding project-agent binding:", error);
      res.status(500).json({ error: "Failed to add project-agent binding" });
    }
  });

  /**
   * PUT /projects/:projectId/agents/:agentId
   * Update the role of an agent in a project
   * Body: { role: "lead" | "member" | "observer" }
   */
  router.put("/projects/:projectId/agents/:agentId", async (req, res) => {
    const { projectId, agentId } = req.params;
    const { role } = req.body as { role: ProjectAgentRole };

    if (!role) {
      res.status(400).json({ error: "role is required" });
      return;
    }

    try {
      const actor = getActorInfo(req);
      const binding = await svc.updateRole(projectId, agentId, role, actor, undefined);
      if (!binding) {
        res.status(404).json({ error: "Binding not found" });
        return;
      }
      res.json(binding);
    } catch (error) {
      console.error("Error updating project-agent role:", error);
      res.status(500).json({ error: "Failed to update project-agent role" });
    }
  });

  /**
   * DELETE /projects/:projectId/agents/:agentId
   * Remove an agent from a project
   */
  router.delete("/projects/:projectId/agents/:agentId", async (req, res) => {
    const { projectId, agentId } = req.params;

    try {
      const actor = getActorInfo(req);
      await svc.removeBinding(projectId, agentId, actor, undefined);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing project-agent binding:", error);
      res.status(500).json({ error: "Failed to remove project-agent binding" });
    }
  });

  /**
   * POST /projects/:projectId/agents/sync
   * Sync multiple agent bindings for a project
   * Body: { bindings: [{ agentId: string, role?: "lead" | "member" | "observer" }] }
   */
  router.post("/projects/:projectId/agents/sync", async (req, res) => {
    const { projectId } = req.params;
    const { bindings } = req.body as {
      bindings: { agentId: string; role?: ProjectAgentRole }[];
    };

    if (!bindings || !Array.isArray(bindings)) {
      res.status(400).json({ error: "bindings array is required" });
      return;
    }

    try {
      const actor = getActorInfo(req);
      const result = await svc.syncBindings(projectId, bindings, actor, undefined);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error syncing project agents:", error);
      res.status(500).json({ error: "Failed to sync project agents" });
    }
  });

  return router;
}
