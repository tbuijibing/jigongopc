import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import type { Request, Response, NextFunction } from "express";
import type { Db } from "@jigongai/db";
import { typeDefs } from "./schema.js";
import {
  queryResolvers,
  mutationResolvers,
  fieldResolvers,
  JSONScalar,
  DateTimeScalar,
} from "./resolvers.js";

// ============================================
// Apollo Server Setup
// ============================================

export function createApolloServer(db: Db): ApolloServer<GraphQLContext> {
  const server = new ApolloServer({
    typeDefs,
    resolvers: {
      JSON: JSONScalar,
      DateTime: DateTimeScalar,
      Query: queryResolvers,
      Mutation: mutationResolvers,
      ...fieldResolvers,
    },
    formatError: (error) => {
      // Log error for debugging
      console.error("GraphQL Error:", error);

      // Return sanitized error to client
      return {
        message: error.message,
        code: error.extensions?.code ?? "INTERNAL_SERVER_ERROR",
        path: error.path,
      };
    },
    // Disable landing page to avoid uuid dependency issue
    introspection: true,
    plugins: [],
    // Explicitly disable the default landing page plugin
    stopOnTermination: false,
  });

  return server;
}

// ============================================
// Context Type
// ============================================

export interface GraphQLContext {
  db: Db;
  actor: {
    type: "board" | "agent" | "none";
    userId?: string;
    agentId?: string;
    companyId?: string;
    companyIds?: string[];
    isInstanceAdmin?: boolean;
  };
}

// ============================================
// Express Middleware Factory
// ============================================

export function createGraphQLMiddleware(db: Db) {
  const server = createApolloServer(db);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Start Apollo Server if not already started
      await server.start();

      // Create context from request
      const context: GraphQLContext = {
        db,
        actor: req.actor ?? { type: "none" },
      };

      // Apply Apollo middleware
      const middleware = expressMiddleware(server, {
        context: async () => context,
      });

      return (middleware as unknown as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

// ============================================
// Exports
// ============================================

export { typeDefs } from "./schema.js";
export { queryResolvers, mutationResolvers, fieldResolvers } from "./resolvers.js";
export * from "./types.js";
