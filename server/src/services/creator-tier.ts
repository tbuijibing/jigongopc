import type { Db } from "@jigongai/db";
import { eq, and, gte, sql, desc, count, avg } from "drizzle-orm";
import {
  creatorRevenueAccounts,
  companyTemplates,
  templateMarketplace,
  revenueRecords,
  creatorPayoutRequests,
} from "@jigongai/db";

// ============================================
// Creator Tier System
// Supports: Automatic tier calculation, Revenue sharing, Governance voting
// Features: Tier benefits, Upgrade/downgrade notifications, Diamond elections
// ============================================

// Creator tier levels
export type CreatorTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

// Tier upgrade eligibility information
export interface TierUpgradeInfo {
  eligible: boolean;
  currentTier: CreatorTier;
  potentialTier: CreatorTier;
  reasons: string[];
  meetsRevenue: boolean;
  meetsTemplateCount: boolean;
  meetsRating: boolean;
  currentRevenue: number;
  currentTemplateCount: number;
  currentAvgRating: number;
}

// Tier benefits configuration
export interface TierBenefits {
  revenueSharePercentage: number; // Percentage creator keeps (e.g., 70 = 70%)
  platformFeePercentage: number; // Percentage platform takes
  withdrawalFrequency: "weekly" | "biweekly" | "monthly" | "anytime";
  maxWithdrawalAmount: number; // Maximum withdrawal per request (0 = unlimited)
  minWithdrawalAmount: number; // Minimum withdrawal amount
  prioritySupport: boolean;
  featuredListing: boolean;
  analyticsAccess: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  earlyAccess: boolean;
  dedicatedAccountManager: boolean;
}

// Revenue split between creator and platform
export interface RevenueSplit {
  creatorAmount: number;
  platformAmount: number;
  creatorPercentage: number;
  platformPercentage: number;
  tier: CreatorTier;
}

// Diamond tier nomination
export interface Nomination {
  id: string;
  creatorId: string;
  creatorName: string;
  nominatorId: string;
  nominatorName: string;
  nominatedAt: Date;
  votesFor: number;
  votesAgainst: number;
  status: "active" | "passed" | "rejected" | "expired";
  expiresAt: Date;
  votes: Vote[];
}

// Individual vote
export interface Vote {
  voterId: string;
  voterName: string;
  vote: boolean; // true = for, false = against
  votedAt: Date;
  comment?: string;
}

// Vote result
export interface VoteResult {
  success: boolean;
  nominationId: string;
  totalVotes: number;
  votesFor: number;
  votesAgainst: number;
  passed: boolean | null; // null if still active
  message: string;
}

// Tier thresholds configuration
const TIER_THRESHOLDS = {
  silver: {
    revenue: 1000, // ¥1,000
    templateCount: 3,
    minRating: 0, // No rating requirement
  },
  gold: {
    revenue: 10000, // ¥10,000
    templateCount: 10,
    minRating: 4.5,
  },
  platinum: {
    revenue: 50000, // ¥50,000
    templateCount: 25,
    minRating: 4.7,
  },
  diamond: {
    // Diamond is by governance only
    revenue: 100000, // ¥100,000 (informational)
    templateCount: 50,
    minRating: 4.8,
  },
};

// Revenue share percentages by tier
const REVENUE_SHARE: Record<CreatorTier, { creator: number; platform: number }> = {
  bronze: { creator: 60, platform: 40 },
  silver: { creator: 70, platform: 30 },
  gold: { creator: 80, platform: 20 },
  platinum: { creator: 85, platform: 15 },
  diamond: { creator: 90, platform: 10 },
};

