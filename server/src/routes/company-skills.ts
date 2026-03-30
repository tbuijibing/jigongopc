import { Router, type Request } from "express";
import type { Db } from "@jigongai/db";
import {
  companySkillCreateSchema,
  companySkillUpdateSchema,
  companySkillFileUpdateSchema,
  companySkillImportSchema,
} from "@jigongai/shared/validators";
import { validate } from "../middleware/validate.js";
import { companySkillService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { forbidden } from "../errors.js";

export function companySkillRoutes(db: Db) {
  const router = Router();
  const svc = companySkillService(db);

  async function assertCanManageCompanySkills(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);

    if (req.actor.type === "board") {
      if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
      // Check if user has permission to manage skills
      return;
    }

    if (!req.actor.agentId) {
      throw forbidden("Agent authentication required");
    }
  }

  // List all company skills
  router.get("/companies/:companyId/skills", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  // Get skill detail
  router.get("/companies/:companyId/skills/:skillId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const skillId = req.params.skillId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.detail(companyId, skillId);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  // Get skill update status
  router.get("/companies/:companyId/skills/:skillId/update-status", async (req, res) => {
    const companyId = req.params.companyId as string;
    const skillId = req.params.skillId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.updateStatus(companyId, skillId);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  // Read skill file
  router.get("/companies/:companyId/skills/:skillId/files", async (req, res) => {
    const companyId = req.params.companyId as string;
    const skillId = req.params.skillId as string;
    const relativePath = String(req.query.path ?? "SKILL.md");
    assertCompanyAccess(req, companyId);
    const result = await svc.readFile(companyId, skillId, relativePath);
    if (!result) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }
    res.json(result);
  });

  // Create skill
  router.post(
    "/companies/:companyId/skills",
    validate(companySkillCreateSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertCanManageCompanySkills(req, companyId);

      const actor = getActorInfo(req);
      const created = await svc.create(companyId, req.body);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "skill.created",
        entityType: "skill",
        entityId: created.id,
        details: { name: created.name, key: created.key },
      });

      res.status(201).json(created);
    },
  );

  // Update skill
  router.patch(
    "/companies/:companyId/skills/:skillId",
    validate(companySkillUpdateSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const skillId = req.params.skillId as string;
      await assertCanManageCompanySkills(req, companyId);

      const actor = getActorInfo(req);
      const updated = await svc.update(companyId, skillId, req.body);

      if (!updated) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "skill.updated",
        entityType: "skill",
        entityId: skillId,
        details: { name: updated.name },
      });

      res.json(updated);
    },
  );

  // Delete skill
  router.delete("/companies/:companyId/skills/:skillId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const skillId = req.params.skillId as string;
    await assertCanManageCompanySkills(req, companyId);

    const actor = getActorInfo(req);
    await svc.remove(companyId, skillId);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "skill.deleted",
      entityType: "skill",
      entityId: skillId,
    });

    res.json({ ok: true });
  });

  return router;
}
