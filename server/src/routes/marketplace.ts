import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { Db } from "@jigongai/db";
import { eq, and, like, desc, asc, sql, inArray, isNull } from "drizzle-orm";
import {
  companyTemplates,
  templateMarketplace,
  templateSubscriptions,
  templateLineages,
  creatorRevenueAccounts,
  creatorPayoutRequests,
  templateRevenueStats,
  companies,
} from "@jigongai/db";
import { templateEngineService } from "../services/template-engine.js";
import { createTemplateEncryptionService } from "../services/template-encryption.js";
import { creatorIncentiveService } from "../services/creator-incentive.js";
import { creatorTierService } from "../services/creator-tier.js";
import { paymentService } from "../services/payment.js";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { notFound, forbidden, badRequest } from "../errors.js";

// ============================================
// Validation Schemas
// ============================================

const searchTemplatesQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  price: z.enum(["free", "paid", "all"]).optional().default("all"),
  rating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(["popular", "newest", "rating", "price_asc", "price_desc"]).optional().default("popular"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

const purchaseTemplateSchema = z.object({
  paymentMethod: z.enum(["balance", "stripe", "alipay", "wechat"]),
  amount: z.coerce.number().positive(),
  currency: z.string().default("USD"),
});

const installTemplateSchema = z.object({
  customizations: z.record(z.unknown()).optional(),
  autoUpdate: z.boolean().optional().default(false),
  updateChannel: z.enum(["stable", "beta", "alpha"]).optional().default("stable"),
});

const forkTemplateSchema = z.object({
  customizations: z.record(z.unknown()).optional(),
  contribution: z.string().optional(),
});

const createCompanyTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  templatePackage: z.record(z.unknown()),
  isDefault: z.boolean().optional().default(false),
});

const updateCompanyTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).partial();

const publishTemplateSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  price: z.coerce.number().min(0).optional().default(0),
});

// ============================================
// Router Factory
// ============================================

