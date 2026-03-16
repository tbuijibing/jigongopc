import type { Db } from "@jigongai/db";
import crypto from "node:crypto";
import {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  sql,
  lt,
  gt,
  inArray,
  isNull,
  gte,
  lte,
} from "drizzle-orm";
import {
  companyTemplates,
  templateWorkflows,
  templateLineages,
  creatorRevenueAccounts,
  creatorRevenueDistributions,
  creatorPayoutRequests,
  revenueRecords,
  templateRevenueStats,
  templateSubscriptions,
  templateMarketplace,
  companies,
} from "@jigongai/db";
import type {
  Template,
  TemplateVersion,
  TemplateLineage,
  Creator,
  RevenueStats,
  Purchase,
  PurchaseResult,
  InstallResult,
  ForkResult,
  WithdrawalRequest,
  PaginationInput,
  TemplateFilters,
  TemplateSortInput,
} from "./types.js";
import { paymentService } from "../services/payment.js";
import { templateEngineService } from "../services/template-engine.js";
import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

// ============================================
// Custom Scalar Resolvers
// ============================================

export const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "JSON scalar type for dynamic objects",
  serialize(value: unknown): unknown {
    return value;
  },
  parseValue(value: unknown): unknown {
    return value;
  },
  parseLiteral(ast): unknown {
    if (ast.kind === Kind.STRING) {
      try {
        return JSON.parse(ast.value);
      } catch {
        return ast.value;
      }
    }
    if (ast.kind === Kind.OBJECT) {
      return ast.fields.reduce((acc, field) => {
        acc[field.name.value] = field.value;
        return acc;
      }, {} as Record<string, unknown>);
    }
    if (ast.kind === Kind.LIST) {
      return ast.values.map((v) => this.parseLiteral?.(v) ?? v);
    }
    return null;
  },
});

export const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO 8601 DateTime scalar type",
  serialize(value: unknown): string | null {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number") {
      return new Date(value).toISOString();
    }
    return null;
  },
  parseValue(value: unknown): Date {
    if (typeof value === "string") {
      return new Date(value);
    }
    if (typeof value === "number") {
      return new Date(value);
    }
    throw new Error("DateTime must be a string or number");
  },
  parseLiteral(ast): Date | null {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

// ============================================
// Cursor Encoding/Decoding
// ============================================

function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
  } catch {
    throw new GraphQLError("Invalid cursor");
  }
}

// ============================================
// Helper Functions
// ============================================

