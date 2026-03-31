import { Router } from "express";
import type { Db } from "@jigongai/db";
import { workspaceAgentService, type WorkspaceAgentRole } from "../services/workspace-agents.js";
import { getActorInfo } from "./authz.js";

export function workspaceAgentRoutes(db: Db) {
  const router = Router();
  const svc = workspaceAgentService(db);

  /**
   * GET /workspaces/:workspaceId/agents
   * List all agents bound to a workspace
   */
  router.get("/workspaces/:workspaceId/agents", async (req, res) => {
    const { workspaceId } = req.params;
    try {
      const agents = await svc.listByWorkspace(workspaceId);
      res.json(agents);
    } catch (error) {
      console.error("Error listing workspace agents:", error);
      res.status(500).json({ error: "Failed to list workspace agents" });
    }
  });

  /**
   * GET /agents/:agentId/workspaces
   * List all workspaces bound to an agent
   */
  router.get("/agents/:agentId/workspaces", async (req, res) => {
    const { agentId } = req.params;
    try {
      const workspaces = await svc.listByAgent(agentId);
      res.json(workspaces);
    } catch (error) {
      console.error("Error listing agent workspaces:", error);
      res.status(500).json({ error: "Failed to list agent workspaces" });
    }
  });

  /**
   * GET /workspaces/:workspaceId/agents/:agentId
   * Get a specific workspace-agent binding
   */
  router.get("/workspaces/:workspaceId/agents/:agentId", async (req, res) => {
    const { workspaceId, agentId } = req.params;
    try {
      const binding = await svc.getBinding(workspaceId, agentId);
      if (!binding) {
        res.status(404).json({ error: "Binding not found" });
        return;
      }
      res.json(binding);
    } catch (error) {
      console.error("Error getting workspace-agent binding:", error);
      res.status(500).json({ error: "Failed to get workspace-agent binding" });
    }
  });

  /**
   * POST /workspaces/:workspaceId/agents
   * Add or update an agent binding to a workspace
   * Body: { agentId: string, role?: "lead" | "member" | "observer" }
   */
  router.post("/workspaces/:workspaceId/agents", async (req, res) => {
    const { workspaceId } = req.params;
    const { agentId, role = "member" } = req.body as {
      agentId: string;
      role?: WorkspaceAgentRole;
    };

    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }

    try {
      const actor = getActorInfo(req);
      const binding = await svc.addBinding(workspaceId, agentId, role, actor, req.query.companyId as string);
      res.status(201).json(binding);
    } catch (error) {
      console.error("Error adding workspace-agent binding:", error);
      res.status(500).json({ error: "Failed to add workspace-agent binding" });
    }
  });

  /**
   * PUT /workspaces/:workspaceId/agents/:agentId
   * Update the role of an agent in a workspace
   * Body: { role: "lead" | "member" | "observer" }
   */
  router.put("/workspaces/:workspaceId/agents/:agentId", async (req, res) => {
    const { workspaceId, agentId } = req.params;
    const { role } = req.body as { role: WorkspaceAgentRole };

    if (!role) {
      res.status(400).json({ error: "role is required" });
      return;
    }

    try {
      const actor = getActorInfo(req);
      const binding = await svc.updateRole(workspaceId, agentId, role, actor, req.query.companyId as string);
      res.json(binding);
    } catch (error) {
      console.error("Error updating workspace-agent role:", error);
      res.status(500).json({ error: "Failed to update workspace-agent role" });
    }
  });

  /**
   * DELETE /workspaces/:workspaceId/agents/:agentId
   * Remove an agent binding from a workspace
   */
  router.delete("/workspaces/:workspaceId/agents/:agentId", async (req, res) => {
    const { workspaceId, agentId } = req.params;
    try {
      const actor = getActorInfo(req);
      await svc.removeBinding(workspaceId, agentId, actor, req.query.companyId as string);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing workspace-agent binding:", error);
      res.status(500).json({ error: "Failed to remove workspace-agent binding" });
    }
  });

  return router;
}
