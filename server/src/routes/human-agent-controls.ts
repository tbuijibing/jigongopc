import { Router } from "express";
import type { Db } from "@jigongai/db";
import { humanAgentControlService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function humanAgentControlRoutes(db: Db) {
  const router = Router();
  const svc = humanAgentControlService(db);

  // GET /api/companies/:companyId/human-agent-controls?userId=
  router.get("/companies/:companyId/human-agent-controls", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = req.query.userId as string | undefined;
    const result = await svc.listControls(companyId, userId);
    res.json(result);
  });

  // POST /api/companies/:companyId/human-agent-controls
  router.post("/companies/:companyId/human-agent-controls", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { userId, agentId, isPrimary, permissions } = req.body;
    if (!userId || !agentId) {
      res.status(400).json({ error: "userId and agentId are required" });
      return;
    }

    const control = await svc.createControl(
      companyId,
      userId,
      agentId,
      isPrimary ?? false,
      permissions ?? {},
    );

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "human_agent_control.created",
      entityType: "human_agent_control",
      entityId: control!.id,
      details: { userId, agentId, isPrimary: isPrimary ?? false },
    });

    res.status(201).json(control);
  });

  // PUT /api/companies/:companyId/human-agent-controls/:controlId
  router.put("/companies/:companyId/human-agent-controls/:controlId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const controlId = req.params.controlId as string;
    assertCompanyAccess(req, companyId);

    const { isPrimary, permissions } = req.body;
    const updated = await svc.updateControl(companyId, controlId, { isPrimary, permissions });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "human_agent_control.updated",
      entityType: "human_agent_control",
      entityId: controlId,
      details: { isPrimary, permissions },
    });

    res.json(updated);
  });

  // DELETE /api/companies/:companyId/human-agent-controls/:controlId
  router.delete("/companies/:companyId/human-agent-controls/:controlId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const controlId = req.params.controlId as string;
    assertCompanyAccess(req, companyId);

    const deleted = await svc.deleteControl(companyId, controlId);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "human_agent_control.deleted",
      entityType: "human_agent_control",
      entityId: controlId,
      details: {
        userId: deleted.userId,
        agentId: deleted.agentId,
      },
    });

    res.json({ ok: true });
  });

  // GET /api/companies/:companyId/agents/:agentId/controllers
  router.get("/companies/:companyId/agents/:agentId/controllers", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.getControllers(companyId, agentId);
    res.json(result);
  });

  return router;
}
