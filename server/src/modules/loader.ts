/**
 * Minimal module loader for JiGong.
 *
 * Implements the ModuleAPI interface expected by modules (e.g. global-collab)
 * and wires their routes, hooks, and background services into the server.
 */

import { Router } from "express";
import type { Db } from "@jigongai/db";
import { agents } from "@jigongai/db";
import { eq, and, ne } from "drizzle-orm";
import { logger as pinoLogger } from "../middleware/logger.js";

// Re-export the ModuleAPI shape so modules don't need to import from their own types
interface ServiceDef {
  name: string;
  interval: number;
  run(ctx: { db: any }): Promise<void>;
}

interface CoreServices {
  agents: { findByCompany(companyId: string): Promise<Array<{ id: string; name: string; slug: string }>> };
  issues: any;
  projects: any;
  goals: any;
  activity: any;
}

interface ModuleAPI {
  moduleId: string;
  config: Record<string, unknown>;
  db: any;
  registerRoutes(router: any): void;
  on(event: string, handler: (...args: any[]) => Promise<void>): void;
  registerService(service: ServiceDef): void;
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void; warn: (...args: any[]) => void };
  core: CoreServices;
}

type RegisterFn = (api: ModuleAPI) => void;

interface LoadedModule {
  id: string;
  router: Router | null;
  services: ServiceDef[];
  timers: ReturnType<typeof setInterval>[];
}

const loaded: LoadedModule[] = [];

function buildCoreServices(db: Db): CoreServices {
  return {
    agents: {
      async findByCompany(companyId: string) {
        const rows = await (db as any)
          .select({ id: agents.id, name: agents.name })
          .from(agents)
          .where(and(eq(agents.companyId, companyId), ne(agents.status, "terminated")));
        // The module expects { id, name, slug } — use name as slug fallback
        return rows.map((r: any) => ({ id: r.id, name: r.name, slug: r.name }));
      },
    },
    // Stubs — modules that need these will get no-op implementations
    issues: {},
    projects: {},
    goals: {},
    activity: {},
  };
}

/**
 * Load and register a single module.
 * Returns the Express router (if any) to be mounted by the caller.
 */
function loadModule(
  moduleId: string,
  registerFn: RegisterFn,
  db: Db,
  config: Record<string, unknown>,
): LoadedModule {
  const mod: LoadedModule = { id: moduleId, router: null, services: [], timers: [] };
  const core = buildCoreServices(db);
  const childLogger = pinoLogger.child({ module: moduleId });

  const api: ModuleAPI = {
    moduleId,
    config,
    db,
    registerRoutes(router: Router) {
      mod.router = router;
    },
    on(_event: string, _handler: (...args: any[]) => Promise<void>) {
      // Event hooks are stored but not yet wired to core event bus.
      // This is a no-op bridge until the full event system is built.
      childLogger.info(`Hook registered for event: ${_event}`);
    },
    registerService(service: ServiceDef) {
      mod.services.push(service);
    },
    logger: {
      info: (...args: any[]) => childLogger.info(args[0], ...args.slice(1)),
      error: (...args: any[]) => childLogger.error(args[0], ...args.slice(1)),
      warn: (...args: any[]) => childLogger.warn(args[0], ...args.slice(1)),
    },
    core,
  };

  registerFn(api);

  // Start background services
  for (const svc of mod.services) {
    const timer = setInterval(() => {
      void svc.run({ db }).catch((err) => {
        childLogger.error({ err, service: svc.name }, `Module service ${svc.name} failed`);
      });
    }, svc.interval);
    mod.timers.push(timer);
    childLogger.info(`Background service started: ${svc.name} (interval: ${svc.interval}ms)`);
  }

  loaded.push(mod);
  return mod;
}

/**
 * Load all known modules and return a router that mounts them
 * under /api/modules/<moduleId>/.
 */
export async function loadModules(db: Db): Promise<Router> {
  const modulesRouter = Router();

  // ── global-collab ─────────────────────────────────────────────────────
  try {
    const globalCollabMod = await import("@jigongai/mod-global-collab");
    const registerFn = globalCollabMod.default as RegisterFn;
    const mod = loadModule("global-collab", registerFn, db, { enabled: true });
    if (mod.router) {
      // Bridge req.actor → x-user-id / x-company-id headers for module routes.
      // Module routes use getContext() which reads these headers.
      modulesRouter.use("/global-collab", (req, _res, next) => {
        const actor = req.actor;
        if (actor.type === "board" && actor.userId) {
          if (!req.headers["x-user-id"]) {
            req.headers["x-user-id"] = actor.userId;
          }
          // For board users, companyId comes from the request header (set by UI).
          // If not set and actor has companyIds, use the first one as fallback.
          if (!req.headers["x-company-id"] && actor.companyIds?.[0]) {
            req.headers["x-company-id"] = actor.companyIds[0];
          }
        } else if (actor.type === "agent" && actor.agentId && actor.companyId) {
          if (!req.headers["x-user-id"]) {
            req.headers["x-user-id"] = actor.agentId;
          }
          if (!req.headers["x-company-id"]) {
            req.headers["x-company-id"] = actor.companyId;
          }
        }
        next();
      }, mod.router);
      pinoLogger.info("Module mounted: global-collab → /api/modules/global-collab");
    }
  } catch (err) {
    pinoLogger.warn({ err }, "Failed to load global-collab module; skipping");
  }

  return modulesRouter;
}

/** Stop all background service timers (for graceful shutdown). */
export function stopModuleServices(): void {
  for (const mod of loaded) {
    for (const timer of mod.timers) {
      clearInterval(timer);
    }
    mod.timers.length = 0;
  }
}