function requireAuth(context: GraphQLContext): GraphQLContext["actor"] {
  if (!context.actor?.userId && !context.actor?.agentId) {
    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.actor;
}

function requireBoardUser(context: GraphQLContext): string {
  if (context.actor?.type !== "board" || !context.actor.userId) {
    throw new GraphQLError("Board user access required", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return context.actor.userId;
}

interface GraphQLContext {
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
// Query Resolvers
// ============================================

export const queryResolvers = {
  // ----------------------------------------
  // Template Queries
  // ----------------------------------------

  async templates(
    _: unknown,
    {
      query,
      filters,
      sort,
      pagination,
    }: {
      query?: string;
      filters?: TemplateFilters;
      sort?: TemplateSortInput;
      pagination?: PaginationInput;
    },
    context: GraphQLContext,
  ) {
    const { db } = context;
    const limit = pagination?.first ?? 20;
    const after = pagination?.after;

    // Build where conditions
    const whereConditions = [eq(companyTemplates.visibility, "public")];

    if (query) {
      whereConditions.push(
        or(
          like(companyTemplates.name, `%${query}%`),
          like(companyTemplates.description, `%${query}%`),
          sql`${companyTemplates.tags}::text ILIKE ${`%${query}%`}`,
        )!,
      );
    }

    if (filters?.category) {
      whereConditions.push(eq(companyTemplates.category, filters.category.toLowerCase()));
    }

    if (filters?.status) {
      whereConditions.push(eq(companyTemplates.status, filters.status.toLowerCase()));
    }

    if (filters?.pricingType) {
      whereConditions.push(eq(companyTemplates.pricingType, filters.pricingType.toLowerCase()));
    }

    if (filters?.priceMin !== undefined) {
      whereConditions.push(gte(companyTemplates.price, filters.priceMin.toString()));
    }

    if (filters?.priceMax !== undefined) {
      whereConditions.push(lte(companyTemplates.price, filters.priceMax.toString()));
    }

    if (filters?.creatorId) {
      whereConditions.push(eq(companyTemplates.createdBy, filters.creatorId));
    }

    if (filters?.tags && filters.tags.length > 0) {
      whereConditions.push(
        sql`${companyTemplates.tags}::text[] && ${filters.tags}::text[]`,
      );
    }

    if (filters?.createdAfter) {
      whereConditions.push(gte(companyTemplates.createdAt, filters.createdAfter));
    }

    if (filters?.createdBefore) {
      whereConditions.push(lte(companyTemplates.createdAt, filters.createdBefore));
    }

    // Build order by
    let orderBy: ReturnType<typeof desc> | ReturnType<typeof asc> = desc(companyTemplates.createdAt);
    const sortField = sort?.field ?? "CREATED_AT";
    const sortDirection = sort?.direction ?? "DESC";

    switch (sortField) {
      case "CREATED_AT":
        orderBy = sortDirection === "DESC" ? desc(companyTemplates.createdAt) : asc(companyTemplates.createdAt);
        break;
      case "UPDATED_AT":
        orderBy = sortDirection === "DESC" ? desc(companyTemplates.updatedAt) : asc(companyTemplates.updatedAt);
        break;
      case "PRICE":
        orderBy = sortDirection === "DESC" ? desc(companyTemplates.price) : asc(companyTemplates.price);
        break;
      case "NAME":
        orderBy = sortDirection === "DESC" ? desc(companyTemplates.name) : asc(companyTemplates.name);
        break;
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companyTemplates)
      .where(and(...whereConditions));
    const totalCount = countResult[0]?.count ?? 0;

    // Build cursor-based pagination
    let cursorCondition = undefined;
    if (after) {
      const decoded = decodeCursor(after);
      const cursorDate = new Date(decoded.createdAt as string);
      if (sortDirection === "DESC") {
        cursorCondition = lt(companyTemplates.createdAt, cursorDate);
      } else {
        cursorCondition = gt(companyTemplates.createdAt, cursorDate);
      }
    }

    const finalWhere = cursorCondition
      ? and(and(...whereConditions), cursorCondition)
      : and(...whereConditions);

    // Fetch templates
    const templates = await db
      .select()
      .from(companyTemplates)
      .where(finalWhere)
      .orderBy(orderBy)
      .limit(limit + 1);

    const hasNextPage = templates.length > limit;
    const nodes = hasNextPage ? templates.slice(0, limit) : templates;

    const edges = nodes.map((template) => ({
      node: mapTemplateToGraphQL(template),
      cursor: encodeCursor({ createdAt: template.createdAt.toISOString(), id: template.id }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(after),
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  async template(_: unknown, { id }: { id: string }, context: GraphQLContext) {
    const { db } = context;
    const template = await db
      .select()
      .from(companyTemplates)
      .where(eq(companyTemplates.id, id))
      .then((rows) => rows[0] ?? null);

    if (!template) {
      throw new GraphQLError("Template not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    return mapTemplateToGraphQL(template);
  },

  async templateBySlug(_: unknown, { slug }: { slug: string }, context: GraphQLContext) {
    const { db } = context;
    const template = await db
      .select()
      .from(companyTemplates)
      .where(eq(companyTemplates.slug, slug))
      .then((rows) => rows[0] ?? null);

    if (!template) {
      throw new GraphQLError("Template not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    return mapTemplateToGraphQL(template);
  },

  // ----------------------------------------
  // Version Queries
  // ----------------------------------------

  async templateVersions(
    _: unknown,
    { templateId, pagination }: { templateId: string; pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const { db } = context;
    const limit = pagination?.first ?? 20;

    const versions = await db
      .select()
      .from(templateWorkflows)
      .where(eq(templateWorkflows.templateId, templateId))
      .orderBy(desc(templateWorkflows.createdAt))
      .limit(limit);

    return versions.map(mapVersionToGraphQL);
  },

  async templateVersion(_: unknown, { id }: { id: string }, context: GraphQLContext) {
    const { db } = context;
    const version = await db
      .select()
      .from(templateWorkflows)
      .where(eq(templateWorkflows.id, id))
      .then((rows) => rows[0] ?? null);

    if (!version) {
      throw new GraphQLError("Template version not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    return mapVersionToGraphQL(version);
  },

  // ----------------------------------------
  // Lineage Queries
  // ----------------------------------------

  async templateLineage(_: unknown, { templateId }: { templateId: string }, context: GraphQLContext) {
    const { db } = context;
    const lineage = await db
      .select()
      .from(templateLineages)
      .where(eq(templateLineages.descendantId, templateId))
      .then((rows) => rows[0] ?? null);

    if (!lineage) {
      return null;
    }

    return mapLineageToGraphQL(lineage);
  },

  async templateForks(
    _: unknown,
    { templateId, pagination }: { templateId: string; pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const { db } = context;
    const limit = pagination?.first ?? 20;
    const after = pagination?.after;

    // Get all descendants
    const lineages = await db
      .select()
      .from(templateLineages)
      .where(eq(templateLineages.ancestorId, templateId))
      .orderBy(desc(templateLineages.createdAt))
      .limit(limit + 1);

    const descendantIds = lineages.map((l) => l.descendantId);

    if (descendantIds.length === 0) {
      return {
        edges: [],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
        totalCount: 0,
      };
    }

    const templates = await db
      .select()
      .from(companyTemplates)
      .where(inArray(companyTemplates.id, descendantIds));

    const templateMap = new Map(templates.map((t) => [t.id, t]));

    const edges = lineages.map((lineage) => {
      const template = templateMap.get(lineage.descendantId);
      return {
        node: template ? mapTemplateToGraphQL(template) : null,
        cursor: encodeCursor({ createdAt: lineage.createdAt.toISOString(), id: lineage.id }),
      };
    }).filter((e) => e.node !== null);

    const hasNextPage = lineages.length > limit;

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(after),
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount: edges.length,
    };
  },

  async templateAncestors(_: unknown, { templateId }: { templateId: string }, context: GraphQLContext) {
    const { db } = context;

    // Get the lineage chain
    const lineage = await db
      .select()
      .from(templateLineages)
      .where(eq(templateLineages.descendantId, templateId))
      .then((rows) => rows[0] ?? null);

    if (!lineage || !lineage.path) {
      return [];
    }

    // Parse path to get ancestor IDs
    const ancestorIds = (lineage.path as string[]).filter((id) => id !== templateId);

    if (ancestorIds.length === 0) {
      return [];
    }

    const templates = await db
      .select()
      .from(companyTemplates)
      .where(inArray(companyTemplates.id, ancestorIds));

    // Order by path order
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    return ancestorIds
      .map((id) => templateMap.get(id))
      .filter(Boolean)
      .map((t) => mapTemplateToGraphQL(t!));
  },

  // ----------------------------------------
  // Creator Queries
  // ----------------------------------------

  async creator(_: unknown, { id }: { id: string }, context: GraphQLContext) {
    const { db } = context;
    const account = await db
      .select()
      .from(creatorRevenueAccounts)
      .where(eq(creatorRevenueAccounts.id, id))
      .then((rows) => rows[0] ?? null);

    if (!account) {
      throw new GraphQLError("Creator not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    return mapCreatorToGraphQL(account);
  },

  async creatorByUserId(_: unknown, { userId }: { userId: string }, context: GraphQLContext) {
    const { db } = context;
    const account = await db
      .select()
      .from(creatorRevenueAccounts)
      .where(eq(creatorRevenueAccounts.userId, userId))
      .then((rows) => rows[0] ?? null);

    if (!account) {
      return null;
    }

    return mapCreatorToGraphQL(account);
  },

  async topCreators(
    _: unknown,
    { pagination }: { pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const { db } = context;
    const limit = pagination?.first ?? 20;

    const accounts = await db
      .select()
      .from(creatorRevenueAccounts)
      .orderBy(desc(creatorRevenueAccounts.totalEarned))
      .limit(limit);

    return accounts.map(mapCreatorToGraphQL);
  },

  // ----------------------------------------
  // My Queries (Authenticated)
  // ----------------------------------------

  async myRevenue(_: unknown, __: unknown, context: GraphQLContext): Promise<RevenueStats> {
    const userId = requireBoardUser(context);
    const { db } = context;

    const account = await db
      .select()
      .from(creatorRevenueAccounts)
      .where(eq(creatorRevenueAccounts.userId, userId))
      .then((rows) => rows[0] ?? null);

    if (!account) {
      return {
        totalEarned: 0,
        availableBalance: 0,
        withdrawnAmount: 0,
        pendingAmount: 0,
        bySource: [],
        byMonth: [],
        currency: "USD",
        payouts: [],
      };
    }

    // Get revenue breakdown by source
    const sourceStats = await db
      .select({
        source: revenueRecords.sourceType,
        total: sql<number>`sum(${revenueRecords.directCreatorShare})`,
        count: sql<number>`count(*)`,
      })
      .from(revenueRecords)
      .where(eq(revenueRecords.templateId, account.id))
      .groupBy(revenueRecords.sourceType);

    const bySource = sourceStats.map((s) => ({
      source: s.source ?? "unknown",
      amount: Number(s.total ?? 0),
      count: s.count ?? 0,
    }));

    // Get monthly revenue
    const monthlyStats = await db
      .select({
        month: sql<string>`date_trunc('month', ${revenueRecords.createdAt})::text`,
        total: sql<number>`sum(${revenueRecords.directCreatorShare})`,
        count: sql<number>`count(*)`,
      })
      .from(revenueRecords)
      .where(eq(revenueRecords.templateId, account.id))
      .groupBy(sql`date_trunc('month', ${revenueRecords.createdAt})`)
      .orderBy(desc(sql`date_trunc('month', ${revenueRecords.createdAt})`))
      .limit(12);

    const byMonth = monthlyStats.map((m) => ({
      month: m.month,
      amount: Number(m.total ?? 0),
      sales: m.count ?? 0,
    }));

    // Get payout history
    const payouts = await db
      .select()
      .from(creatorPayoutRequests)
      .where(eq(creatorPayoutRequests.accountId, account.id))
      .orderBy(desc(creatorPayoutRequests.createdAt))
      .limit(50);

    return {
      totalEarned: Number(account.totalEarned),
      availableBalance: Number(account.availableBalance),
      withdrawnAmount: Number(account.withdrawnAmount),
      pendingAmount: Number(account.pendingAmount),
      bySource,
      byMonth,
      currency: "USD",
      payouts: payouts.map(mapPayoutToGraphQL),
    };
  },

  async myTemplates(
    _: unknown,
    { pagination }: { pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const userId = requireBoardUser(context);
    const { db } = context;
    const limit = pagination?.first ?? 20;

    const templates = await db
      .select()
      .from(companyTemplates)
      .where(eq(companyTemplates.createdBy, userId))
      .orderBy(desc(companyTemplates.createdAt))
      .limit(limit);

    return templates.map(mapTemplateToGraphQL);
  },

  async myPurchases(
    _: unknown,
    { pagination }: { pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const userId = requireBoardUser(context);
    const { db } = context;
    const limit = pagination?.first ?? 20;

    // Query template subscriptions as purchases
    const subscriptions = await db
      .select()
      .from(templateSubscriptions)
      .where(eq(templateSubscriptions.subscribedBy, userId))
      .orderBy(desc(templateSubscriptions.createdAt))
      .limit(limit);

    return subscriptions.map(mapSubscriptionToPurchase);
  },

  async myInstalls(_: unknown, __: unknown, context: GraphQLContext) {
    const userId = requireBoardUser(context);
    const { db } = context;

    const subscriptions = await db
      .select()
      .from(templateSubscriptions)
      .where(and(
        eq(templateSubscriptions.subscribedBy, userId),
        eq(templateSubscriptions.status, "active"),
      ));

    const templateIds = subscriptions.map((s) => s.templateId);

    if (templateIds.length === 0) {
      return [];
    }

    const templates = await db
      .select()
      .from(companyTemplates)
      .where(inArray(companyTemplates.id, templateIds));

    return templates.map(mapTemplateToGraphQL);
  },

  // ----------------------------------------
  // Search
  // ----------------------------------------

  async searchTemplates(
    _: unknown,
    { query: searchQuery, pagination }: { query: string; pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const { db } = context;
    const limit = pagination?.first ?? 20;

    const whereConditions = [
      eq(companyTemplates.visibility, "public"),
      or(
        like(companyTemplates.name, `%${searchQuery}%`),
        like(companyTemplates.description, `%${searchQuery}%`),
        sql`${companyTemplates.tags}::text ILIKE ${`%${searchQuery}%`}`,
      )!,
    ];

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companyTemplates)
      .where(and(...whereConditions));
    const totalCount = countResult[0]?.count ?? 0;

    const templates = await db
      .select()
      .from(companyTemplates)
      .where(and(...whereConditions))
      .orderBy(desc(companyTemplates.downloadCount))
      .limit(limit);

    const edges = templates.map((template) => ({
      node: mapTemplateToGraphQL(template),
      cursor: encodeCursor({ createdAt: template.createdAt.toISOString(), id: template.id }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: templates.length === limit,
        hasPreviousPage: false,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  async searchCreators(
    _: unknown,
    { query: searchQuery, pagination }: { query: string; pagination?: PaginationInput },
    context: GraphQLContext,
  ) {
    const { db } = context;
    const limit = pagination?.first ?? 20;

    // Note: This is a simplified search - in production you'd want full-text search
    const accounts = await db
      .select()
      .from(creatorRevenueAccounts)
      .limit(limit);

    return accounts.map(mapCreatorToGraphQL);
  },
};

// ============================================
// Mutation Resolvers
// ============================================

export const mutationResolvers = {
  // ----------------------------------------
  // Purchase and Install
  // ----------------------------------------

  async purchaseTemplate(
    _: unknown,
    { templateId, paymentMethod, amount }: { templateId: string; paymentMethod: string; amount?: number },
    context: GraphQLContext,
  ): Promise<PurchaseResult> {
    const userId = requireBoardUser(context);
    const { db } = context;

    try {
      // Get template
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, templateId))
        .then((rows) => rows[0] ?? null);

      if (!template) {
        return { success: false, error: "Template not found" };
      }

      const purchaseAmount = amount ?? Number(template.price);

      // Create order
      const order = {
        id: `order_${crypto.randomUUID()}`,
        userId,
        companyId: template.companyId,
        amount: Math.round(purchaseAmount * 100), // Convert to cents
        currency: template.currency ?? "USD",
        description: `Purchase template: ${template.name}`,
        metadata: {
          templateId,
          type: "template_purchase",
        },
      };

      // Create payment intent
      const paymentSvc = paymentService(db);
      const intent = await paymentSvc.createPaymentIntent(
        order,
        paymentMethod.toLowerCase() as "balance" | "stripe" | "alipay" | "wechat_pay"
      );

      return {
        success: true,
        purchase: {
          id: intent.id,
          templateId,
          buyerCompanyId: template.companyId,
          buyerUserId: userId,
          amount: purchaseAmount,
          currency: template.currency ?? "USD",
          pricingType: ((template.pricingType as string)?.toUpperCase() ?? "FREE") as Purchase["pricingType"],
          status: "PENDING" as Purchase["status"],
          paymentMethod: paymentMethod.toUpperCase() as Purchase["paymentMethod"],
          paymentIntentId: intent.id,
          createdAt: new Date(),
        },
        requiresAction: intent.status === "pending",
        clientSecret: intent.clientSecret,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async installTemplate(
    _: unknown,
    { templateId }: { templateId: string },
    context: GraphQLContext,
  ): Promise<InstallResult> {
    const userId = requireBoardUser(context);
    const { db } = context;

    try {
      // Get user's company
      const actor = context.actor;
      if (!actor.companyIds || actor.companyIds.length === 0) {
        return { success: false, status: "FAILED", error: "No company associated with user" };
      }

      const companyId = actor.companyIds[0];

      // Get template
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, templateId))
        .then((rows) => rows[0] ?? null);

      if (!template) {
        return { success: false, status: "FAILED", error: "Template not found" };
      }

      // Check if already installed
      const existingSubscription = await db
        .select()
        .from(templateSubscriptions)
        .where(and(
          eq(templateSubscriptions.companyId, companyId),
          eq(templateSubscriptions.templateId, templateId)
        ))
        .then((rows) => rows[0] ?? null);

      if (existingSubscription) {
        return {
          success: true,
          subscriptionId: existingSubscription.id,
          status: "INSTALLED",
          message: "Template already installed",
        };
      }

      // Create new subscription
      const [subscription] = await db
        .insert(templateSubscriptions)
        .values({
          companyId,
          templateId,
          autoUpdate: false,
          updateChannel: "stable",
        })
        .returning();

      return {
        success: true,
        subscriptionId: subscription.id,
        status: "INSTALLED",
        message: "Template installed successfully",
      };
    } catch (error) {
      return {
        success: false,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async uninstallTemplate(
    _: unknown,
    { subscriptionId }: { subscriptionId: string },
    context: GraphQLContext,
  ): Promise<boolean> {
    const userId = requireBoardUser(context);
    const { db } = context;

    try {
      // Update subscription status to inactive
      await db
        .update(templateSubscriptions)
        .set({
          status: "inactive",
          updatedAt: new Date(),
        })
        .where(eq(templateSubscriptions.id, subscriptionId));
      return true;
    } catch {
      return false;
    }
  },

  // ----------------------------------------
  // Fork
  // ----------------------------------------

  async forkTemplate(
    _: unknown,
    { input }: { input: { templateId: string; customizations?: Record<string, unknown>; newName?: string; newSlug?: string } },
    context: GraphQLContext,
  ): Promise<ForkResult> {
    const userId = requireBoardUser(context);
    const { db } = context;

    try {
      const actor = context.actor;
      if (!actor.companyIds || actor.companyIds.length === 0) {
        return { success: false, error: "No company associated with user" };
      }

      const companyId = actor.companyIds[0];

      const engineSvc = templateEngineService(db);
      const result = await engineSvc.forkTemplate(
        input.templateId,
        companyId,
        userId,
        input.customizations ?? {}
      );

      if (!result.success || !result.newTemplateId) {
        return { success: false, error: result.error ?? "Fork failed" };
      }

      // Get the forked template
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, result.newTemplateId))
        .then((rows) => rows[0] ?? null);

      if (!template) {
        return { success: false, error: "Failed to retrieve forked template" };
      }

      return {
        success: true,
        template: mapTemplateToGraphQL(template),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // ----------------------------------------
  // Publishing
  // ----------------------------------------

  async publishTemplate(
    _: unknown,
    { input }: { input: Record<string, unknown> },
    context: GraphQLContext,
  ): Promise<Template> {
    const userId = requireBoardUser(context);
    const { db } = context;

    const actor = context.actor;
    if (!actor.companyIds || actor.companyIds.length === 0) {
      throw new GraphQLError("No company associated with user");
    }

    const companyId = actor.companyIds[0];

    // Create template
    const [template] = await db
      .insert(companyTemplates)
      .values({
        companyId,
        name: input.name as string,
        slug: (input.slug as string) ?? input.name as string,
        description: input.description as string,
        shortDescription: input.shortDescription as string,
        category: (input.category as string)?.toLowerCase() ?? "custom",
        tags: (input.tags as string[]) ?? [],
        status: "draft",
        visibility: (input.visibility as string)?.toLowerCase() ?? "private",
        pricingType: (input.pricingType as string)?.toLowerCase() ?? "free",
        price: String(input.price ?? 0),
        currency: (input.currency as string) ?? "USD",
        iconUrl: input.iconUrl as string,
        coverImages: (input.coverImages as string[]) ?? [],
        previewUrl: input.previewUrl as string,
        documentationUrl: input.documentationUrl as string,
        metadata: (input.metadata as Record<string, unknown>) ?? {},
        settings: (input.settings as Record<string, unknown>) ?? {},
        createdBy: userId,
      })
      .returning();

    if (!template) {
      throw new GraphQLError("Failed to create template");
    }

    // Create initial version if provided
    if (input.workflowDefinition) {
      await db.insert(templateWorkflows).values({
        templateId: template.id,
        companyId,
        name: input.versionName as string ?? "v1.0.0",
        description: input.versionDescription as string,
        version: input.version as string ?? "1.0.0",
        workflowDefinition: input.workflowDefinition as Record<string, unknown>,
        nodeDefinitions: (input.nodeDefinitions as Record<string, unknown>) ?? {},
        roleDefinitions: (input.roleDefinitions as Record<string, unknown>) ?? {},
        deliverableDefinitions: (input.deliverableDefinitions as Record<string, unknown>) ?? {},
        createdBy: userId,
      });

      // Update template with current version
      await db
        .update(companyTemplates)
        .set({ currentVersionId: template.id })
        .where(eq(companyTemplates.id, template.id));
    }

    return mapTemplateToGraphQL(template);
  },

  async updateTemplate(
    _: unknown,
    { id, input }: { id: string; input: Record<string, unknown> },
    context: GraphQLContext,
  ): Promise<Template> {
    requireBoardUser(context);
    const { db } = context;

    const template = await db
      .select()
      .from(companyTemplates)
      .where(eq(companyTemplates.id, id))
      .then((rows) => rows[0] ?? null);

    if (!template) {
      throw new GraphQLError("Template not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.shortDescription !== undefined) updateData.shortDescription = input.shortDescription;
    if (input.category !== undefined) updateData.category = (input.category as string).toLowerCase();
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.visibility !== undefined) updateData.visibility = (input.visibility as string).toLowerCase();
    if (input.pricingType !== undefined) updateData.pricingType = (input.pricingType as string).toLowerCase();
    if (input.price !== undefined) updateData.price = String(input.price);
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.iconUrl !== undefined) updateData.iconUrl = input.iconUrl;
    if (input.coverImages !== undefined) updateData.coverImages = input.coverImages;
    if (input.previewUrl !== undefined) updateData.previewUrl = input.previewUrl;
    if (input.documentationUrl !== undefined) updateData.documentationUrl = input.documentationUrl;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.settings !== undefined) updateData.settings = input.settings;

    const [updated] = await db
      .update(companyTemplates)
      .set(updateData)
      .where(eq(companyTemplates.id, id))
      .returning();

    if (!updated) {
      throw new GraphQLError("Failed to update template");
    }

    return mapTemplateToGraphQL(updated);
  },

  async publishVersion(
    _: unknown,
    { input }: { input: Record<string, unknown> },
    context: GraphQLContext,
  ): Promise<TemplateVersion> {
    const userId = requireBoardUser(context);
    const { db } = context;

    const templateId = input.templateId as string;

    const template = await db
      .select()
      .from(companyTemplates)
      .where(eq(companyTemplates.id, templateId))
      .then((rows) => rows[0] ?? null);

    if (!template) {
      throw new GraphQLError("Template not found");
    }

    const [version] = await db
      .insert(templateWorkflows)
      .values({
        templateId,
        companyId: template.companyId,
        name: input.name as string,
        description: input.description as string,
        version: input.version as string,
        changelog: input.changelog as string,
        workflowDefinition: (input.workflowDefinition as Record<string, unknown>) ?? {},
        nodeDefinitions: (input.nodeDefinitions as Record<string, unknown>) ?? {},
        roleDefinitions: (input.roleDefinitions as Record<string, unknown>) ?? {},
        deliverableDefinitions: (input.deliverableDefinitions as Record<string, unknown>) ?? {},
        createdBy: userId,
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    if (!version) {
      throw new GraphQLError("Failed to publish version");
    }

    // Update template current version
    await db
      .update(companyTemplates)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(companyTemplates.id, templateId));

    return mapVersionToGraphQL(version);
  },

  async deprecateTemplate(
    _: unknown,
    { id, reason }: { id: string; reason?: string },
    context: GraphQLContext,
  ): Promise<Template> {
    requireBoardUser(context);
    const { db } = context;

    const [template] = await db
      .update(companyTemplates)
      .set({
        status: "deprecated",
        deprecationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(companyTemplates.id, id))
      .returning();

    if (!template) {
      throw new GraphQLError("Template not found");
    }

    return mapTemplateToGraphQL(template);
  },

  async archiveTemplate(_: unknown, { id }: { id: string }, context: GraphQLContext): Promise<Template> {
    requireBoardUser(context);
    const { db } = context;

    const [template] = await db
      .update(companyTemplates)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(companyTemplates.id, id))
      .returning();

    if (!template) {
      throw new GraphQLError("Template not found");
    }

    return mapTemplateToGraphQL(template);
  },

  // ----------------------------------------
  // Reviews (Placeholder - would need review table)
  // ----------------------------------------

  async rateTemplate(
    _: unknown,
    { templateId, rating, review }: { templateId: string; rating: number; review?: string },
    context: GraphQLContext,
  ): Promise<boolean> {
    requireBoardUser(context);
    // Implementation would add/update review record
    // For now, update aggregate stats
    return true;
  },

  async updateReview(
    _: unknown,
    { templateId, rating, review }: { templateId: string; rating?: number; review?: string },
    context: GraphQLContext,
  ): Promise<boolean> {
    requireBoardUser(context);
    return true;
  },

  async deleteReview(_: unknown, { templateId }: { templateId: string }, context: GraphQLContext): Promise<boolean> {
    requireBoardUser(context);
    return true;
  },

  // ----------------------------------------
  // Revenue
  // ----------------------------------------

  async requestWithdrawal(
    _: unknown,
    { amount, method }: { amount: number; method: string },
    context: GraphQLContext,
  ): Promise<WithdrawalRequest> {
    const userId = requireBoardUser(context);
    const { db } = context;

    const account = await db
      .select()
      .from(creatorRevenueAccounts)
      .where(eq(creatorRevenueAccounts.userId, userId))
      .then((rows) => rows[0] ?? null);

    if (!account) {
      throw new GraphQLError("Creator account not found");
    }

    if (Number(account.availableBalance) < amount) {
      throw new GraphQLError("Insufficient balance");
    }

    const [request] = await db
      .insert(creatorPayoutRequests)
      .values({
        accountId: account.id,
        amount: String(amount),
        currency: "USD",
        status: "pending",
        payoutMethod: { type: method.toLowerCase() },
        recipientInfo: { userId },
      })
      .returning();

    if (!request) {
      throw new GraphQLError("Failed to create withdrawal request");
    }

    // Update available balance
    await db
      .update(creatorRevenueAccounts)
      .set({
        availableBalance: String(Number(account.availableBalance) - amount),
        pendingAmount: String(Number(account.pendingAmount) + amount),
        updatedAt: new Date(),
      })
      .where(eq(creatorRevenueAccounts.id, account.id));

    return {
      success: true,
      request: mapPayoutToGraphQL(request),
    };
  },

  // ----------------------------------------
  // Admin
  // ----------------------------------------

  async approveTemplate(_: unknown, { id }: { id: string }, context: GraphQLContext): Promise<Template> {
    requireBoardUser(context);
    // TODO: Check if user is admin
    const { db } = context;

    const [template] = await db
      .update(companyTemplates)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companyTemplates.id, id))
      .returning();

    if (!template) {
      throw new GraphQLError("Template not found");
    }

    return mapTemplateToGraphQL(template);
  },

  async rejectTemplate(
    _: unknown,
    { id, reason }: { id: string; reason: string },
    context: GraphQLContext,
  ): Promise<Template> {
    requireBoardUser(context);
    const { db } = context;

    const [template] = await db
      .update(companyTemplates)
      .set({
        status: "rejected",
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(companyTemplates.id, id))
      .returning();

    if (!template) {
      throw new GraphQLError("Template not found");
    }

    return mapTemplateToGraphQL(template);
  },

  async featureTemplate(
    _: unknown,
    { id, featured }: { id: string; featured: boolean },
    context: GraphQLContext,
  ): Promise<Template> {
    requireBoardUser(context);
    const { db } = context;

    const [template] = await db
      .update(companyTemplates)
      .set({
        featured,
        updatedAt: new Date(),
      })
      .where(eq(companyTemplates.id, id))
      .returning();

    if (!template) {
      throw new GraphQLError("Template not found");
    }

    return mapTemplateToGraphQL(template);
  },
};

// ============================================
// Field Resolvers
// ============================================

export const fieldResolvers = {
  Template: {
    async currentVersion(template: Template, _: unknown, context: GraphQLContext) {
      if (!template.currentVersionId) return null;
      const { db } = context;
      const version = await db
        .select()
        .from(templateWorkflows)
        .where(eq(templateWorkflows.id, template.currentVersionId))
        .then((rows) => rows[0] ?? null);
      return version ? mapVersionToGraphQL(version) : null;
    },

    async versions(template: Template, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const versions = await db
        .select()
        .from(templateWorkflows)
        .where(eq(templateWorkflows.templateId, template.id))
        .orderBy(desc(templateWorkflows.createdAt));
      return versions.map(mapVersionToGraphQL);
    },

    async stats(template: Template, _: unknown, context: GraphQLContext): Promise<Template["stats"]> {
      const { db } = context;
      const stats = await db
        .select()
        .from(templateRevenueStats)
        .where(eq(templateRevenueStats.templateId, template.id))
        .then((rows) => rows[0] ?? null);

      if (!stats) {
        return {
          downloads: template.downloadCount ?? 0,
          installs: 0,
          forks: template.forkCount ?? 0,
          ratingCount: template.ratingCount ?? 0,
          averageRating: template.averageRating ? Number(template.averageRating) : null,
          totalRevenue: 0,
          monthlyRevenue: 0,
          monthlySales: 0,
          lastUpdatedAt: template.updatedAt,
        };
      }

      return {
        downloads: template.downloadCount ?? 0,
        installs: stats.totalUsage ?? 0,
        forks: template.forkCount ?? 0,
        ratingCount: stats.ratingCount ?? 0,
        averageRating: stats.averageRating ? Number(stats.averageRating) : null,
        totalRevenue: Number(stats.totalRevenue ?? 0),
        monthlyRevenue: Number(stats.monthlyRevenue ?? 0),
        monthlySales: stats.monthlySales ?? 0,
        lastUpdatedAt: stats.statsUpdatedAt,
      };
    },

    async lineage(template: Template, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const lineage = await db
        .select()
        .from(templateLineages)
        .where(eq(templateLineages.descendantId, template.id))
        .then((rows) => rows[0] ?? null);
      return lineage ? mapLineageToGraphQL(lineage) : null;
    },

    async parentTemplate(template: Template, _: unknown, context: GraphQLContext) {
      if (!template.parentTemplateId) return null;
      const { db } = context;
      const parent = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, template.parentTemplateId))
        .then((rows) => rows[0] ?? null);
      return parent ? mapTemplateToGraphQL(parent) : null;
    },

    async forkedTemplates(template: Template, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const lineages = await db
        .select()
        .from(templateLineages)
        .where(eq(templateLineages.ancestorId, template.id));

      const forkIds = lineages.map((l) => l.descendantId);
      if (forkIds.length === 0) return [];

      const forks = await db
        .select()
        .from(companyTemplates)
        .where(inArray(companyTemplates.id, forkIds));

      return forks.map(mapTemplateToGraphQL);
    },

    async creator(template: Template, _: unknown, context: GraphQLContext) {
      if (!template.creatorId) return null;
      const { db } = context;
      const account = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.userId, template.creatorId))
        .then((rows: typeof creatorRevenueAccounts.$inferSelect[]) => rows[0] ?? null);
      return account ? mapCreatorToGraphQL(account) : null;
    },
  },

  TemplateLineage: {
    async template(lineage: TemplateLineage, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, lineage.templateId))
        .then((rows) => rows[0] ?? null);
      return template ? mapTemplateToGraphQL(template) : null;
    },

    async rootTemplate(lineage: TemplateLineage, _: unknown, context: GraphQLContext) {
      if (!lineage.rootTemplateId) return null;
      const { db } = context;
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, lineage.rootTemplateId))
        .then((rows) => rows[0] ?? null);
      return template ? mapTemplateToGraphQL(template) : null;
    },

    async parentTemplate(lineage: TemplateLineage, _: unknown, context: GraphQLContext) {
      if (!lineage.parentTemplateId) return null;
      const { db } = context;
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, lineage.parentTemplateId))
        .then((rows) => rows[0] ?? null);
      return template ? mapTemplateToGraphQL(template) : null;
    },

    async ancestorChain(lineage: TemplateLineage, _: unknown, context: GraphQLContext) {
      if (!lineage.path) return [];
      const { db } = context;
      const ids = (lineage.path as string[]).filter((id) => id !== lineage.templateId);
      if (ids.length === 0) return [];

      const templates = await db
        .select()
        .from(companyTemplates)
        .where(inArray(companyTemplates.id, ids));

      const templateMap = new Map(templates.map((t) => [t.id, t]));

      return ids.map((id, index) => {
        const template = templateMap.get(id);
        return {
          templateId: id,
          template: template ? mapTemplateToGraphQL(template) : null,
          depth: index + 1,
          relationship: index === ids.length - 1 ? "parent" : "ancestor",
        };
      }).filter((n) => n.template !== null);
    },

    async directChildren(lineage: TemplateLineage, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const childLineages = await db
        .select()
        .from(templateLineages)
        .where(eq(templateLineages.parentTemplateId, lineage.templateId));

      const childIds = childLineages.map((l) => l.descendantId);
      if (childIds.length === 0) return [];

      const templates = await db
        .select()
        .from(companyTemplates)
        .where(inArray(companyTemplates.id, childIds));

      return templates.map(mapTemplateToGraphQL);
    },
  },

  Creator: {
    async templates(creator: Creator, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const templates = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.createdBy, creator.userId ?? creator.id))
        .orderBy(desc(companyTemplates.createdAt))
        .limit(100);
      return templates.map(mapTemplateToGraphQL);
    },

    async stats(creator: Creator): Promise<Creator["stats"]> {
      return {
        totalTemplates: creator.totalTemplates ?? 0,
        totalDownloads: creator.totalDownloads ?? 0,
        totalForks: creator.totalForks ?? 0,
        averageRating: creator.averageRating ? Number(creator.averageRating) : null,
      };
    },

    async revenue(creator: Creator, _: unknown, context: GraphQLContext): Promise<RevenueStats> {
      const { db } = context;

      // Get revenue breakdown
      const bySource = await db
        .select({
          source: revenueRecords.sourceType,
          total: sql<number>`sum(${revenueRecords.directCreatorShare})`,
          count: sql<number>`count(*)`,
        })
        .from(revenueRecords)
        .where(eq(revenueRecords.templateId, creator.id))
        .groupBy(revenueRecords.sourceType);

      const payouts = await db
        .select()
        .from(creatorPayoutRequests)
        .where(eq(creatorPayoutRequests.accountId, creator.id))
        .orderBy(desc(creatorPayoutRequests.createdAt))
        .limit(50);

      return {
        totalEarned: creator.totalEarned ?? 0,
        availableBalance: creator.availableBalance ?? 0,
        withdrawnAmount: creator.withdrawnAmount ?? 0,
        pendingAmount: creator.pendingAmount ?? 0,
        bySource: bySource.map((s) => ({
          source: s.source ?? "unknown",
          amount: Number(s.total ?? 0),
          count: s.count ?? 0,
        })),
        byMonth: [], // Would need monthly aggregation
        currency: "USD",
        payouts: payouts.map(mapPayoutToGraphQL),
      };
    },
  },

  TemplateVersion: {
    async template(version: TemplateVersion, _: unknown, context: GraphQLContext) {
      const { db } = context;
      const template = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, version.templateId))
        .then((rows) => rows[0] ?? null);
      return template ? mapTemplateToGraphQL(template) : null;
    },

    async creator(version: TemplateVersion, _: unknown, context: GraphQLContext) {
      if (!version.createdBy) return null;
      const { db } = context;
      const account = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.userId, version.createdBy))
        .then((rows) => rows[0] ?? null);
      return account ? mapCreatorToGraphQL(account) : null;
    },
  },
};

// ============================================
// Mapper Functions
// ============================================

function mapTemplateToGraphQL(template: typeof companyTemplates.$inferSelect): Template {
  return {
    id: template.id,
    companyId: template.companyId,
    name: template.name,
    slug: template.slug ?? template.name.toLowerCase().replace(/\s+/g, "-"),
    description: template.description ?? null,
    shortDescription: template.shortDescription ?? null,
    category: (template.category?.toUpperCase() ?? "CUSTOM") as Template["category"],
    tags: template.tags ?? [],
    status: (template.status?.toUpperCase() ?? "DRAFT") as Template["status"],
    visibility: (template.visibility?.toUpperCase() ?? "PRIVATE") as Template["visibility"],
    currentVersionId: template.currentVersionId ?? null,
    pricingType: (template.pricingType?.toUpperCase() ?? "FREE") as Template["pricingType"],
    price: Number(template.price ?? 0),
    currency: template.currency ?? "USD",
    subscriptionPeriod: template.subscriptionPeriod ?? null,
    currentVersion: null, // Resolved by field resolver
    versions: [], // Resolved by field resolver
    versionCount: 0, // Resolved by field resolver
    stats: null as unknown as Template["stats"], // Resolved by field resolver
    lineage: null, // Resolved by field resolver
    parentTemplateId: template.parentTemplateId ?? null,
    parentTemplate: null, // Resolved by field resolver
    forkedTemplates: [], // Resolved by field resolver
    creatorId: template.createdBy ?? null,
    creator: null, // Resolved by field resolver
    iconUrl: template.iconUrl ?? null,
    coverImages: template.coverImages ?? [],
    previewUrl: template.previewUrl ?? null,
    documentationUrl: template.documentationUrl ?? null,
    metadata: template.metadata ?? {},
    settings: template.settings ?? {},
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    publishedAt: template.publishedAt ?? null,
    downloadCount: template.downloadCount ?? 0,
    forkCount: template.forkCount ?? 0,
    ratingCount: template.ratingCount ?? 0,
    averageRating: template.averageRating,
  };
}

function mapVersionToGraphQL(version: typeof templateWorkflows.$inferSelect): TemplateVersion {
  return {
    id: version.id,
    templateId: version.templateId,
    template: null as unknown as TemplateVersion["template"], // Resolved by field resolver
    version: version.version ?? "1.0.0",
    name: version.name ?? null,
    description: version.description ?? null,
    changelog: version.changelog ?? null,
    workflowDefinition: version.workflowDefinition ?? {},
    nodeDefinitions: version.nodeDefinitions ?? {},
    roleDefinitions: version.roleDefinitions ?? {},
    deliverableDefinitions: version.deliverableDefinitions ?? {},
    isLatest: version.status === "published",
    status: version.status ?? "draft",
    downloads: 0, // Would need separate tracking
    installs: 0,
    createdBy: version.createdBy ?? "",
    creator: null, // Resolved by field resolver
    createdAt: version.createdAt,
    publishedAt: version.publishedAt ?? null,
  };
}

function mapLineageToGraphQL(lineage: typeof templateLineages.$inferSelect): TemplateLineage {
  return {
    id: lineage.id,
    templateId: lineage.descendantId,
    template: null as unknown as TemplateLineage["template"], // Resolved by field resolver
    rootTemplateId: lineage.rootTemplateId ?? null,
    rootTemplate: null, // Resolved by field resolver
    parentTemplateId: lineage.parentTemplateId ?? null,
    parentTemplate: null, // Resolved by field resolver
    ancestorChain: [], // Resolved by field resolver
    directChildren: [], // Resolved by field resolver
    totalDescendants: 0, // Would need to calculate
    revenueShareEnabled: lineage.revenueShareEnabled ?? true,
    ancestorSharePercent: Number(lineage.ancestorSharePercent ?? 15),
    rootSharePercent: Number(lineage.rootSharePercent ?? 10),
    createdAt: lineage.createdAt,
    updatedAt: lineage.updatedAt,
    path: lineage.path as string[] | null,
    ancestorId: lineage.ancestorId,
    descendantId: lineage.descendantId,
    depth: lineage.depth,
  };
}

function mapCreatorToGraphQL(account: typeof creatorRevenueAccounts.$inferSelect): Creator {
  return {
    id: account.id,
    companyId: account.companyId ?? null,
    userId: account.userId ?? null,
    agentId: account.agentId ?? null,
    name: account.userId ?? account.agentId ?? "Unknown",
    displayName: null,
    avatarUrl: null,
    bio: null,
    website: null,
    socialLinks: {},
    tier: (account.tier?.toUpperCase() ?? "BRONZE") as Creator["tier"],
    tierUpdatedAt: account.tierUpdatedAt ?? null,
    stats: null as unknown as Creator["stats"], // Resolved by field resolver
    templates: [], // Resolved by field resolver
    templateCount: account.totalTemplates ?? 0,
    revenue: null as unknown as RevenueStats, // Resolved by field resolver
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    totalEarned: Number(account.totalEarned ?? 0),
    availableBalance: Number(account.availableBalance ?? 0),
    withdrawnAmount: Number(account.withdrawnAmount ?? 0),
    pendingAmount: Number(account.pendingAmount ?? 0),
    averageRating: account.averageRating,
    totalTemplates: account.totalTemplates ?? 0,
    totalDownloads: account.totalDownloads ?? 0,
    totalForks: account.totalForks ?? 0,
  };
}

function mapPayoutToGraphQL(payout: typeof creatorPayoutRequests.$inferSelect) {
  return {
    id: payout.id,
    accountId: payout.accountId,
    amount: Number(payout.amount),
    currency: payout.currency,
    status: (payout.status?.toUpperCase() ?? "PENDING") as
      | "PENDING"
      | "APPROVED"
      | "PROCESSING"
      | "COMPLETED"
      | "REJECTED"
      | "FAILED",
    payoutMethod: (payout.payoutMethod as Record<string, unknown>) ?? {},
    recipientInfo: (payout.recipientInfo as Record<string, unknown>) ?? {},
    requestedAt: payout.requestedAt,
    approvedAt: payout.approvedAt ?? null,
    approvedBy: payout.approvedBy ?? null,
    processedAt: payout.processedAt ?? null,
    completedAt: payout.completedAt ?? null,
    transactionId: payout.transactionId ?? null,
    failureReason: payout.failureReason ?? null,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt,
  };
}

function mapSubscriptionToPurchase(subscription: typeof templateSubscriptions.$inferSelect): Purchase {
  return {
    id: subscription.id,
    templateId: subscription.templateId,
    template: null as unknown as Purchase["template"], // Would need to resolve
    buyerCompanyId: subscription.companyId,
    buyerUserId: subscription.subscribedBy ?? null,
    amount: 0, // Would need to get from purchase record
    currency: "USD",
    pricingType: "FREE",
    status: subscription.status === "active" ? "COMPLETED" : "PENDING",
    paymentMethod: "BALANCE",
    paymentIntentId: null,
    purchasedAt: subscription.createdAt,
    expiresAt: subscription.expiresAt ?? null,
    createdAt: subscription.createdAt,
  };
}