// Tier benefits configuration
const TIER_BENEFITS: Record<CreatorTier, TierBenefits> = {
  bronze: {
    revenueSharePercentage: REVENUE_SHARE.bronze.creator,
    platformFeePercentage: REVENUE_SHARE.bronze.platform,
    withdrawalFrequency: "monthly",
    maxWithdrawalAmount: 5000,
    minWithdrawalAmount: 100,
    prioritySupport: false,
    featuredListing: false,
    analyticsAccess: false,
    customBranding: false,
    apiAccess: false,
    earlyAccess: false,
    dedicatedAccountManager: false,
  },
  silver: {
    revenueSharePercentage: REVENUE_SHARE.silver.creator,
    platformFeePercentage: REVENUE_SHARE.silver.platform,
    withdrawalFrequency: "biweekly",
    maxWithdrawalAmount: 10000,
    minWithdrawalAmount: 50,
    prioritySupport: false,
    featuredListing: false,
    analyticsAccess: true,
    customBranding: false,
    apiAccess: false,
    earlyAccess: false,
    dedicatedAccountManager: false,
  },
  gold: {
    revenueSharePercentage: REVENUE_SHARE.gold.creator,
    platformFeePercentage: REVENUE_SHARE.gold.platform,
    withdrawalFrequency: "weekly",
    maxWithdrawalAmount: 50000,
    minWithdrawalAmount: 10,
    prioritySupport: true,
    featuredListing: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    earlyAccess: true,
    dedicatedAccountManager: false,
  },
  platinum: {
    revenueSharePercentage: REVENUE_SHARE.platinum.creator,
    platformFeePercentage: REVENUE_SHARE.platinum.platform,
    withdrawalFrequency: "anytime",
    maxWithdrawalAmount: 0, // Unlimited
    minWithdrawalAmount: 1,
    prioritySupport: true,
    featuredListing: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    earlyAccess: true,
    dedicatedAccountManager: true,
  },
  diamond: {
    revenueSharePercentage: REVENUE_SHARE.diamond.creator,
    platformFeePercentage: REVENUE_SHARE.diamond.platform,
    withdrawalFrequency: "anytime",
    maxWithdrawalAmount: 0, // Unlimited
    minWithdrawalAmount: 1,
    prioritySupport: true,
    featuredListing: true,
    analyticsAccess: true,
    customBranding: true,
    apiAccess: true,
    earlyAccess: true,
    dedicatedAccountManager: true,
  },
};

// In-memory storage for Diamond nominations (should be moved to database in production)
const diamondNominations: Map<string, Nomination> = new Map();
const DIAMOND_VOTING_PERIOD_DAYS = 14;
const DIAMOND_MINIMUM_VOTES = 10;
const DIAMOND_PASS_THRESHOLD = 0.7; // 70% approval required