export function marketplaceRoutes(db: Db) {
  const router = Router();
  const engine = templateEngineService(db);
  const encryption = createTemplateEncryptionService();
  const incentive = creatorIncentiveService(db);
  const tier = creatorTierService(db);
  const payment = paymentService(db);

  // ============================================
  // Public Marketplace Routes
  // ============================================

  /**
   * @swagger
   * /api/v1/marketplace/templates:
   *   get:
   *     summary: Search and list marketplace templates
   *     tags: [Marketplace]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Search query for template name/description
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category
   *       - in: query
   *         name: price
   *         schema:
   *           type: string
   *           enum: [free, paid, all]
   *           default: all
   *         description: Price filter
   *       - in: query
   *         name: rating
   *         schema:
   *           type: number
   *           minimum: 1
   *           maximum: 5
   *         description: Minimum rating filter
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [popular, newest, rating, price_asc, price_desc]
   *           default: popular
   *         description: Sort order
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Items per page (max 100)
   *     responses:
   *       200:
   *         description: List of templates with pagination
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                 pagination:
   *                   type: object
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/templates", async (req: Request, res: Response) => {
    try {
      // Parse query parameters
      const q = req.query.q as string | undefined;
      const category = req.query.category as string | undefined;
      const price = (req.query.price as string) || "all";
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      const sort = (req.query.sort as string) || "popular";
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions: ReturnType<typeof and>[] = [
        eq(templateMarketplace.status, "published"),
      ];

      if (category) {
        conditions.push(eq(templateMarketplace.category, category));
      }

      if (rating) {
        conditions.push(sql`${templateMarketplace.rating} >= ${rating}`);
      }

      // Search query
      if (q) {
        conditions.push(
          sql`(
            ${templateMarketplace.templateId} IN (
              SELECT id FROM ${companyTemplates}
              WHERE ${like(companyTemplates.name, `%${q}%`)}
              OR ${like(companyTemplates.description || "", `%${q}%`)}
            )
          )`
        );
      }

      // Determine order by
      let orderBy: ReturnType<typeof desc | typeof asc>;
      switch (sort) {
        case "newest":
          orderBy = desc(templateMarketplace.publishedAt);
          break;
        case "rating":
          orderBy = desc(templateMarketplace.rating);
          break;
        case "price_asc":
          orderBy = asc(templateMarketplace.id); // Placeholder - price not in marketplace table
          break;
        case "price_desc":
          orderBy = desc(templateMarketplace.id); // Placeholder - price not in marketplace table
          break;
        case "popular":
        default:
          orderBy = desc(templateMarketplace.id); // Placeholder - use download count
      }

      // Query templates from marketplace
      const marketplaceEntries = await db
        .select({
          id: templateMarketplace.id,
          templateId: templateMarketplace.templateId,
          companyId: templateMarketplace.companyId,
          category: templateMarketplace.category,
          tags: templateMarketplace.tags,
          rating: templateMarketplace.rating,
          reviewCount: templateMarketplace.reviewCount,
          publishedAt: templateMarketplace.publishedAt,
          status: templateMarketplace.status,
        })
        .from(templateMarketplace)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      // Get template details for each entry
      const templateIds = marketplaceEntries.map((e: { templateId: string }) => e.templateId);

      let templateDetails: Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        version: string;
        createdBy: string;
        downloadCount: number;
        createdAt: Date;
      }> = [];

      if (templateIds.length > 0) {
        templateDetails = await db
          .select({
            id: companyTemplates.id,
            name: companyTemplates.name,
            slug: companyTemplates.slug,
            description: companyTemplates.description,
            version: companyTemplates.version,
            createdBy: companyTemplates.createdBy,
            downloadCount: companyTemplates.downloadCount,
            createdAt: companyTemplates.createdAt,
          })
          .from(companyTemplates)
          .where(inArray(companyTemplates.id, templateIds));
      }

      const templateMap = new Map(templateDetails.map((t) => [t.id, t]));

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(templateMarketplace)
        .where(and(...conditions));
      const total = countResult[0]?.count || 0;

      // Get stats for each template
      const templatesWithStats = await Promise.all(
        marketplaceEntries.map(async (item: {
          templateId: string;
          category: string;
          tags: string[] | null;
          rating: number | null;
          reviewCount: number;
          publishedAt: Date | null;
        }) => {
          const template = templateMap.get(item.templateId);
          const stats = await db.query.templateRevenueStats.findFirst({
            where: eq(templateRevenueStats.templateId, item.templateId),
          });

          return {
            id: item.templateId,
            name: template?.name || "Unknown",
            slug: template?.slug || "",
            description: template?.description,
            version: template?.version || "",
            category: item.category,
            tags: item.tags,
            rating: item.rating,
            reviewCount: item.reviewCount,
            author: template?.createdBy || "Unknown",
            downloads: template?.downloadCount || 0,
            publishedAt: item.publishedAt,
            stats: stats
              ? {
                  totalSales: stats.totalSales,
                  totalRevenue: stats.totalRevenue,
                  averageRating: stats.averageRating,
                  monthlySales: stats.monthlySales,
                  monthlyRevenue: stats.monthlyRevenue,
                }
              : null,
          };
        })
      );

      res.json({
        success: true,
        data: templatesWithStats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing templates:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list templates",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/templates/{id}:
   *   get:
   *     summary: Get template details with lineage
   *     tags: [Marketplace]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Template ID
   *     responses:
   *       200:
   *         description: Template details with lineage
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/templates/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Get marketplace entry
      const marketplaceEntry = await db
        .select({
          id: templateMarketplace.id,
          templateId: templateMarketplace.templateId,
          companyId: templateMarketplace.companyId,
          category: templateMarketplace.category,
          tags: templateMarketplace.tags,
          rating: templateMarketplace.rating,
          reviewCount: templateMarketplace.reviewCount,
          publishedAt: templateMarketplace.publishedAt,
        })
        .from(templateMarketplace)
        .where(
          and(
            eq(templateMarketplace.templateId, id),
            eq(templateMarketplace.status, "published")
          )
        )
        .limit(1)
        .then((rows: Array<{
          id: string;
          templateId: string;
          companyId: string;
          category: string;
          tags: string[] | null;
          rating: number | null;
          reviewCount: number;
          publishedAt: Date | null;
        }>) => rows[0]);

      if (!marketplaceEntry) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Get template details
      const template = await db
        .select({
          id: companyTemplates.id,
          name: companyTemplates.name,
          slug: companyTemplates.slug,
          description: companyTemplates.description,
          version: companyTemplates.version,
          createdBy: companyTemplates.createdBy,
          downloadCount: companyTemplates.downloadCount,
          createdAt: companyTemplates.createdAt,
        })
        .from(companyTemplates)
        .where(eq(companyTemplates.id, id))
        .limit(1)
        .then((rows: Array<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          version: string;
          createdBy: string;
          downloadCount: number;
          createdAt: Date;
        }>) => rows[0]);

      // Get company details
      const company = await db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
        })
        .from(companies)
        .where(eq(companies.id, marketplaceEntry.companyId))
        .limit(1)
        .then((rows: Array<{
          id: string;
          name: string;
          slug: string;
        }>) => rows[0]);

      // Get lineage info
      const lineage = await db.query.templateLineages.findFirst({
        where: eq(templateLineages.templateId, id),
      });

      // Get stats
      const stats = await db.query.templateRevenueStats.findFirst({
        where: eq(templateRevenueStats.templateId, id),
      });

      // Get version history
      const versions = await db
        .select({
          id: companyTemplates.id,
          version: companyTemplates.version,
          createdAt: companyTemplates.createdAt,
          createdBy: companyTemplates.createdBy,
        })
        .from(companyTemplates)
        .where(
          and(
            eq(companyTemplates.parentTemplateId, id),
            eq(companyTemplates.isActive, true)
          )
        )
        .orderBy(desc(companyTemplates.createdAt))
        .limit(10);

      res.json({
        success: true,
        data: {
          id: marketplaceEntry.templateId,
          name: template?.name,
          slug: template?.slug,
          description: template?.description,
          version: template?.version,
          category: marketplaceEntry.category,
          tags: marketplaceEntry.tags,
          rating: marketplaceEntry.rating,
          reviewCount: marketplaceEntry.reviewCount,
          author: template?.createdBy,
          company: company || null,
          downloads: template?.downloadCount || 0,
          publishedAt: marketplaceEntry.publishedAt,
          lineage: lineage
            ? {
                rootTemplateId: lineage.rootTemplateId,
                parentTemplateId: lineage.parentTemplateId,
                generation: lineage.generation,
                forkCount: lineage.forkCount,
                totalRevenueGenerated: lineage.totalRevenueGenerated,
              }
            : null,
          stats: stats
            ? {
                totalSales: stats.totalSales,
                totalRevenue: stats.totalRevenue,
                totalForks: stats.totalForks,
                totalUsage: stats.totalUsage,
                averageRating: stats.averageRating,
                monthlySales: stats.monthlySales,
                monthlyRevenue: stats.monthlyRevenue,
              }
            : null,
          versions,
        },
      });
    } catch (error) {
      console.error("Error getting template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/templates/{id}/purchase:
   *   post:
   *     summary: Purchase a template
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - paymentMethod
   *               - amount
   *             properties:
   *               paymentMethod:
   *                 type: string
   *                 enum: [balance, stripe, alipay, wechat]
   *               amount:
   *                 type: number
   *                 description: Amount in cents
   *               currency:
   *                 type: string
   *                 default: USD
   *     responses:
   *       200:
   *         description: Purchase successful
   *       400:
   *         description: Invalid request or payment failed
   *       401:
   *         description: Authentication required
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.post("/v1/marketplace/templates/:id/purchase", validate(purchaseTemplateSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { paymentMethod, amount, currency } = req.body;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const buyerCompanyId = actor.type === "agent" ? actor.companyId : actor.companyIds?.[0];
      const buyerUserId = actor.type === "agent" ? actor.agentId : actor.userId;

      if (!buyerCompanyId || !buyerUserId) {
        return res.status(401).json({
          success: false,
          error: "Company and user information required",
        });
      }

      // Verify template exists and is published
      const marketplaceEntry = await db.query.templateMarketplace.findFirst({
        where: and(
          eq(templateMarketplace.templateId, id),
          eq(templateMarketplace.status, "published")
        ),
      });

      if (!marketplaceEntry) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Process payment
      let paymentResult;
      switch (paymentMethod) {
        case "balance":
          paymentResult = await payment.processBalancePayment(
            buyerCompanyId,
            buyerUserId,
            amount,
            id
          );
          break;
        case "stripe":
          // For Stripe, we return client secret to complete payment on client side
          const stripeIntent = await payment.createStripeIntent({
            amount,
            currency,
            templateId: id,
            buyerCompanyId,
            buyerUserId,
            description: `Purchase template: ${id}`,
          });
          if (stripeIntent.error) {
            return res.status(400).json({
              success: false,
              error: stripeIntent.error,
            });
          }
          return res.json({
            success: true,
            data: {
              clientSecret: stripeIntent.clientSecret,
              status: "pending",
            },
          });
        default:
          return res.status(400).json({
            success: false,
            error: "Unsupported payment method",
          });
      }

      if (!paymentResult.success) {
        return res.status(400).json({
          success: false,
          error: paymentResult.message || "Payment failed",
        });
      }

      // Distribute revenue to creators
      const distributionResult = await incentive.distributeRevenue({
        templateId: id,
        buyerCompanyId,
        sourceType: "marketplace_sale",
        sourceId: paymentResult.paymentId,
        totalAmount: amount,
        currency: currency || "USD",
      });

      // Create subscription
      await db.insert(templateSubscriptions).values({
        companyId: buyerCompanyId,
        templateId: id,
        autoUpdate: false,
        updateChannel: "stable",
      });

      // Update download count
      await db
        .update(companyTemplates)
        .set({
          downloadCount: sql`${companyTemplates.downloadCount} + 1`,
        })
        .where(eq(companyTemplates.id, id));

      res.json({
        success: true,
        data: {
          paymentId: paymentResult.paymentId,
          status: "completed",
          distributions: distributionResult.distributions,
        },
      });
    } catch (error) {
      console.error("Error purchasing template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to purchase template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/templates/{id}/install:
   *   post:
   *     summary: Install a purchased template
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               customizations:
   *                 type: object
   *               autoUpdate:
   *                 type: boolean
   *                 default: false
   *               updateChannel:
   *                 type: string
   *                 enum: [stable, beta, alpha]
   *                 default: stable
   *     responses:
   *       200:
   *         description: Template installed successfully
   *       401:
   *         description: Authentication required
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.post("/v1/marketplace/templates/:id/install", validate(installTemplateSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { customizations, autoUpdate, updateChannel } = req.body;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const companyId = actor.type === "agent" ? actor.companyId : actor.companyIds?.[0];
      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          error: "Company and user information required",
        });
      }

      // Check if template exists and is published
      const marketplaceEntry = await db.query.templateMarketplace.findFirst({
        with: {
          template: true,
        },
        where: and(
          eq(templateMarketplace.templateId, id),
          eq(templateMarketplace.status, "published")
        ),
      });

      if (!marketplaceEntry) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Check if already installed
      const existingSubscription = await db.query.templateSubscriptions.findFirst({
        where: and(
          eq(templateSubscriptions.companyId, companyId),
          eq(templateSubscriptions.templateId, id)
        ),
      });

      if (existingSubscription) {
        // Update subscription settings
        await db
          .update(templateSubscriptions)
          .set({
            autoUpdate: autoUpdate ?? existingSubscription.autoUpdate,
            updateChannel: updateChannel ?? existingSubscription.updateChannel,
            updatedAt: new Date(),
          })
          .where(eq(templateSubscriptions.id, existingSubscription.id));

        return res.json({
          success: true,
          data: {
            message: "Subscription updated",
            subscriptionId: existingSubscription.id,
          },
        });
      }

      // Create new subscription
      const [subscription] = await db.insert(templateSubscriptions).values({
        companyId,
        templateId: id,
        autoUpdate: autoUpdate ?? false,
        updateChannel: updateChannel ?? "stable",
      }).returning();

      res.json({
        success: true,
        data: {
          message: "Template installed successfully",
          subscriptionId: subscription.id,
          templateId: id,
        },
      });
    } catch (error) {
      console.error("Error installing template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to install template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/templates/{id}/fork:
   *   post:
   *     summary: Fork a template to create derivative
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               customizations:
   *                 type: object
   *               contribution:
   *                 type: string
   *     responses:
   *       200:
   *         description: Template forked successfully
   *       401:
   *         description: Authentication required
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.post("/v1/marketplace/templates/:id/fork", validate(forkTemplateSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { customizations, contribution } = req.body;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const companyId = actor.type === "agent" ? actor.companyId : actor.companyIds?.[0];
      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          error: "Company and user information required",
        });
      }

      // Verify template exists and is published
      const marketplaceEntry = await db.query.templateMarketplace.findFirst({
        where: and(
          eq(templateMarketplace.templateId, id),
          eq(templateMarketplace.status, "published")
        ),
      });

      if (!marketplaceEntry) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Fork template
      const forkResult = await engine.forkTemplate(id, companyId, userId, customizations);

      if (!forkResult.success) {
        return res.status(400).json({
          success: false,
          error: forkResult.error || "Failed to fork template",
        });
      }

      // Record lineage
      await incentive.recordTemplateFork(
        forkResult.newTemplateId!,
        id,
        userId,
        contribution || "Forked from original"
      );

      res.json({
        success: true,
        data: {
          templateId: forkResult.newTemplateId,
          parentTemplateId: id,
          message: "Template forked successfully",
        },
      });
    } catch (error) {
      console.error("Error forking template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fork template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/templates/{id}/versions:
   *   get:
   *     summary: List template versions
   *     tags: [Marketplace]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of template versions
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/templates/:id/versions", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      // Check if template exists
      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, id),
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Get versions (templates with this as parent)
      const versions = await db.query.companyTemplates.findMany({
        where: eq(companyTemplates.parentTemplateId, id),
        orderBy: [desc(companyTemplates.createdAt)],
        limit,
        offset,
      });

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companyTemplates)
        .where(eq(companyTemplates.parentTemplateId, id));
      const total = countResult[0]?.count || 0;

      res.json({
        success: true,
        data: versions.map((v: {
          id: string;
          version: string;
          name: string;
          description: string | null;
          createdBy: string;
          createdAt: Date;
          isActive: boolean;
        }) => ({
          id: v.id,
          version: v.version,
          name: v.name,
          description: v.description,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
          isActive: v.isActive,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error getting template versions:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get template versions",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/categories:
   *   get:
   *     summary: List template categories
   *     tags: [Marketplace]
   *     responses:
   *       200:
   *         description: List of categories
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/categories", async (_req: Request, res: Response) => {
    try {
      // Get unique categories from marketplace
      const categories = await db
        .selectDistinct({
          category: templateMarketplace.category,
        })
        .from(templateMarketplace)
        .where(eq(templateMarketplace.status, "published"));

      // Get count per category
      const categoriesWithCount = await Promise.all(
        categories.map(async (cat: { category: string }) => {
          const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(templateMarketplace)
            .where(
              and(
                eq(templateMarketplace.category, cat.category),
                eq(templateMarketplace.status, "published")
              )
            );
          return {
            name: cat.category,
            count: countResult[0]?.count || 0,
          };
        })
      );

      res.json({
        success: true,
        data: categoriesWithCount,
      });
    } catch (error) {
      console.error("Error listing categories:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list categories",
      });
    }
  });

  // ============================================
  // Company Template Management Routes
  // ============================================

  /**
   * @swagger
   * /api/v1/marketplace/company-templates:
   *   get:
   *     summary: List company's templates
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: companyId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: includeArchived
   *         schema:
   *           type: boolean
   *           default: false
   *     responses:
   *       200:
   *         description: List of company templates
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/company-templates", async (req: Request, res: Response) => {
    try {
      const companyId = req.query.companyId as string;
      const includeArchived = req.query.includeArchived === "true";
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: "companyId is required",
        });
      }

      // Check company access
      assertCompanyAccess(req, companyId);

      const conditions: ReturnType<typeof and>[] = [
        eq(companyTemplates.companyId, companyId),
      ];

      if (!includeArchived) {
        conditions.push(eq(companyTemplates.isActive, true));
      }

      const templates = await db.query.companyTemplates.findMany({
        where: (t) => and(...conditions),
        orderBy: [desc(companyTemplates.createdAt)],
      });

      // Get marketplace status for each template
      const templatesWithStatus = await Promise.all(
        templates.map(async (template: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          version: string;
          createdBy: string;
          downloadCount: number;
          createdAt: Date;
          updatedAt: Date;
          isActive: boolean;
          isDefault: boolean;
          isPublic: boolean;
          companyId: string;
        }) => {
          const marketplaceEntry = await db.query.templateMarketplace.findFirst({
            where: eq(templateMarketplace.templateId, template.id),
          });

          return {
            ...template,
            marketplaceStatus: marketplaceEntry?.status || null,
            category: marketplaceEntry?.category || null,
            tags: marketplaceEntry?.tags || null,
            rating: marketplaceEntry?.rating || null,
          };
        })
      );

      res.json({
        success: true,
        data: templatesWithStatus,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      console.error("Error listing company templates:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list company templates",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/company-templates:
   *   post:
   *     summary: Create company template
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - companyId
   *               - name
   *               - templatePackage
   *             properties:
   *               companyId:
   *                 type: string
   *               name:
   *                 type: string
   *               slug:
   *                 type: string
   *               description:
   *                 type: string
   *               category:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               templatePackage:
   *                 type: object
   *               isDefault:
   *                 type: boolean
   *                 default: false
   *     responses:
   *       201:
   *         description: Template created successfully
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       500:
   *         description: Server error
   */
  router.post("/v1/marketplace/company-templates", validate(createCompanyTemplateSchema), async (req: Request, res: Response) => {
    try {
      const { name, slug, description, category, tags, templatePackage, isDefault } = req.body;
      const companyId = req.query.companyId as string || req.body.companyId;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          error: "companyId is required",
        });
      }

      // Check company access
      assertCompanyAccess(req, companyId);

      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      // Generate slug if not provided
      const templateSlug = slug || engine.generateSlug(name);

      // Check for duplicate slug
      const existing = await db
        .select({ id: companyTemplates.id })
        .from(companyTemplates)
        .where(
          and(
            eq(companyTemplates.companyId, companyId),
            eq(companyTemplates.slug, templateSlug)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Template with slug "${templateSlug}" already exists`,
        });
      }

      // Create template
      const [template] = await db
        .insert(companyTemplates)
        .values({
          companyId,
          name,
          slug: templateSlug,
          description,
          version: "1.0.0",
          sourceType: "created",
          templatePackage: templatePackage as Record<string, unknown>,
          isActive: true,
          isDefault: isDefault ?? false,
          createdBy: userId || "unknown",
          updatedBy: userId || "unknown",
        })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          id: template.id,
          name: template.name,
          slug: template.slug,
          version: template.version,
          createdAt: template.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      console.error("Error creating template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/company-templates/{id}:
   *   get:
   *     summary: Get company template details
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Template details
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/company-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, id),
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Check company access
      assertCompanyAccess(req, template.companyId);

      // Get marketplace status
      const marketplaceEntry = await db.query.templateMarketplace.findFirst({
        where: eq(templateMarketplace.templateId, id),
      });

      // Get lineage
      const lineage = await db.query.templateLineages.findFirst({
        where: eq(templateLineages.templateId, id),
      });

      res.json({
        success: true,
        data: {
          ...template,
          marketplaceStatus: marketplaceEntry?.status || null,
          category: marketplaceEntry?.category || null,
          tags: marketplaceEntry?.tags || null,
          rating: marketplaceEntry?.rating || null,
          reviewCount: marketplaceEntry?.reviewCount || null,
          lineage: lineage
            ? {
                rootTemplateId: lineage.rootTemplateId,
                parentTemplateId: lineage.parentTemplateId,
                generation: lineage.generation,
                forkCount: lineage.forkCount,
              }
            : null,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      console.error("Error getting template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/company-templates/{id}:
   *   put:
   *     summary: Update company template
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               category:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               isActive:
   *                 type: boolean
   *               isDefault:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Template updated successfully
   *       400:
   *         description: Invalid request
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.put("/v1/marketplace/company-templates/:id", validate(updateCompanyTemplateSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, id),
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Check company access
      assertCompanyAccess(req, template.companyId);

      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      // Update template
      const [updated] = await db
        .update(companyTemplates)
        .set({
          ...updates,
          updatedBy: userId || "unknown",
          updatedAt: new Date(),
        })
        .where(eq(companyTemplates.id, id))
        .returning();

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      console.error("Error updating template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/company-templates/{id}:
   *   delete:
   *     summary: Archive (soft delete) company template
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Template archived successfully
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.delete("/v1/marketplace/company-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, id),
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Check company access
      assertCompanyAccess(req, template.companyId);

      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      // Soft delete by setting isActive to false
      const [updated] = await db
        .update(companyTemplates)
        .set({
          isActive: false,
          updatedBy: userId || "unknown",
          updatedAt: new Date(),
        })
        .where(eq(companyTemplates.id, id))
        .returning();

      res.json({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          isActive: updated.isActive,
          archivedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      console.error("Error archiving template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to archive template",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/company-templates/{id}/publish:
   *   post:
   *     summary: Publish template to marketplace
   *     tags: [Marketplace]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               category:
   *                 type: string
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *               price:
   *                 type: number
   *                 default: 0
   *     responses:
   *       200:
   *         description: Template published successfully
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Access denied
   *       404:
   *         description: Template not found
   *       500:
   *         description: Server error
   */
  router.post("/v1/marketplace/company-templates/:id/publish", validate(publishTemplateSchema), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { category, tags, price } = req.body;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, id),
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      // Check company access
      assertCompanyAccess(req, template.companyId);

      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      // Check if already published
      const existingEntry = await db.query.templateMarketplace.findFirst({
        where: eq(templateMarketplace.templateId, id),
      });

      if (existingEntry) {
        return res.status(409).json({
          success: false,
          error: "Template is already published to marketplace",
          data: {
            status: existingEntry.status,
          },
        });
      }

      // Generate share code
      const shareCode = `TPL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      // Update template
      await db
        .update(companyTemplates)
        .set({
          isPublic: true,
          shareCode,
          updatedAt: new Date(),
        })
        .where(eq(companyTemplates.id, id));

      // Create marketplace entry
      const [marketplaceEntry] = await db
        .insert(templateMarketplace)
        .values({
          companyId: template.companyId,
          templateId: id,
          status: "pending", // Requires approval
          category: category || "general",
          tags: tags || [],
        })
        .returning();

      res.json({
        success: true,
        data: {
          templateId: id,
          status: marketplaceEntry.status,
          shareCode,
          message: "Template submitted for marketplace approval",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
      console.error("Error publishing template:", error);
      res.status(500).json({
        success: false,
        error: "Failed to publish template",
      });
    }
  });

  // ============================================
  // Creator Routes
  // ============================================

  /**
   * @swagger
   * /api/v1/marketplace/creator/revenue:
   *   get:
   *     summary: Get creator revenue stats
   *     tags: [Marketplace, Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: period
   *         schema:
   *           type: string
   *           enum: [7d, 30d, 90d, 1y]
   *           default: 30d
   *         description: Time period for stats
   *     responses:
   *       200:
   *         description: Creator revenue statistics
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/creator/revenue", async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as string) || "30d";
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const companyId = actor.type === "agent" ? actor.companyId : actor.companyIds?.[0];
      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          error: "Company and user information required",
        });
      }

      // Get or create creator account
      const account = await db.query.creatorRevenueAccounts.findFirst({
        where: and(
          eq(creatorRevenueAccounts.companyId, companyId),
          eq(creatorRevenueAccounts.userId, userId)
        ),
      });

      if (!account) {
        return res.json({
          success: true,
          data: {
            totalEarned: 0,
            availableBalance: 0,
            withdrawnAmount: 0,
            pendingAmount: 0,
            tier: "bronze",
            periodStats: null,
          },
        });
      }

      // Calculate period
      const days = parseInt(period);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get revenue report
      const report = await incentive.getCreatorRevenueReport(account.id, {
        start: startDate,
        end: endDate,
      });

      // Get tier progress
      const tierProgress = await tier.getTierProgress(account.id);

      res.json({
        success: true,
        data: {
          accountId: account.id,
          totalEarned: account.totalEarned,
          availableBalance: account.availableBalance,
          withdrawnAmount: account.withdrawnAmount,
          pendingAmount: account.pendingAmount,
          tier: account.tier,
          totalTemplates: account.totalTemplates,
          totalDownloads: account.totalDownloads,
          totalForks: account.totalForks,
          averageRating: account.averageRating,
          periodStats: report?.summary || null,
          tierProgress,
        },
      });
    } catch (error) {
      console.error("Error getting creator revenue:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get creator revenue stats",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/creator/templates:
   *   get:
   *     summary: Get creator's templates
   *     tags: [Marketplace, Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: includeUnpublished
   *         schema:
   *           type: boolean
   *           default: false
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: List of creator's templates
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  router.get("/v1/marketplace/creator/templates", async (req: Request, res: Response) => {
    try {
      const includeUnpublished = req.query.includeUnpublished === "true";
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const companyId = actor.type === "agent" ? actor.companyId : actor.companyIds?.[0];
      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          error: "Company and user information required",
        });
      }

      // Get templates created by this user
      const conditions: ReturnType<typeof and>[] = [
        eq(companyTemplates.companyId, companyId),
        eq(companyTemplates.createdBy, userId),
      ];

      if (!includeUnpublished) {
        conditions.push(eq(companyTemplates.isPublic, true));
      }

      const templates = await db.query.companyTemplates.findMany({
        where: (t) => and(...conditions),
        orderBy: [desc(companyTemplates.createdAt)],
        limit,
        offset,
      });

      // Get marketplace status and stats for each
      const templatesWithDetails = await Promise.all(
        templates.map(async (template: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          version: string;
          isPublic: boolean;
          downloadCount: number;
          createdAt: Date;
        }) => {
          const marketplaceEntry = await db.query.templateMarketplace.findFirst({
            where: eq(templateMarketplace.templateId, template.id),
          });

          const stats = await db.query.templateRevenueStats.findFirst({
            where: eq(templateRevenueStats.templateId, template.id),
          });

          return {
            id: template.id,
            name: template.name,
            slug: template.slug,
            description: template.description,
            version: template.version,
            isPublic: template.isPublic,
            downloadCount: template.downloadCount,
            createdAt: template.createdAt,
            marketplaceStatus: marketplaceEntry?.status || null,
            category: marketplaceEntry?.category || null,
            tags: marketplaceEntry?.tags || null,
            rating: marketplaceEntry?.rating || null,
            reviewCount: marketplaceEntry?.reviewCount || null,
            stats: stats
              ? {
                  totalSales: stats.totalSales,
                  totalRevenue: stats.totalRevenue,
                  totalForks: stats.totalForks,
                  averageRating: stats.averageRating,
                }
              : null,
          };
        })
      );

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(companyTemplates)
        .where(and(...conditions));
      const total = countResult[0]?.count || 0;

      res.json({
        success: true,
        data: templatesWithDetails,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error getting creator templates:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get creator templates",
      });
    }
  });

  /**
   * @swagger
   * /api/v1/marketplace/creator/withdraw:
   *   post:
   *     summary: Request revenue withdrawal
   *     tags: [Marketplace, Creator]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *               - payoutMethod
   *             properties:
   *               amount:
   *                 type: number
   *               payoutMethod:
   *                 type: object
   *                 properties:
   *                   type:
   *                     type: string
   *                   currency:
   *                     type: string
   *                   accountNumber:
   *                     type: string
   *                   bankName:
   *                     type: string
   *     responses:
   *       200:
   *         description: Withdrawal request created
   *       400:
   *         description: Invalid request or insufficient balance
   *       401:
   *         description: Authentication required
   *       500:
   *         description: Server error
   */
  router.post("/v1/marketplace/creator/withdraw", async (req: Request, res: Response) => {
    try {
      const { amount, payoutMethod } = req.body;
      const actor = req.actor;

      if (actor.type === "none") {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const companyId = actor.type === "agent" ? actor.companyId : actor.companyIds?.[0];
      const userId = actor.type === "agent" ? actor.agentId : actor.userId;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          error: "Company and user information required",
        });
      }

      // Get creator account
      const account = await db.query.creatorRevenueAccounts.findFirst({
        where: and(
          eq(creatorRevenueAccounts.companyId, companyId),
          eq(creatorRevenueAccounts.userId, userId)
        ),
      });

      if (!account) {
        return res.status(400).json({
          success: false,
          error: "No revenue account found",
        });
      }

      // Request payout
      const result = await payment.requestPayout(account.id, amount, payoutMethod);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || "Failed to request payout",
        });
      }

      res.json({
        success: true,
        data: {
          requestId: result.requestId,
          amount,
          status: "pending",
          message: "Withdrawal request submitted successfully",
        },
      });
    } catch (error) {
      console.error("Error requesting withdrawal:", error);
      res.status(500).json({
        success: false,
        error: "Failed to request withdrawal",
      });
    }
  });

  return router;
}
