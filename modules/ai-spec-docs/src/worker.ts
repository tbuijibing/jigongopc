/**
 * ai-spec-docs — OPC Module
 *
 * 规范驱动的 AI 开发系统：老项目快速生成规范文件，AI 按规范完成 95% 工作，人类只做监督
 *
 * 提供以下能力：
 *   - REST API: GET /api/modules/ai-spec-docs/docs (列出文档)
 *              GET /api/modules/ai-spec-docs/docs/:path (读取文档)
 *              POST /api/modules/ai-spec-docs/docs (创建/更新文档)
 *
 * 核心设计：
 *   - 规范模板系统：AI 严格按照规范工作，不犯错
 *   - OPC 集成：使用 OPC 的 PARA 记忆系统和 Issue 事件系统
 */

import { Router, type Request, type Response } from "express";

// ── Module API 类型定义 ────────────────────────────────────────────────────────

interface ModuleAPI {
  moduleId: string;
  config: Record<string, unknown>;
  db: unknown;
  registerRoutes(router: Router): void;
  on(event: string, handler: (...args: unknown[]) => Promise<void>): void;
  registerService(service: { name: string; interval: number; run: (ctx: { db: unknown }) => Promise<void> }): void;
  logger: {
    info: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
  };
  core: {
    agents: {
      findByCompany(companyId: string): Promise<Array<{ id: string; name: string; slug: string }>>;
    };
  };
}

// ── 配置存储 ────────────────────────────────────────────────────────
// 模块级别的配置缓存，通过 /config 端点更新
let moduleConfig: Record<string, unknown> = {};

// ── 工具：调用 docspec-server HTTP API ──────────────────────────────────────

