import type { Db } from "@jigongai/db";
import { eq, and, desc, sum } from "drizzle-orm";
import {
  companyTemplates,
  templateLineages,
  creatorRevenueAccounts,
  revenueRecords,
  creatorRevenueDistributions,
  templateRevenueStats,
} from "@jigongai/db";

// ============================================
// 方案A：保守稳健型 分配配置
// ============================================
export const REVENUE_SHARE_CONFIG = {
  platformFee: 15,        // 15% 平台抽成
  directCreator: 60,      // 60% 直接使用创作者
  ancestors: 15,          // 15% 直接父模板（简化）
  root: 10,               // 10% 根模板创作者
};

// ============================================
// 创作者等级配置
// ============================================
export const CREATOR_TIERS = [
  {
    tier: "bronze",
    name: "创作者",
    requirements: { templates: 1, downloads: 0, revenue: 0, rating: 0 },
    benefits: { revenueBonus: 0, platformFeeDiscount: 0 },
  },
  {
    tier: "silver",
    name: "资深创作者",
    requirements: { templates: 3, downloads: 50, revenue: 500, rating: 4.0 },
    benefits: { revenueBonus: 5, platformFeeDiscount: 2 },
  },
  {
    tier: "gold",
    name: "金牌创作者",
    requirements: { templates: 5, downloads: 200, revenue: 2000, rating: 4.2 },
    benefits: { revenueBonus: 10, platformFeeDiscount: 5 },
  },
  {
    tier: "platinum",
    name: "白金创作者",
    requirements: { templates: 10, downloads: 1000, revenue: 10000, rating: 4.5 },
    benefits: { revenueBonus: 15, platformFeeDiscount: 10 },
  },
  {
    tier: "diamond",
    name: "钻石创作者",
    requirements: { templates: 20, downloads: 5000, revenue: 50000, rating: 4.8 },
    benefits: { revenueBonus: 20, platformFeeDiscount: 15 },
  },
];

export interface RevenueDistributionInput {
  templateId: string;
  buyerCompanyId?: string;
  sourceType: "subscription" | "transaction" | "customization" | "marketplace_sale";
  sourceId?: string;
  totalAmount: number;  // 金额（分或最小单位）
  currency: string;
}

export interface RevenueDistributionResult {
  success: boolean;
  revenueRecordId?: string;
  distributions: Array<{
    accountId: string;
    creatorName: string;
    amount: number;
    percentage: number;
    type: "direct_creator" | "parent_template" | "root_template";
  }>;
  platformFee: number;
  error?: string;
}

