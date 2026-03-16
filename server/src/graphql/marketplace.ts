import { createSchema } from "graphql-yoga";
import type { Db } from "@jigongai/db";
import { eq, and, like, desc, asc, sql } from "drizzle-orm";
import {
  companyTemplates,
  templateMarketplace,
  templateSubscriptions,
  templateLineages,
  creatorRevenueAccounts,
  revenueRecords,
  creatorRevenueDistributions,
  templateRevenueStats,
  creatorTierHistory,
} from "@jigongai/db";
import { templateEngineService } from "../services/template-engine.js";
import { creatorIncentiveService } from "../services/creator-incentive.js";
import { creatorTierService } from "../services/creator-tier.js";

// ============================================================================
// GraphQL Type Definitions
// ============================================================================

const typeDefs = /* GraphQL */ `
  # ============================================================================
  # Template Types
  # ============================================================================

  type Template {
    id: ID!
    name: String!
    slug: String!
    description: String
    version: String!
    category: String
    isPublic: Boolean!
    priceCents: Int!
    installCount: Int!
    rating: Float
    authorName: String
    createdAt: String!
    updatedAt: String!
    companyId: ID!
  }

  type TemplateDetail {
    id: ID!
    name: String!
    slug: String!
    description: String
    version: String!
    category: String
    isPublic: Boolean!
    priceCents: Int!
    installCount: Int!
    rating: Float
    authorName: String
    createdAt: String!
    updatedAt: String!
    content: TemplateContent
    lineage: TemplateLineage
    versions: [TemplateVersion!]!
    companyId: ID!
  }

  type TemplateContent {
    manifest: TemplateManifest
    customizationSchema: TemplateCustomizationSchema
  }

  type TemplateManifest {
    name: String!
    version: String!
    description: String
    author: String
    category: String
    dependencies: [String!]
  }

  type TemplateCustomizationSchema {
    fields: [CustomizationField!]!
  }

  type CustomizationField {
    key: String!
    label: String!
    type: String!
    required: Boolean!
    defaultValue: String
    description: String
  }

  type TemplateLineage {
    forkedFrom: ID
    forkedFromName: String
    ancestorChain: [AncestorNode!]!
    forks: [ForkNode!]!
  }

  type AncestorNode {
    id: ID!
    name: String!
    level: Int!
  }

  type ForkNode {
    id: ID!
    name: String!
    companyName: String!
  }

  type TemplateVersion {
    version: String!
    changeLog: String
    createdAt: String!
  }

  # ============================================================================
  # Creator Revenue Types
  # ============================================================================

  type CreatorRevenue {
    totalEarnedCents: Int!
    availableBalanceCents: Int!
    pendingBalanceCents: Int!
    totalWithdrawnCents: Int!
    tier: CreatorTier!
    tierProgress: TierProgress!
    templates: [TemplateRevenue!]!
  }

  enum CreatorTier {
    BRONZE
    SILVER
    GOLD
    PLATINUM
    DIAMOND
  }

  type TierProgress {
    current: Int!
    next: Int!
    percentage: Int!
  }

  type TemplateRevenue {
    templateId: ID!
    name: String!
    totalRevenueCents: Int!
    installCount: Int!
  }

  type RevenueRecord {
    id: ID!
    templateId: ID!
    amountCents: Int!
    source: String!
    createdAt: String!
  }

  type RevenueDistribution {
    id: ID!
    transactionId: ID!
    creatorId: ID!
    templateId: ID
    amountCents: Int!
    distributionType: String!
    status: String!
    createdAt: String!
  }

  type PayoutRequest {
    id: ID!
    amountCents: Int!
    method: String!
    status: String!
    createdAt: String!
    processedAt: String
  }

  # ============================================================================
  # Purchase & Install Types
  # ============================================================================

  type PurchaseResult {
    success: Boolean!
    transactionId: ID
    amountCents: Int!
    status: String!
  }

  type InstallResult {
    success: Boolean!
    templateId: ID
    version: String!
    message: String
  }

  type ForkResult {
    template: Template!
  }

  # ============================================================================
  # Input Types
  # ============================================================================

  input TemplateFilterInput {
    category: String
    price: PriceFilter
    sort: SortOption
    search: String
    page: Int
    limit: Int
  }

  enum PriceFilter {
    FREE
    PAID
    ALL
  }

  enum SortOption {
    POPULAR
    RECENT
    RATING
    PRICE_ASC
    PRICE_DESC
  }

  input PurchaseInput {
    templateId: ID!
    paymentMethod: String!
  }

  input InstallInput {
    templateId: ID!
    targetCompanyId: ID
    customize: Boolean
  }

  input ForkInput {
    templateId: ID!
    name: String
    description: String
    priceCents: Int
    isPublic: Boolean
  }

  input PayoutInput {
    amountCents: Int!
    method: String!
  }

  # ============================================================================
  # Pagination Types
  # ============================================================================

  type TemplateConnection {
    edges: [TemplateEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TemplateEdge {
    node: Template!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # ============================================================================
  # Queries
  # ============================================================================

  type Query {
    # Template queries
    templates(filter: TemplateFilterInput): TemplateConnection!
    template(id: ID!): TemplateDetail
    templateBySlug(slug: String!): TemplateDetail

    # Creator queries
    creatorRevenue(companyId: ID!): CreatorRevenue
    revenueHistory(companyId: ID!, limit: Int): [RevenueRecord!]!
    payouts(companyId: ID!, status: String): [PayoutRequest!]!

    # Installation queries
    installedTemplates(companyId: ID!): [Template!]!
    templatePreview(companyId: ID!, templateId: ID!): TemplateContent
  }

  # ============================================================================
  # Mutations
  # ============================================================================

  type Mutation {
    # Purchase & Install
    purchaseTemplate(input: PurchaseInput!): PurchaseResult!
    installTemplate(input: InstallInput!): InstallResult!
    uninstallTemplate(companyId: ID!, templateId: ID!, force: Boolean): Boolean!
    upgradeTemplate(companyId: ID!, templateId: ID!, targetVersion: String): InstallResult!

    # Fork & Publish
    forkTemplate(input: ForkInput!): ForkResult!
    publishTemplate(companyId: ID!, templateId: ID!, isPublic: Boolean!): Template!

    # Creator
    requestPayout(companyId: ID!, input: PayoutInput!): PayoutRequest!
    updateTemplatePrice(companyId: ID!, templateId: ID!, priceCents: Int!): Template!
  }
`;

