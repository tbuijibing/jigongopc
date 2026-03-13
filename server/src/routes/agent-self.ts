import { Router } from "express";
import type { Db } from "@jigongai/db";
import {
  agentService,
  agentMemoryService,
  agentSkillService,
  logActivity,
} from "../services/index.js";
import { forbidden, badRequest } from "../errors.js";

/**
 * Agent self-service API routes.
 *
 * These endpoints are scoped to the authenticated agent's own identity
 * (agentId + companyId extracted from req.actor). Only agent-type actors
 * may call them; board/user actors receive 403.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6
 */
export function agentSelfRoutes(db: Db) {
  const router = Router();
  const svc = agentService(db);
  const memorySvc = agentMemoryService(db);
  const skillSvc = agentSkillService(db);

  /**
   * Guard: every route in this router requires agent-type authentication.
   * Extracts agentId and companyId from req.actor for downstream handlers.
   */
  function assertAgentActor(req: import("express").Request): {
    agentId: string;
    companyId: string;
  } {
    if (req.actor.type !== "agent" || !req.actor.agentId || !req.actor.companyId) {
      throw forbidden("Agent authentication required for self-service API");
    }
    return { agentId: req.actor.agentId, companyId: req.actor.companyId };
  }

  // -------------------------------------------------------------------------
  // GET /api/agent/memories — read agent's own memories
  // Requirement 19.2
  // -------------------------------------------------------------------------
  router.get("/agent/memories", async (req, res) => {
    const { agentId, companyId } = assertAgentActor(req);

    const layer = typeof req.query.layer === "string" ? req.query.layer : undefined;
    const scopeId = typeof req.query.scopeId === "string" ? req.query.scopeId : undefined;
    const taskScopeId = typeof req.query.taskScopeId === "string" ? req.query.taskScopeId : undefined;
    const projectScopeId = typeof req.query.projectScopeId === "string" ? req.query.projectScopeId : undefined;

    const memories = await memorySvc.readMemories(companyId, agentId, {
      layer,
      scopeId,
      taskScopeId,
      projectScopeId,
    });
    res.json(memories);
  });

  // -------------------------------------------------------------------------
  // POST /api/agent/memories — write agent's own memory
  // Requirement 19.1
  // -------------------------------------------------------------------------
  router.post("/agent/memories", async (req, res) => {
    const { agentId, companyId } = assertAgentActor(req);

    const { memoryLayer, scopeId, key, value, memoryType, importance, expiresAt } = req.body;
    if (!memoryLayer || !key || !value || !memoryType) {
      throw badRequest("memoryLayer, key, value, and memoryType are required");
    }

    const memory = await memorySvc.writeMemory(companyId, agentId, {
      memoryLayer,
      scopeId: scopeId ?? null,
      key,
      value,
      memoryType,
      importance,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    await logActivity(db, {
      companyId,
      actorType: "agent",
      actorId: agentId,
      agentId,
      runId: req.actor.runId ?? null,
      action: "agent_memory.created",
      entityType: "agent_memory",
      entityId: memory!.id,
      details: { memoryLayer, key, selfService: true },
    });

    res.status(201).json(memory);
  });

  // -------------------------------------------------------------------------
  // POST /api/agent/skills/install — agent self-installs a skill
  // Requirement 19.3 — validates self_install permission
  // -------------------------------------------------------------------------
  router.post("/agent/skills/install", async (req, res) => {
    const { agentId, companyId } = assertAgentActor(req);

    const { skillId } = req.body;
    if (!skillId) {
      throw badRequest("skillId is required");
    }

    // Check that the agent has self_install permission.
    // The agent's permissions record may contain canInstallSkills (from
    // human-agent controls or direct agent permissions).
    const agent = await svc.getById(agentId);
    if (!agent) {
      throw forbidden("Agent not found");
    }

    const perms = agent.permissions as Record<string, unknown> | null;
    const canSelfInstall =
      perms && typeof perms === "object" && Boolean(perms.canInstallSkills);
    if (!canSelfInstall) {
      throw forbidden("Agent does not have self_install permission (canInstallSkills)");
    }

    const installed = await skillSvc.installSkill(
      companyId,
      agentId,
      skillId,
      "self_install",
      agentId, // installedBy = self
    );

    await logActivity(db, {
      companyId,
      actorType: "agent",
      actorId: agentId,
      agentId,
      runId: req.actor.runId ?? null,
      action: "agent_skill.installed",
      entityType: "agent_skill",
      entityId: installed!.id,
      details: { skillId, installType: "self_install", selfService: true },
    });

    res.status(201).json(installed);
  });

  // -------------------------------------------------------------------------
  // GET /api/agent/capabilities — discover other agents' capabilities
  // Requirement 19.4
  // -------------------------------------------------------------------------
  router.get("/agent/capabilities", async (req, res) => {
    const { companyId } = assertAgentActor(req);

    const needParam = typeof req.query.need === "string" ? req.query.need.trim() : "";
    const needTokens =
      needParam.length > 0
        ? needParam.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
        : [];

    if (needTokens.length === 0) {
      const matrix = await svc.getCapabilitiesMatrix(companyId);
      res.json(matrix);
      return;
    }

    // Filter by needs — same logic as the board discover endpoint
    const matrix = await svc.getCapabilitiesMatrix(companyId);
    const DIMENSIONS = ["languages", "frameworks", "domains", "tools", "customTags"] as const;

    const matched = matrix.filter((agent) => {
      const caps = agent.capabilities as Record<string, unknown> | null;
      if (!caps) return false;
      return needTokens.every((need) => {
        const lowerNeed = need.toLowerCase();
        return DIMENSIONS.some((dim) => {
          const values = caps[dim];
          if (!Array.isArray(values)) return false;
          return values.some((v: unknown) => typeof v === "string" && v.toLowerCase() === lowerNeed);
        });
      });
    });

    res.json(matched);
  });

  return router;
}