export function creatorIncentiveService(db: Db) {
  return {
    // ============================================
    // 核心：收益分配计算与执行
    // ============================================

    /**
     * 计算并执行收益分配
     * 方案A：保守稳健型
     */
    async distributeRevenue(
      input: RevenueDistributionInput
    ): Promise<RevenueDistributionResult> {
      try {
        // 1. 获取模板信息
        const template = await db.query.companyTemplates.findFirst({
          where: eq(companyTemplates.id, input.templateId),
        });

        if (!template) {
          return { success: false, error: "Template not found", distributions: [], platformFee: 0 };
        }

        // 2. 获取模板谱系
        const lineage = await db.query.templateLineages.findFirst({
          where: eq(templateLineages.templateId, input.templateId),
        });

        // 3. 创建收益记录
        const platformFee = Math.round(input.totalAmount * REVENUE_SHARE_CONFIG.platformFee / 100);
        const directShare = Math.round(input.totalAmount * REVENUE_SHARE_CONFIG.directCreator / 100);
        const ancestorShare = Math.round(input.totalAmount * REVENUE_SHARE_CONFIG.ancestors / 100);
        const rootShare = input.totalAmount - platformFee - directShare - ancestorShare;

        const [revenueRecord] = await db
          .insert(revenueRecords)
          .values({
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            templateId: input.templateId,
            buyerCompanyId: input.buyerCompanyId,
            totalAmount: input.totalAmount.toString(),
            currency: input.currency,
            platformFee: platformFee.toString(),
            directCreatorShare: directShare.toString(),
            ancestorShare: ancestorShare.toString(),
            rootShare: rootShare.toString(),
            status: "pending",
          })
          .returning();

        const distributions: RevenueDistributionResult["distributions"] = [];

        // 4. 分配直接创作者收益
        if (template.createdBy) {
          const directAccount = await this.getOrCreateAccount(template.companyId, template.createdBy);
          await db.insert(creatorRevenueDistributions).values({
            revenueRecordId: revenueRecord.id,
            accountId: directAccount.id,
            amount: directShare.toString(),
            percentage: REVENUE_SHARE_CONFIG.directCreator,
            distributionType: "direct_creator",
            status: "pending",
          });
          distributions.push({
            accountId: directAccount.id,
            creatorName: directAccount.creatorName || "Unknown",
            amount: directShare,
            percentage: REVENUE_SHARE_CONFIG.directCreator,
            type: "direct_creator",
          });
        }

        // 5. 分配父模板收益（简化：只给直接父）
        if (lineage?.parentTemplateId && lineage.parentInfo) {
          const parentCreatorId = (lineage.parentInfo as { creatorId?: string }).creatorId;
          if (parentCreatorId) {
            const parentAccount = await this.getOrCreateAccount(template.companyId, parentCreatorId);
            await db.insert(creatorRevenueDistributions).values({
              revenueRecordId: revenueRecord.id,
              accountId: parentAccount.id,
              amount: ancestorShare.toString(),
              percentage: REVENUE_SHARE_CONFIG.ancestors,
              distributionType: "parent_template",
              status: "pending",
            });
            distributions.push({
              accountId: parentAccount.id,
              creatorName: parentAccount.creatorName || "Unknown",
              amount: ancestorShare,
              percentage: REVENUE_SHARE_CONFIG.ancestors,
              type: "parent_template",
            });
          }
        } else if (template.createdBy) {
          // 没有父模板，祖先收益归直接使用创作者
          const directAccount = distributions[0];
          if (directAccount) {
            await db
              .update(creatorRevenueDistributions)
              .set({
                amount: (directShare + ancestorShare).toString(),
                percentage: REVENUE_SHARE_CONFIG.directCreator + REVENUE_SHARE_CONFIG.ancestors,
              })
              .where(
                and(
                  eq(creatorRevenueDistributions.revenueRecordId, revenueRecord.id),
                  eq(creatorRevenueDistributions.distributionType, "direct_creator")
                )
              );
            directAccount.amount += ancestorShare;
            directAccount.percentage += REVENUE_SHARE_CONFIG.ancestors;
          }
        }

        // 6. 分配根模板收益
        if (lineage?.rootTemplateId) {
          const rootTemplate = await db.query.companyTemplates.findFirst({
            where: eq(companyTemplates.id, lineage.rootTemplateId),
          });
          if (rootTemplate?.createdBy && rootTemplate.createdBy !== template.createdBy) {
            const rootAccount = await this.getOrCreateAccount(template.companyId, rootTemplate.createdBy);
            await db.insert(creatorRevenueDistributions).values({
              revenueRecordId: revenueRecord.id,
              accountId: rootAccount.id,
              amount: rootShare.toString(),
              percentage: REVENUE_SHARE_CONFIG.root,
              distributionType: "root_template",
              status: "pending",
            });
            distributions.push({
              accountId: rootAccount.id,
              creatorName: rootAccount.creatorName || "Unknown",
              amount: rootShare,
              percentage: REVENUE_SHARE_CONFIG.root,
              type: "root_template",
            });
          } else if (template.createdBy) {
            // 根模板就是自己，根收益归直接使用创作者
            const directAccount = distributions[0];
            if (directAccount) {
              await db
                .update(creatorRevenueDistributions)
                .set({
                  amount: (parseFloat(directAccount.amount.toString()) + rootShare).toString(),
                  percentage: directAccount.percentage + REVENUE_SHARE_CONFIG.root,
                })
                .where(
                  and(
                    eq(creatorRevenueDistributions.revenueRecordId, revenueRecord.id),
                    eq(creatorRevenueDistributions.distributionType, "direct_creator")
                  )
                );
              directAccount.amount += rootShare;
              directAccount.percentage += REVENUE_SHARE_CONFIG.root;
            }
          }
        }

        // 7. 标记为已分配
        await db
          .update(revenueRecords)
          .set({
            status: "distributed",
            distributedAt: new Date(),
          })
          .where(eq(revenueRecords.id, revenueRecord.id));

        // 8. 更新模板统计
        await this.updateTemplateStats(input.templateId, input.totalAmount);

        return {
          success: true,
          revenueRecordId: revenueRecord.id,
          distributions,
          platformFee,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          distributions: [],
          platformFee: 0,
        };
      }
    },

    /**
     * 获取或创建创作者账户
     */
    async getOrCreateAccount(
      companyId: string,
      userId: string
    ): Promise<{ id: string; creatorName?: string }> {
      const existing = await db.query.creatorRevenueAccounts.findFirst({
        where: and(
          eq(creatorRevenueAccounts.companyId, companyId),
          eq(creatorRevenueAccounts.userId, userId)
        ),
      });

      if (existing) {
        return { id: existing.id, creatorName: userId };
      }

      const [account] = await db
        .insert(creatorRevenueAccounts)
        .values({
          companyId,
          userId,
          tier: "bronze",
        })
        .returning();

      return { id: account.id, creatorName: userId };
    },

    // ============================================
    // 模板谱系管理
    // ============================================

    /**
     * 记录模板分叉
     */
    async recordTemplateFork(
      templateId: string,
      parentTemplateId: string,
      creatorId: string,
      contribution: string
    ): Promise<void> {
      // 获取父模板谱系
      const parentLineage = await db.query.templateLineages.findFirst({
        where: eq(templateLineages.templateId, parentTemplateId),
      });

      const generation = parentLineage ? parentLineage.generation + 1 : 1;
      const rootTemplateId = parentLineage?.rootTemplateId || parentTemplateId;

      await db.insert(templateLineages).values({
        templateId,
        rootTemplateId,
        parentTemplateId,
        generation,
        parentInfo: {
          creatorId,
          forkedAt: new Date().toISOString(),
          contribution,
        },
      });

      // 更新父模板的 fork 计数
      if (parentLineage) {
        await db
          .update(templateLineages)
          .set({ forkCount: parentLineage.forkCount + 1 })
          .where(eq(templateLineages.templateId, parentTemplateId));
      }
    },

    // ============================================
    // 统计与报告
    // ============================================

    /**
     * 更新模板收入统计
     */
    async updateTemplateStats(templateId: string, revenueAmount: number): Promise<void> {
      const existing = await db.query.templateRevenueStats.findFirst({
        where: eq(templateRevenueStats.templateId, templateId),
      });

      if (existing) {
        await db
          .update(templateRevenueStats)
          .set({
            totalSales: existing.totalSales + 1,
            totalRevenue: (parseFloat(existing.totalRevenue) + revenueAmount).toString(),
            monthlySales: existing.monthlySales + 1,
            monthlyRevenue: (parseFloat(existing.monthlyRevenue) + revenueAmount).toString(),
            statsUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(templateRevenueStats.templateId, templateId));
      } else {
        await db.insert(templateRevenueStats).values({
          templateId,
          totalSales: 1,
          totalRevenue: revenueAmount.toString(),
          monthlySales: 1,
          monthlyRevenue: revenueAmount.toString(),
        });
      }
    },

    /**
     * 获取创作者收入报告
     */
    async getCreatorRevenueReport(
      accountId: string,
      period: { start: Date; end: Date }
    ) {
      const account = await db.query.creatorRevenueAccounts.findFirst({
        where: eq(creatorRevenueAccounts.id, accountId),
      });

      if (!account) return null;

      // 获取该周期内的收益
      const distributions = await db.query.creatorRevenueDistributions.findMany({
        where: and(
          eq(creatorRevenueDistributions.accountId, accountId),
          eq(creatorRevenueDistributions.status, "credited")
        ),
      });

      // 按类型汇总
      const summary = {
        directCreator: 0,
        parentTemplate: 0,
        rootTemplate: 0,
        total: 0,
      };

      for (const dist of distributions) {
        const amount = parseFloat(dist.amount);
        summary.total += amount;
        if (dist.distributionType === "direct_creator") {
          summary.directCreator += amount;
        } else if (dist.distributionType === "parent_template") {
          summary.parentTemplate += amount;
        } else if (dist.distributionType === "root_template") {
          summary.rootTemplate += amount;
        }
      }

      return {
        account,
        summary,
        distributions,
        period,
      };
    },

    /**
     * 获取热门模板排行榜
     */
    async getTopTemplates(limit: number = 10) {
      return await db.query.templateRevenueStats.findMany({
        orderBy: desc(templateRevenueStats.totalRevenue),
        limit,
      });
    },

    // ============================================
    // 创作者等级系统
    // ============================================

    /**
     * 检查并更新创作者等级
     */
    async checkAndUpdateTier(accountId: string): Promise<string | null> {
      const account = await db.query.creatorRevenueAccounts.findFirst({
        where: eq(creatorRevenueAccounts.id, accountId),
      });

      if (!account) return null;

      const currentTierIndex = CREATOR_TIERS.findIndex(t => t.tier === account.tier);

      // 检查是否可以升级
      for (let i = currentTierIndex + 1; i < CREATOR_TIERS.length; i++) {
        const nextTier = CREATOR_TIERS[i];
        const meetsRequirements =
          account.totalTemplates >= nextTier.requirements.templates &&
          account.totalDownloads >= nextTier.requirements.downloads &&
          parseFloat(account.totalEarned) >= nextTier.requirements.revenue;

        if (meetsRequirements) {
          await db
            .update(creatorRevenueAccounts)
            .set({
              tier: nextTier.tier,
              tierUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(creatorRevenueAccounts.id, accountId));

          return nextTier.tier;
        }
      }

      return null;
    },

    /**
     * 获取等级权益
     */
    getTierBenefits(tier: string) {
      const tierConfig = CREATOR_TIERS.find(t => t.tier === tier);
      return tierConfig?.benefits || { revenueBonus: 0, platformFeeDiscount: 0 };
    },
  };
}

export type CreatorIncentiveService = ReturnType<typeof creatorIncentiveService>;
