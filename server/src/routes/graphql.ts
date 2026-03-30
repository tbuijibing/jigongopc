import { Router, json, type Request, type Response } from "express";
import type { Db } from "@jigongai/db";
import { createApolloServer, type GraphQLContext } from "../graphql/index.js";
import { expressMiddleware } from "@apollo/server/express4";

/**
 * GraphQL API Routes
 * Provides GraphQL endpoint for Template Marketplace and related functionality
 */

export function graphqlRoutes(db: Db): Router {
  const router = Router();

  // Create Apollo Server instance (lazy start to avoid uuid landing page issue)
  let server: ReturnType<typeof createApolloServer> | null = null;
  let serverStarted: Promise<void> | null = null;

  const ensureServerStarted = () => {
    if (!server) {
      server = createApolloServer(db);
      serverStarted = server.start();
    }
    return serverStarted;
  };

  // GraphQL endpoint with authentication context
  router.post(
    "/graphql",
    json({ limit: "10mb" }),
    async (req: Request, res: Response, next) => {
      // Wait for server to start
      await ensureServerStarted();

      if (!server) {
        return res.status(500).json({ error: "Server not initialized" });
      }

      // Build GraphQL context from request
      const context: GraphQLContext = {
        db,
        actor: req.actor ?? { type: "none" },
      };

      // Apply Apollo middleware with context
      const middleware = expressMiddleware(server, {
        context: async () => context,
      });

      return (middleware as unknown as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);
    },
  );

  // GraphQL GET endpoint for queries (useful for caching/GET requests)
  router.get(
    "/graphql",
    async (req: Request, res: Response, next) => {
      await ensureServerStarted();

      if (!server) {
        return res.status(500).json({ error: "Server not initialized" });
      }

      const context: GraphQLContext = {
        db,
        actor: req.actor ?? { type: "none" },
      };

      const middleware = expressMiddleware(server, {
        context: async () => context,
      });

      return (middleware as unknown as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);
    },
  );

  // GraphQL Playground/Explorer endpoint (only in development)
  if (process.env.NODE_ENV !== "production") {
    router.get("/graphql/playground", (_req: Request, res: Response) => {
      res.setHeader("Content-Type", "text/html");
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Apollo Server</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
  <link rel="shortcut icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.png" />
  <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
</head>
<body>
  <div id="root">
    <style>
      body {
        background-color: rgb(23, 42, 58);
        font-family: Open Sans, sans-serif;
        height: 90vh;
      }
      #root {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .loading {
        font-size: 32px;
        font-weight: 200;
        color: rgba(255, 255, 255, .6);
        margin-left: 20px;
      }
      img {
        width: 78px;
        height: 78px;
      }
      .title {
        font-weight: 400;
      }
    </style>
    <img src='https://cdn.jsdelivr.net/npm/graphql-playground-react/build/logo.png' alt=''>
    <div class="loading">
      Loading <span class="title">GraphQL Playground</span>
    </div>
  </div>
  <script>
    window.addEventListener('load', function (event) {
      GraphQLPlayground.init(document.getElementById('root'), {
        endpoint: '/api/graphql',
        settings: {
          'editor.theme': 'dark',
          'editor.cursorShape': 'line',
          'editor.fontSize': 14,
          'editor.reuseHeaders': true,
          'tracing.hideTracingResponse': true,
          'request.credentials': 'include',
        },
      })
    })
  </script>
</body>
</html>
      `);
    });
  }

  // Health check for GraphQL endpoint
  router.get("/graphql/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "graphql",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