export function creatorTierService(db: Db) {
  return {
    // ============================================
    // Tier Calculation
    // ============================================

    /**
     * Calculate creator tier based on revenue and template criteria
     */
    async calculateCreatorTier(creatorId: string): Promise<CreatorTier> {
      const stats = await this.getCreatorStats(creatorId);

      // Check tiers from highest to lowest (excluding Diamond which is governance-only)
      if (stats.totalRevenue >= TIER_THRESHOLDS.platinum.revenue ||
          (stats.templateCount >= TIER_THRESHOLDS.platinum.templateCount &&
           stats.averageRating >= TIER_THRESHOLDS.platinum.minRating)) {
        return "platinum";
      }

      if (stats.totalRevenue >= TIER_THRESHOLDS.gold.revenue ||
          (stats.templateCount >= TIER_THRESHOLDS.gold.templateCount &&
           stats.averageRating >= TIER_THRESHOLDS.gold.minRating)) {
        return "gold";
      }

      if (stats.totalRevenue >= TIER_THRESHOLDS.silver.revenue ||
          stats.templateCount >= TIER_THRESHOLDS.silver.templateCount) {
        return "silver";
      }

      return "bronze";
    },

    /**
     * Check if creator qualifies for tier upgrade
     */
    async checkTierUpgradeEligibility(creatorId: string): Promise<TierUpgradeInfo> {
      const [account] = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.companyId, creatorId))
        .limit(1);

      const currentTier: CreatorTier = (account?.tier as CreatorTier) || "bronze";
      const stats = await this.getCreatorStats(creatorId);

      // Determine potential tier
      let potentialTier: CreatorTier = currentTier;
      const reasons: string[] = [];

      // Check each tier level
      const tierChecks: CreatorTier[] = ["silver", "gold", "platinum"];
      for (const tier of tierChecks) {
        const threshold = TIER_THRESHOLDS[tier];
        const meetsRevenue = stats.totalRevenue >= threshold.revenue;
        const meetsTemplateCount = stats.templateCount >= threshold.templateCount;
        const meetsRating = stats.averageRating >= threshold.minRating;

        if (meetsRevenue || (meetsTemplateCount && meetsRating)) {
          potentialTier = tier;
        }
      }

      // Build reasons
      if (stats.totalRevenue >= TIER_THRESHOLDS.platinum.revenue) {
        reasons.push(`Revenue ¥${stats.totalRevenue.toLocaleString()} exceeds Platinum threshold (¥${TIER_THRESHOLDS.platinum.revenue.toLocaleString()})`);
      } else if (stats.totalRevenue >= TIER_THRESHOLDS.gold.revenue) {
        reasons.push(`Revenue ¥${stats.totalRevenue.toLocaleString()} exceeds Gold threshold (¥${TIER_THRESHOLDS.gold.revenue.toLocaleString()})`);
      } else if (stats.totalRevenue >= TIER_THRESHOLDS.silver.revenue) {
        reasons.push(`Revenue ¥${stats.totalRevenue.toLocaleString()} exceeds Silver threshold (¥${TIER_THRESHOLDS.silver.revenue.toLocaleString()})`);
      }

      if (stats.templateCount >= TIER_THRESHOLDS.platinum.templateCount && stats.averageRating >= TIER_THRESHOLDS.platinum.minRating) {
        reasons.push(`${stats.templateCount} templates with ${stats.averageRating.toFixed(2)} avg rating meets Platinum criteria`);
      } else if (stats.templateCount >= TIER_THRESHOLDS.gold.templateCount && stats.averageRating >= TIER_THRESHOLDS.gold.minRating) {
        reasons.push(`${stats.templateCount} templates with ${stats.averageRating.toFixed(2)} avg rating meets Gold criteria`);
      } else if (stats.templateCount >= TIER_THRESHOLDS.silver.templateCount) {
        reasons.push(`${stats.templateCount} templates meets Silver criteria`);
      }

      const eligible = potentialTier !== currentTier && potentialTier > currentTier;

      return {
        eligible,
        currentTier,
        potentialTier,
        reasons,
        meetsRevenue: stats.totalRevenue >= TIER_THRESHOLDS[potentialTier].revenue,
        meetsTemplateCount: stats.templateCount >= TIER_THRESHOLDS[potentialTier].templateCount,
        meetsRating: stats.averageRating >= TIER_THRESHOLDS[potentialTier].minRating,
        currentRevenue: stats.totalRevenue,
        currentTemplateCount: stats.templateCount,
        currentAvgRating: stats.averageRating,
      };
    },

    /**
     * Apply tier upgrade and notify creator
     */
    async applyTierUpgrade(creatorId: string, newTier: CreatorTier): Promise<void> {
      const [account] = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.companyId, creatorId))
        .limit(1);

      if (!account) {
        throw new Error("Creator revenue account not found");
      }

      const oldTier = (account.tier as CreatorTier) || "bronze";

      // Update tier in database
      await db
        .update(creatorRevenueAccounts)
        .set({
          tier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(creatorRevenueAccounts.id, account.id));

      // Apply new benefits
      await this.applyBenefits(creatorId);

      // Notify creator
      if (newTier > oldTier) {
        await this.notifyTierUpgrade(creatorId, newTier);
      } else if (newTier < oldTier) {
        await this.notifyTierDowngrade(creatorId, oldTier, newTier);
      }

      // Log tier change
      console.log(`[TierLog] Creator ${creatorId} tier changed: ${oldTier} -> ${newTier}`);
    },

    /**
     * Get creator statistics
     */
    async getCreatorStats(creatorId: string): Promise<{
      totalRevenue: number;
      templateCount: number;
      averageRating: number;
      totalSales: number;
    }> {
      // Get total revenue
      const [revenueResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${revenueRecords.totalAmount}), 0)`,
        })
        .from(revenueRecords)
        .where(
          and(
            eq(revenueRecords.creatorCompanyId, creatorId),
            eq(revenueRecords.status, "distributed")
          )
        );

      // Get template count and ratings
      const [templateStats] = await db
        .select({
          count: count(companyTemplates.id),
          avgRating: avg(templateMarketplace.rating),
        })
        .from(companyTemplates)
        .leftJoin(
          templateMarketplace,
          eq(companyTemplates.id, templateMarketplace.templateId)
        )
        .where(
          and(
            eq(companyTemplates.companyId, creatorId),
            eq(companyTemplates.isPublic, true)
          )
        );

      // Get total sales count
      const [salesResult] = await db
        .select({
          count: count(revenueRecords.id),
        })
        .from(revenueRecords)
        .where(
          and(
            eq(revenueRecords.creatorCompanyId, creatorId),
            eq(revenueRecords.status, "distributed")
          )
        );

      return {
        totalRevenue: Number(revenueResult?.total || 0),
        templateCount: Number(templateStats?.count || 0),
        averageRating: Number(templateStats?.avgRating || 0),
        totalSales: Number(salesResult?.count || 0),
      };
    },

    // ============================================
    // Tier Benefits
    // ============================================

    /**
     * Get benefits for a specific tier
     */
    getTierBenefits(tier: CreatorTier): TierBenefits {
      return { ...TIER_BENEFITS[tier] };
    },

    /**
     * Apply tier benefits to creator account
     */
    async applyBenefits(creatorId: string): Promise<void> {
      const [account] = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.companyId, creatorId))
        .limit(1);

      if (!account) {
        throw new Error("Creator revenue account not found");
      }

      const tier = (account.tier as CreatorTier) || "bronze";
      const benefits = this.getTierBenefits(tier);

      // Update account with tier-specific settings
      await db
        .update(creatorRevenueAccounts)
        .set({
          withdrawalFrequency: benefits.withdrawalFrequency,
          maxWithdrawalAmount: benefits.maxWithdrawalAmount.toString(),
          minWithdrawalAmount: benefits.minWithdrawalAmount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(creatorRevenueAccounts.id, account.id));

      // Log benefits application
      console.log(`[TierLog] Applied ${tier} tier benefits to creator ${creatorId}`);
    },

    // ============================================
    // Revenue Share
    // ============================================

    /**
     * Calculate revenue distribution based on tier
     */
    calculateRevenueShare(creatorId: string, amount: number): RevenueSplit {
      // Get creator's tier (this would typically be cached or passed in)
      // For now, we'll use a synchronous approach with default tier
      // In production, this should be fetched from the database or cache
      const tier: CreatorTier = "bronze"; // Default, should be fetched
      const percentage = this.getRevenueSharePercentage(tier);

      const creatorAmount = Math.floor((amount * percentage) / 100);
      const platformAmount = amount - creatorAmount;

      return {
        creatorAmount,
        platformAmount,
        creatorPercentage: percentage,
        platformPercentage: 100 - percentage,
        tier,
      };
    },

    /**
     * Calculate revenue distribution with async tier lookup
     */
    async calculateRevenueShareAsync(creatorId: string, amount: number): Promise<RevenueSplit> {
      const tier = await this.calculateCreatorTier(creatorId);
      const percentage = this.getRevenueSharePercentage(tier);

      const creatorAmount = Math.floor((amount * percentage) / 100);
      const platformAmount = amount - creatorAmount;

      return {
        creatorAmount,
        platformAmount,
        creatorPercentage: percentage,
        platformPercentage: 100 - percentage,
        tier,
      };
    },

    /**
     * Get revenue share percentage for a tier
     */
    getRevenueSharePercentage(tier: CreatorTier): number {
      return REVENUE_SHARE[tier].creator;
    },

    /**
     * Get platform fee percentage for a tier
     */
    getPlatformFeePercentage(tier: CreatorTier): number {
      return REVENUE_SHARE[tier].platform;
    },

    // ============================================
    // Governance (Diamond Tier)
    // ============================================

    /**
     * Nominate a creator for Diamond tier
     */
    async nominateForDiamond(
      creatorId: string,
      nominatorId: string
    ): Promise<Nomination> {
      // Check if creator exists and is eligible
      const stats = await this.getCreatorStats(creatorId);

      // Diamond tier has minimum requirements even for nomination
      if (stats.totalRevenue < TIER_THRESHOLDS.diamond.revenue * 0.5 &&
          stats.templateCount < TIER_THRESHOLDS.diamond.templateCount * 0.5) {
        throw new Error("Creator does not meet minimum requirements for Diamond nomination");
      }

      // Check if creator is already Diamond
      const [account] = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.companyId, creatorId))
        .limit(1);

      if (account?.tier === "diamond") {
        throw new Error("Creator is already Diamond tier");
      }

      // Check for existing active nomination
      const existingNomination = Array.from(diamondNominations.values()).find(
        n => n.creatorId === creatorId && n.status === "active"
      );

      if (existingNomination) {
        throw new Error("Creator already has an active nomination");
      }

      // Create nomination
      const nomination: Nomination = {
        id: `nom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creatorId,
        creatorName: account?.companyId || creatorId, // Would fetch actual name
        nominatorId,
        nominatorName: nominatorId, // Would fetch actual name
        nominatedAt: new Date(),
        votesFor: 0,
        votesAgainst: 0,
        status: "active",
        expiresAt: new Date(Date.now() + DIAMOND_VOTING_PERIOD_DAYS * 24 * 60 * 60 * 1000),
        votes: [],
      };

      diamondNominations.set(nomination.id, nomination);

      console.log(`[TierLog] Diamond nomination created: ${nomination.id} for creator ${creatorId}`);

      return nomination;
    },

    /**
     * Cast vote for Diamond promotion
     */
    async voteForDiamond(
      nominationId: string,
      voterId: string,
      vote: boolean
    ): Promise<VoteResult> {
      const nomination = diamondNominations.get(nominationId);

      if (!nomination) {
        return {
          success: false,
          nominationId,
          totalVotes: 0,
          votesFor: 0,
          votesAgainst: 0,
          passed: null,
          message: "Nomination not found",
        };
      }

      if (nomination.status !== "active") {
        return {
          success: false,
          nominationId,
          totalVotes: nomination.votes.length,
          votesFor: nomination.votesFor,
          votesAgainst: nomination.votesAgainst,
          passed: null,
          message: `Nomination is ${nomination.status}`,
        };
      }

      if (new Date() > nomination.expiresAt) {
        nomination.status = "expired";
        return {
          success: false,
          nominationId,
          totalVotes: nomination.votes.length,
          votesFor: nomination.votesFor,
          votesAgainst: nomination.votesAgainst,
          passed: null,
          message: "Nomination has expired",
        };
      }

      // Check if voter already voted
      const existingVote = nomination.votes.find(v => v.voterId === voterId);
      if (existingVote) {
        return {
          success: false,
          nominationId,
          totalVotes: nomination.votes.length,
          votesFor: nomination.votesFor,
          votesAgainst: nomination.votesAgainst,
          passed: null,
          message: "Voter has already cast a vote",
        };
      }

      // Record vote
      nomination.votes.push({
        voterId,
        voterName: voterId, // Would fetch actual name
        vote,
        votedAt: new Date(),
      });

      if (vote) {
        nomination.votesFor++;
      } else {
        nomination.votesAgainst++;
      }

      const totalVotes = nomination.votes.length;
      const approvalRate = totalVotes > 0 ? nomination.votesFor / totalVotes : 0;

      // Check if passed
      let passed: boolean | null = null;
      if (totalVotes >= DIAMOND_MINIMUM_VOTES) {
        if (approvalRate >= DIAMOND_PASS_THRESHOLD) {
          passed = true;
          nomination.status = "passed";
          // Apply Diamond tier
          await this.applyTierUpgrade(nomination.creatorId, "diamond");
        } else if (approvalRate < 0.5) {
          passed = false;
          nomination.status = "rejected";
        }
      }

      console.log(`[TierLog] Vote cast on nomination ${nominationId}: ${vote ? "for" : "against"}`);

      return {
        success: true,
        nominationId,
        totalVotes,
        votesFor: nomination.votesFor,
        votesAgainst: nomination.votesAgainst,
        passed,
        message: passed === true
          ? "Nomination passed! Creator promoted to Diamond tier."
          : passed === false
          ? "Nomination rejected."
          : "Vote recorded. Awaiting more votes.",
      };
    },

    /**
     * List active Diamond nominations
     */
    getDiamondNominations(): Nomination[] {
      return Array.from(diamondNominations.values())
        .filter(n => n.status === "active")
        .sort((a, b) => b.nominatedAt.getTime() - a.nominatedAt.getTime());
    },

    /**
     * Get all Diamond nominations (including completed)
     */
    getAllDiamondNominations(): Nomination[] {
      return Array.from(diamondNominations.values())
        .sort((a, b) => b.nominatedAt.getTime() - a.nominatedAt.getTime());
    },

    /**
     * Process completed Diamond elections
     */
    async processDiamondElections(): Promise<void> {
      const now = new Date();
      const activeNominations = Array.from(diamondNominations.values())
        .filter(n => n.status === "active");

      for (const nomination of activeNominations) {
        if (now > nomination.expiresAt) {
          const totalVotes = nomination.votes.length;
          const approvalRate = totalVotes > 0 ? nomination.votesFor / totalVotes : 0;

          if (totalVotes >= DIAMOND_MINIMUM_VOTES && approvalRate >= DIAMOND_PASS_THRESHOLD) {
            nomination.status = "passed";
            await this.applyTierUpgrade(nomination.creatorId, "diamond");
            console.log(`[TierLog] Diamond election passed for ${nomination.creatorId}`);
          } else {
            nomination.status = "expired";
            console.log(`[TierLog] Diamond election expired for ${nomination.creatorId}`);
          }
        }
      }
    },

    // ============================================
    // Notifications
    // ============================================

    /**
     * Notify creator of tier upgrade
     */
    async notifyTierUpgrade(creatorId: string, newTier: CreatorTier): Promise<void> {
      const benefits = this.getTierBenefits(newTier);

      // Log notification (in production, this would send email/push notification)
      console.log(`[TierNotification] Tier Upgrade: ${creatorId} promoted to ${newTier.toUpperCase()}`);
      console.log(`[TierNotification] New benefits: ${benefits.revenueSharePercentage}% revenue share, ${benefits.withdrawalFrequency} withdrawals`);

      // TODO: Integrate with notification service
      // await notificationService.send({
      //   userId: creatorId,
      //   type: "tier_upgrade",
      //   title: `Congratulations! You've been promoted to ${newTier.toUpperCase()} tier`,
      //   body: `You now enjoy ${benefits.revenueSharePercentage}% revenue share and ${benefits.withdrawalFrequency} withdrawals.`,
      //   data: { tier: newTier, benefits }
      // });
    },

    /**
     * Notify creator of tier downgrade
     */
    async notifyTierDowngrade(
      creatorId: string,
      oldTier: CreatorTier,
      newTier: CreatorTier
    ): Promise<void> {
      const benefits = this.getTierBenefits(newTier);

      console.log(`[TierNotification] Tier Downgrade: ${creatorId} demoted from ${oldTier.toUpperCase()} to ${newTier.toUpperCase()}`);
      console.log(`[TierNotification] Updated benefits: ${benefits.revenueSharePercentage}% revenue share, ${benefits.withdrawalFrequency} withdrawals`);

      // TODO: Integrate with notification service
      // await notificationService.send({
      //   userId: creatorId,
      //   type: "tier_downgrade",
      //   title: `Tier Update: ${newTier.toUpperCase()}`,
      //   body: `Your tier has been updated to ${newTier.toUpperCase()}. Review your new benefits in the dashboard.`,
      //   data: { oldTier, newTier, benefits }
      // });
    },

    // ============================================
    // Utility Functions
    // ============================================

    /**
     * Get tier thresholds for reference
     */
    getTierThresholds() {
      return { ...TIER_THRESHOLDS };
    },

    /**
     * Get all tier configurations
     */
    getAllTierConfigs(): Record<CreatorTier, { threshold: typeof TIER_THRESHOLDS["silver"]; benefits: TierBenefits }> {
      return {
        bronze: {
          threshold: { revenue: 0, templateCount: 0, minRating: 0 },
          benefits: TIER_BENEFITS.bronze,
        },
        silver: {
          threshold: TIER_THRESHOLDS.silver,
          benefits: TIER_BENEFITS.silver,
        },
        gold: {
          threshold: TIER_THRESHOLDS.gold,
          benefits: TIER_BENEFITS.gold,
        },
        platinum: {
          threshold: TIER_THRESHOLDS.platinum,
          benefits: TIER_BENEFITS.platinum,
        },
        diamond: {
          threshold: TIER_THRESHOLDS.diamond,
          benefits: TIER_BENEFITS.diamond,
        },
      };
    },

    /**
     * Validate if withdrawal amount is within tier limits
     */
    async validateWithdrawalAmount(creatorId: string, amount: number): Promise<{
      valid: boolean;
      message?: string;
    }> {
      const [account] = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.companyId, creatorId))
        .limit(1);

      if (!account) {
        return { valid: false, message: "Creator account not found" };
      }

      const tier = (account.tier as CreatorTier) || "bronze";
      const benefits = this.getTierBenefits(tier);

      if (amount < benefits.minWithdrawalAmount) {
        return {
          valid: false,
          message: `Minimum withdrawal amount is ¥${benefits.minWithdrawalAmount} for ${tier} tier`,
        };
      }

      if (benefits.maxWithdrawalAmount > 0 && amount > benefits.maxWithdrawalAmount) {
        return {
          valid: false,
          message: `Maximum withdrawal amount is ¥${benefits.maxWithdrawalAmount} for ${tier} tier`,
        };
      }

      return { valid: true };
    },

    /**
     * Check if creator can withdraw based on tier frequency
     */
    async canWithdraw(creatorId: string): Promise<{
      canWithdraw: boolean;
      nextWithdrawalDate?: Date;
      message?: string;
    }> {
      const [account] = await db
        .select()
        .from(creatorRevenueAccounts)
        .where(eq(creatorRevenueAccounts.companyId, creatorId))
        .limit(1);

      if (!account) {
        return { canWithdraw: false, message: "Creator account not found" };
      }

      const tier = (account.tier as CreatorTier) || "bronze";
      const benefits = this.getTierBenefits(tier);

      if (benefits.withdrawalFrequency === "anytime") {
        return { canWithdraw: true };
      }

      // Get last withdrawal
      const [lastPayout] = await db
        .select()
        .from(creatorPayoutRequests)
        .where(eq(creatorPayoutRequests.accountId, account.id))
        .orderBy(desc(creatorPayoutRequests.requestedAt))
        .limit(1);

      if (!lastPayout) {
        return { canWithdraw: true };
      }

      const now = new Date();
      const lastWithdrawal = new Date(lastPayout.requestedAt);
      let nextWithdrawal = new Date(lastWithdrawal);

      switch (benefits.withdrawalFrequency) {
        case "weekly":
          nextWithdrawal.setDate(nextWithdrawal.getDate() + 7);
          break;
        case "biweekly":
          nextWithdrawal.setDate(nextWithdrawal.getDate() + 14);
          break;
        case "monthly":
          nextWithdrawal.setMonth(nextWithdrawal.getMonth() + 1);
          break;
      }

      if (now < nextWithdrawal) {
        return {
          canWithdraw: false,
          nextWithdrawalDate: nextWithdrawal,
          message: `Next withdrawal available on ${nextWithdrawal.toISOString().split("T")[0]}`,
        };
      }

      return { canWithdraw: true };
    },
  };
}

export type CreatorTierService = ReturnType<typeof creatorTierService>;

// Export constants for external use
export {
  TIER_THRESHOLDS,
  REVENUE_SHARE,
  TIER_BENEFITS,
  DIAMOND_VOTING_PERIOD_DAYS,
  DIAMOND_MINIMUM_VOTES,
  DIAMOND_PASS_THRESHOLD,
};