// ============================================================================
// GraphQL Resolvers
// ============================================================================

export function createGraphQLResolvers(db: Db) {
  const templateService = templateEngineService(db);
  const creatorService = creatorIncentiveService(db);
  const tierService = creatorTierService(db);

  return {
    // ========================================================================
    // Query Resolvers
    // ========================================================================
    Query: {
      // Template queries
      templates: async (_: unknown, args: { filter?: any }, context: { companyId?: string }) => {
        const { filter = {} } = args;
        const page = filter.page ?? 1;
        const limit = Math.min(filter.limit ?? 20, 100);
        const offset = (page - 1) * limit;

        // Build query conditions
        const conditions = [eq(companyTemplates.isPublic, true)];

        if (filter.category) {
          conditions.push(eq(companyTemplates.category, filter.category));
        }

        if (filter.price === "FREE") {
          conditions.push(eq(companyTemplates.priceCents, 0));
        } else if (filter.price === "PAID") {
          conditions.push(sql`${companyTemplates.priceCents} > 0`);
        }

        if (filter.search) {
          conditions.push(
            like(companyTemplates.name, `%${filter.search}%`)
          );
        }

        // Determine sort order
        let orderBy = desc(companyTemplates.installCount);
        switch (filter.sort) {
          case "RECENT":
            orderBy = desc(companyTemplates.createdAt);
            break;
          case "RATING":
            orderBy = desc(companyTemplates.rating);
            break;
          case "PRICE_ASC":
            orderBy = asc(companyTemplates.priceCents);
            break;
          case "PRICE_DESC":
            orderBy = desc(companyTemplates.priceCents);
            break;
        }

        // Execute queries
        const [templates, [{ count }]] = await Promise.all([
          db
            .select({
              id: companyTemplates.id,
              name: companyTemplates.name,
              slug: companyTemplates.slug,
              description: companyTemplates.description,
              version: companyTemplates.version,
              category: companyTemplates.category,
              isPublic: companyTemplates.isPublic,
              priceCents: companyTemplates.priceCents,
              installCount: companyTemplates.installCount,
              rating: companyTemplates.rating,
              authorName: companyTemplates.authorName,
              createdAt: companyTemplates.createdAt,
              updatedAt: companyTemplates.updatedAt,
              companyId: companyTemplates.companyId,
            })
            .from(companyTemplates)
            .where(and(...conditions))
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset),
          db
            .select({ count: sql<number>`count(*)` })
            .from(companyTemplates)
            .where(and(...conditions)),
        ]);

        return {
          edges: templates.map((t) => ({ node: t, cursor: t.id })),
          pageInfo: {
            hasNextPage: page * limit < count,
            hasPreviousPage: page > 1,
            startCursor: templates[0]?.id,
            endCursor: templates[templates.length - 1]?.id,
          },
          totalCount: count,
        };
      },

      template: async (_: unknown, args: { id: string }) => {
        const result = await db
          .select()
          .from(companyTemplates)
          .where(eq(companyTemplates.id, args.id))
          .limit(1);

        if (!result[0]) return null;
        return result[0];
      },

      templateBySlug: async (_: unknown, args: { slug: string }) => {
        const result = await db
          .select()
          .from(companyTemplates)
          .where(eq(companyTemplates.slug, args.slug))
          .limit(1);

        if (!result[0]) return null;
        return result[0];
      },

      // Creator revenue queries
      creatorRevenue: async (_: unknown, args: { companyId: string }) => {
        return await creatorService.getCreatorRevenue(args.companyId);
      },

      revenueHistory: async (
        _: unknown,
        args: { companyId: string; limit?: number }
      ) => {
        const limit = Math.min(args.limit ?? 50, 100);
        return await db
          .select()
          .from(revenueRecords)
          .where(eq(revenueRecords.companyId, args.companyId))
          .orderBy(desc(revenueRecords.createdAt))
          .limit(limit);
      },

      payouts: async (
        _: unknown,
        args: { companyId: string; status?: string }
      ) => {
        let query = db
          .select()
          .from(creatorPayoutRequests)
          .where(eq(creatorPayoutRequests.companyId, args.companyId));

        if (args.status) {
          query = query.where(eq(creatorPayoutRequests.status, args.status));
        }

        return await query.orderBy(desc(creatorPayoutRequests.createdAt));
      },

      // Installation queries
      installedTemplates: async (_: unknown, args: { companyId: string }) => {
        const subscriptions = await db
          .select({
            templateId: templateSubscriptions.templateId,
          })
          .from(templateSubscriptions)
          .where(eq(templateSubscriptions.companyId, args.companyId));

        if (subscriptions.length === 0) return [];

        const templateIds = subscriptions.map((s) => s.templateId);
        return await db
          .select()
          .from(companyTemplates)
          .where(sql`${companyTemplates.id} IN ${templateIds}`);
      },

      templatePreview: async (
        _: unknown,
        args: { companyId: string; templateId: string }
      ) => {
        const preview = await templateService.previewTemplate(
          args.templateId,
          args.companyId
        );
        return preview;
      },
    },

    // ========================================================================
    // Mutation Resolvers
    // ========================================================================
    Mutation: {
      // Purchase & Install
      purchaseTemplate: async (
        _: unknown,
        args: { input: { templateId: string; paymentMethod: string } },
        context: { companyId: string; userId: string }
      ) => {
        const result = await creatorService.processPurchase({
          buyerCompanyId: context.companyId,
          templateId: args.input.templateId,
          paymentMethod: args.input.paymentMethod,
        });
        return result;
      },

      installTemplate: async (
        _: unknown,
        args: {
          input: {
            templateId: string;
            targetCompanyId?: string;
            customize?: boolean;
          };
        },
        context: { companyId: string; userId: string }
      ) => {
        const result = await templateService.installTemplate({
          templateId: args.input.templateId,
          targetCompanyId: args.input.targetCompanyId ?? context.companyId,
          installedBy: context.userId,
          customization: args.input.customize ? {} : undefined,
        });
        return {
          success: true,
          templateId: result.templateId,
          version: result.version,
          message: result.message,
        };
      },

      uninstallTemplate: async (
        _: unknown,
        args: { companyId: string; templateId: string; force?: boolean }
      ) => {
        await templateService.uninstallTemplate(
          args.templateId,
          args.companyId,
          args.force ?? false
        );
        return true;
      },

      upgradeTemplate: async (
        _: unknown,
        args: { companyId: string; templateId: string; targetVersion?: string }
      ) => {
        const result = await templateService.upgradeTemplate({
          templateId: args.templateId,
          companyId: args.companyId,
          targetVersion: args.targetVersion,
        });
        return {
          success: true,
          templateId: result.templateId,
          version: result.version,
          message: result.message,
        };
      },

      // Fork & Publish
      forkTemplate: async (
        _: unknown,
        args: {
          input: {
            templateId: string;
            name?: string;
            description?: string;
            priceCents?: number;
            isPublic?: boolean;
          };
        },
        context: { companyId: string; userId: string }
      ) => {
        const result = await templateService.forkTemplate({
          templateId: args.input.templateId,
          companyId: context.companyId,
          userId: context.userId,
          customization: {
            name: args.input.name,
            description: args.input.description,
            priceCents: args.input.priceCents,
            isPublic: args.input.isPublic,
          },
        });
        return { template: result };
      },

      publishTemplate: async (
        _: unknown,
        args: { companyId: string; templateId: string; isPublic: boolean }
      ) => {
        const result = await templateService.publishTemplate({
          templateId: args.templateId,
          companyId: args.companyId,
          isPublic: args.isPublic,
        });
        return result;
      },

      // Creator
      requestPayout: async (
        _: unknown,
        args: { companyId: string; input: { amountCents: number; method: string } },
        context: { userId: string }
      ) => {
        const result = await creatorService.requestPayout({
          companyId: args.companyId,
          amountCents: args.input.amountCents,
          method: args.input.method,
          requestedBy: context.userId,
        });
        return result;
      },

      updateTemplatePrice: async (
        _: unknown,
        args: { companyId: string; templateId: string; priceCents: number }
      ) => {
        const result = await templateService.updateTemplatePrice({
          templateId: args.templateId,
          companyId: args.companyId,
          priceCents: args.priceCents,
        });
        return result;
      },
    },

    // ========================================================================
    // Field Resolvers
    // ========================================================================
    TemplateDetail: {
      lineage: async (parent: { id: string }) => {
        return await templateService.getTemplateLineage(parent.id);
      },
      versions: async (parent: { id: string }) => {
        return await templateService.getTemplateVersions(parent.id);
      },
    },
  };
}

// ============================================================================
// Create GraphQL Schema
// ============================================================================

export function createMarketplaceGraphQLSchema(db: Db) {
  return createSchema({
    typeDefs,
    resolvers: createGraphQLResolvers(db),
  });
}
