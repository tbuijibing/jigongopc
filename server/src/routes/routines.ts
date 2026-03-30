import { Router, type Request } from "express";
import type { Db } from "@jigongai/db";
import {
  createRoutineSchema,
  updateRoutineSchema,
  createRoutineTriggerSchema,
  updateRoutineTriggerSchema,
  runRoutineSchema,
} from "@jigongai/shared/validators";
import { validate } from "../middleware/validate.js";
import { routineService, accessService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { forbidden, unauthorized } from "../errors.js";

export function routineRoutes(db: Db) {
  const router = Router();
  const svc = routineService(db);
  const access = accessService(db);

  async function assertBoardCanAssignTasks(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type !== "board") return;
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
    const allowed = await access.canUser(companyId, req.actor.userId, "tasks:assign");
    if (!allowed) {
      throw forbidden("Missing permission: tasks:assign");
    }
  }

  function assertCanManageCompanyRoutine(req: Request, companyId: string, assigneeAgentId?: string | null) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (req.actor.type !== "agent" || !req.actor.agentId) throw unauthorized();
    if (assigneeAgentId && assigneeAgentId !== req.actor.agentId) {
      throw forbidden("Agents can only manage routines assigned to themselves");
    }
  }

  async function assertCanManageExistingRoutine(req: Request, routineId: string) {
    const routine = await svc.get(routineId);
    if (!routine) return null;
    assertCompanyAccess(req, routine.companyId);
    if (req.actor.type === "board") return routine;
    if (req.actor.type !== "agent" || !req.actor.agentId) throw unauthorized();
    if (routine.assigneeAgentId !== req.actor.agentId) {
      throw forbidden("Agents can only manage routines assigned to themselves");
    }
    return routine;
  }

  // List routines
  router.get("/companies/:companyId/routines", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  // Create routine
  router.post("/companies/:companyId/routines", validate(createRoutineSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertBoardCanAssignTasks(req, companyId);
    assertCanManageCompanyRoutine(req, companyId, req.body.assigneeAgentId);

    const actor = getActorInfo(req);
    const created = await svc.create(companyId, req.body, {
      agentId: actor.actorType === "agent" ? actor.agentId : null,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "routine.created",
      entityType: "routine",
      entityId: created.id,
      details: { title: created.title, assigneeAgentId: created.assigneeAgentId },
    });

    res.status(201).json(created);
  });

  // Get routine detail
  router.get("/routines/:id", async (req, res) => {
    const detail = await svc.getDetail(req.params.id as string);
    if (!detail) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }
    assertCompanyAccess(req, detail.companyId);
    res.json(detail);
  });

  // Update routine
  router.patch("/routines/:id", validate(updateRoutineSchema), async (req, res) => {
    const routine = await assertCanManageExistingRoutine(req, req.params.id as string);
    if (!routine) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }

    const actor = getActorInfo(req);
    const updated = await svc.update(routine.id, req.body, {
      agentId: actor.actorType === "agent" ? actor.agentId : null,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });

    if (!updated) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }

    await logActivity(db, {
      companyId: routine.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "routine.updated",
      entityType: "routine",
      entityId: routine.id,
      details: { title: updated.title },
    });

    res.json(updated);
  });

  // Delete routine
  router.delete("/routines/:id", async (req, res) => {
    const routine = await assertCanManageExistingRoutine(req, req.params.id as string);
    if (!routine) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }

    const actor = getActorInfo(req);
    await svc.remove(routine.id);

    await logActivity(db, {
      companyId: routine.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "routine.deleted",
      entityType: "routine",
      entityId: routine.id,
    });

    res.json({ ok: true });
  });

  // Create trigger
  router.post(
    "/routines/:id/triggers",
    validate(createRoutineTriggerSchema),
    async (req, res) => {
      const routine = await assertCanManageExistingRoutine(req, req.params.id as string);
      if (!routine) {
        res.status(404).json({ error: "Routine not found" });
        return;
      }

      const actor = getActorInfo(req);
      const trigger = await svc.createTrigger(routine.companyId, {
        ...req.body,
        routineId: routine.id,
      }, {
        agentId: actor.actorType === "agent" ? actor.agentId : null,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });

      res.status(201).json(trigger);
    },
  );

  // Update trigger
  router.patch(
    "/routines/:routineId/triggers/:triggerId",
    validate(updateRoutineTriggerSchema),
    async (req, res) => {
      const routine = await assertCanManageExistingRoutine(req, req.params.routineId as string);
      if (!routine) {
        res.status(404).json({ error: "Routine not found" });
        return;
      }

      const actor = getActorInfo(req);
      const trigger = await svc.updateTrigger(req.params.triggerId as string, req.body, {
        agentId: actor.actorType === "agent" ? actor.agentId : null,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });

      if (!trigger) {
        res.status(404).json({ error: "Trigger not found" });
        return;
      }

      res.json(trigger);
    },
  );

  // Delete trigger
  router.delete("/routines/:routineId/triggers/:triggerId", async (req, res) => {
    const routine = await assertCanManageExistingRoutine(req, req.params.routineId as string);
    if (!routine) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }

    await svc.removeTrigger(req.params.triggerId as string);
    res.json({ ok: true });
  });

  // Run routine manually
  router.post("/routines/:id/run", validate(runRoutineSchema), async (req, res) => {
    const routine = await svc.get(req.params.id as string);
    if (!routine) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }
    assertCompanyAccess(req, routine.companyId);

    const run = await svc.createRun(routine.companyId, {
      routineId: routine.id,
      triggerId: null,
      source: "manual",
      triggerPayload: req.body.payload ?? null,
    });

    res.status(201).json(run);
  });

  return router;
}