async function docspecFetch<T>(
  config: Record<string, unknown>,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const serverUrl = config.docspecServerUrl as string;
  const adminToken = config.docspecAdminToken as string;

  if (!serverUrl) {
    const error: any = new Error("docspecServerUrl not configured");
    (error as any).code = "DOCSPEC_NOT_CONFIGURED";
    throw error;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }

  const url = `${serverUrl.replace(/\/$/, "")}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`docspec API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ── API 路由实现 ────────────────────────────────────────────────────────

/**
 * GET /api/modules/ai-spec-docs/docs
 * 列出当前角色可访问的文档
 */
function registerDocsListRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.get("/docs", async (req: Request, res: Response) => {
    try {
      const { prefix = "", role } = req.query as { prefix?: string; role?: string };
      
      logger.info("[docs.list] Listing documents", { prefix, role });
      
      const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
      const roleQs = role ? `${qs ? qs + "&" : "?"}role=${encodeURIComponent(role)}` : "";
      
      const result = await docspecFetch<{
        role: string;
        count: number;
        files: Array<{ path: string; size: number; modifiedAt: string; write: boolean }>;
      }>(config, `/api/docs${qs || roleQs || ""}`);

      logger.info(`[docs.list] Found ${result.count} files`);
      res.json(result);
    } catch (error: any) {
      if (error?.code === "DOCSPEC_NOT_CONFIGURED") {
        logger.warn("[docs.list] docspec-server not configured");
        res.status(400).json({
          error: "docspec-server not configured",
          code: "DOCSPEC_NOT_CONFIGURED",
          message: "Please configure docspec-server connection in module settings"
        });
        return;
      }
      logger.error("[docs.list] Error", { error });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * GET /api/modules/ai-spec-docs/docs/:path
 * 读取指定文档内容
 */
function registerDocsReadRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.get("/docs/*", async (req: Request, res: Response) => {
    try {
      const docPath = req.params[0];
      const { role } = req.query as { role?: string };
      
      if (!docPath) {
        res.status(400).json({ error: "path is required" });
        return;
      }

      logger.info("[docs.read] Reading document", { path: docPath, role });

      const qs = role ? `?role=${encodeURIComponent(role)}` : "";
      
      const result = await docspecFetch<{
        path: string;
        content: string;
        metadata: Record<string, unknown>;
      }>(config, `/api/docs/${encodeURIComponent(docPath)}${qs}`);

      logger.info(`[docs.read] Read document: ${docPath}`);
      res.json(result);
    } catch (error: any) {
      if (error?.code === "DOCSPEC_NOT_CONFIGURED") {
        logger.warn("[docs.read] docspec-server not configured");
        res.status(400).json({
          error: "docspec-server not configured",
          code: "DOCSPEC_NOT_CONFIGURED",
          message: "Please configure docspec-server connection in module settings"
        });
        return;
      }
      logger.error("[docs.read] Error", { error });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * POST /api/modules/ai-spec-docs/docs
 * 创建或更新文档
 */
function registerDocsWriteRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.post("/docs", async (req: Request, res: Response) => {
    try {
      const { path, content, metadata } = req.body as { path: string; content: string; metadata?: Record<string, unknown> };
      
      if (!path || !content) {
        res.status(400).json({ error: "path and content are required" });
        return;
      }

      logger.info("[docs.write] Writing document", { path });

      const result = await docspecFetch<{
        path: string;
        success: boolean;
      }>(config, "/api/docs", {
        method: "POST",
        body: JSON.stringify({ path, content, metadata }),
      });

      logger.info(`[docs.write] Wrote document: ${path}`);
      res.json(result);
    } catch (error: any) {
      if (error?.code === "DOCSPEC_NOT_CONFIGURED") {
        logger.warn("[docs.write] docspec-server not configured");
        res.status(400).json({
          error: "docspec-server not configured",
          code: "DOCSPEC_NOT_CONFIGURED",
          message: "Please configure docspec-server connection in module settings"
        });
        return;
      }
      logger.error("[docs.write] Error", { error });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * GET /api/modules/ai-spec-docs/templates
 * 获取规范模板
 */
function registerTemplatesRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.get("/templates", async (req: Request, res: Response) => {
    try {
      const { type } = req.query as { type?: string };
      
      logger.info("[templates] Getting templates", { type });

      const result = await docspecFetch<Record<string, unknown>>(config, "/api/templates");

      logger.info("[templates] Got templates");
      res.json(result);
    } catch (error: any) {
      if (error?.code === "DOCSPEC_NOT_CONFIGURED") {
        logger.warn("[templates] docspec-server not configured");
        res.status(400).json({
          error: "docspec-server not configured",
          code: "DOCSPEC_NOT_CONFIGURED",
          message: "Please configure docspec-server connection in module settings"
        });
        return;
      }
      logger.error("[templates] Error", { error });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * POST /api/modules/ai-spec-docs/init
 * 初始化项目规范
 */
function registerInitRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.post("/init", async (req: Request, res: Response) => {
    try {
      const { projectName, template } = req.body as { projectName: string; template?: string };
      
      if (!projectName) {
        res.status(400).json({ error: "projectName is required" });
        return;
      }

      logger.info("[init] Initializing project", { projectName, template });

      const result = await docspecFetch<{ success: boolean; projectId: string }>(config, "/api/init", {
        method: "POST",
        body: JSON.stringify({ projectName, template }),
      });

      logger.info("[init] Project initialized");
      res.json(result);
    } catch (error: any) {
      if (error?.code === "DOCSPEC_NOT_CONFIGURED") {
        logger.warn("[init] docspec-server not configured");
        res.status(400).json({
          error: "docspec-server not configured",
          code: "DOCSPEC_NOT_CONFIGURED",
          message: "Please configure docspec-server connection in module settings"
        });
        return;
      }
      logger.error("[init] Error", { error });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * GET /api/modules/ai-spec-docs/health
 * 健康检查
 *
 * 注意：配置由 OPC 系统管理，通过 POST /api/modules/ai-spec-docs/config 设置
 * 配置存储在 OPC 数据库中，模块启动时 config 对象是静态的
 * 此端点返回当前模块内存中的配置状态
 */
function registerHealthRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.get("/health", (_req: Request, res: Response) => {
    // 从 moduleConfig 缓存读取配置，而不是从静态的 config 参数
    // 这样配置可以通过 /config 端点动态更新
    const serverUrl = moduleConfig.docspecServerUrl as string;
    const adminToken = moduleConfig.docspecAdminToken as string;
    res.json({
      status: "ok",
      docspecServerUrl: serverUrl ? "configured" : "not configured",
      docspecAdminToken: adminToken ? "configured" : "not configured",
      config: {
        docspecServerUrl: serverUrl || null,
        docspecAdminToken: adminToken ? "***" : null,
      },
    });
  });
}

/**
 * POST /api/modules/ai-spec-docs/config
 * 配置 docspec-server 连接信息
 */
function registerConfigRoute(router: Router, config: Record<string, unknown>, logger: ModuleAPI["logger"]) {
  router.post("/config", async (req: Request, res: Response) => {
    try {
      const { key, value } = req.body as { key: string; value: string };
      
      if (!key || value === undefined) {
        res.status(400).json({ error: "key and value are required" });
        return;
      }

      logger.info("[config] Setting configuration", { key });

      // 验证配置键
      const validKeys = ["docspecServerUrl", "docspecAdminToken"];
      if (!validKeys.includes(key)) {
        res.status(400).json({ error: `Invalid config key. Valid keys are: ${validKeys.join(", ")}` });
        return;
      }

      // 更新模块级别的配置缓存
      moduleConfig[key] = value;
      
      // 注意：实际配置存储由 OPC 系统处理，这里仅返回成功响应
      // OPC 会将配置持久化到数据库中
      logger.info(`[config] Configuration set: ${key} = ${key.includes("Token") ? "***" : value}`);
      res.json({ success: true, key, message: "Configuration updated successfully" });
    } catch (error) {
      logger.error("[config] Error", { error });
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}

// ── 模块入口 ────────────────────────────────────────────────────────

/**
 * 模块入口函数
 * OPC 系统会在模块安装时调用此函数
 */
export default function setup(api: ModuleAPI) {
  const { logger, config } = api;
  
  logger.info("[ai-spec-docs] Setting up module");

  const router = Router();

  // 注册路由
  registerConfigRoute(router, config, logger);
  registerHealthRoute(router, config, logger);
  registerDocsListRoute(router, config, logger);
  registerDocsReadRoute(router, config, logger);
  registerDocsWriteRoute(router, config, logger);
  registerTemplatesRoute(router, config, logger);
  registerInitRoute(router, config, logger);

  // 注册事件监听
  api.on("issue:created", async (payload) => {
    logger.info("[ai-spec-docs] Issue created", payload);
  });

  api.on("issue:assigned", async (payload) => {
    logger.info("[ai-spec-docs] Issue assigned", payload);
  });

  // 注册后台服务（可选）
  api.registerService({
    name: "docspec-cache-cleanup",
    interval: 3600000, // 1 hour
    run: async ({ db }) => {
      logger.info("[ai-spec-docs] Running cache cleanup");
      // TODO: Implement cache cleanup logic
    },
  });

  // 注册路由
  api.registerRoutes(router);

  logger.info("[ai-spec-docs] Module setup complete");
}
