import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  creatorTierService,
  CreatorTier,
  TIER_THRESHOLDS,
  REVENUE_SHARE,
  TIER_BENEFITS,
  DIAMOND_MINIMUM_VOTES,
  DIAMOND_PASS_THRESHOLD,
} from "./creator-tier";

// ============================================
// Test Data
// ============================================

const mockCreatorId = "creator_123";
const mockNominatorId = "nominator_456";

const createMockRevenueAccount = (overrides = {}) => ({
  id: "account_123",
  companyId: mockCreatorId,
  tier: "bronze" as CreatorTier,
  totalRevenue: "0",
  availableBalance: "0",
  pendingAmount: "0",
  withdrawalFrequency: "monthly",
  maxWithdrawalAmount: "5000",
  minWithdrawalAmount: "100",
  ...overrides,
});

// ============================================
// Mock Database Builder
// ============================================

function createMockDb() {
  const chainable = {
    where: vi.fn(() => Promise.resolve([])),
    limit: vi.fn(() => Promise.resolve([])),
    orderBy: vi.fn(() => chainable),
    leftJoin: vi.fn(() => chainable),
    from: vi.fn(() => chainable),
  };

  return {
    select: vi.fn(() => chainable),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "mock-id" }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    query: {
      creatorRevenueAccounts: {
        findFirst: vi.fn(),
      },
    },
    // Allow tests to configure the mock responses
    _setSelectResponse: (response: any) => {
      chainable.where.mockImplementation(() => {
        return {
          limit: vi.fn(() => Promise.resolve(response)),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(response)),
          })),
        };
      });
      chainable.limit.mockImplementation(() => Promise.resolve(response));
    },
    _setChainResponse: (response: any) => {
      chainable.where.mockReturnValue(response);
      chainable.limit.mockReturnValue(response);
    },
    _chainable: chainable,
  };
}

// Helper to setup mock with responses for different query types
function setupMockDbWithResponses(responses: {
  account?: any;
  revenue?: any;
  templateStats?: any;
  sales?: any;
  lastPayout?: any;
}) {
  const mockDb = createMockDb();
  let callCount = 0;

  mockDb.select.mockImplementation(() => {
    callCount++;

    // Account lookup (call 1 usually)
    if (responses.account && callCount <= 1) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([responses.account])),
          })),
        })),
      };
    }

    // Revenue query
    if (responses.revenue !== undefined && (callCount === 1 || callCount === 4)) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ total: responses.revenue }])),
          })),
        })),
      };
    }

    // Template stats query (call 2 or 5)
    if (responses.templateStats && (callCount === 2 || callCount === 5)) {
      return {
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([responses.templateStats])),
            })),
          })),
        })),
      };
    }

    // Sales count query (call 3 or 6)
    if (responses.sales !== undefined && (callCount === 3 || callCount === 6)) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ count: responses.sales }])),
          })),
        })),
      };
    }

    // Last payout query
    if (responses.lastPayout && (callCount === 4 || callCount === 7)) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([responses.lastPayout])),
            })),
          })),
        })),
      };
    }

    // Default
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ count: 0, avgRating: null }])),
          })),
        })),
      })),
    };
  });

  return mockDb;
}

describe("Creator Tier Service", () => {
  let mockDb: any;
  let service: ReturnType<typeof creatorTierService>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Tier Calculation Tests
  // ============================================

  describe("calculateCreatorTier", () => {
    it("should return bronze for new creators with no revenue or templates", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 0,
        templateStats: { count: 0, avgRating: null },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("bronze");
    });

    it("should return silver for creators with > ¥1,000 revenue", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 1500,
        templateStats: { count: 0, avgRating: null },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("silver");
    });

    it("should return silver for creators with 3+ templates", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 0,
        templateStats: { count: 3, avgRating: 4.0 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("silver");
    });

    it("should return gold for creators with > ¥10,000 revenue", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 15000,
        templateStats: { count: 0, avgRating: null },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("gold");
    });

    it("should return gold for creators with 10+ templates and 4.5+ rating", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 0,
        templateStats: { count: 12, avgRating: 4.6 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("gold");
    });

    it("should return platinum for creators with > ¥50,000 revenue", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 75000,
        templateStats: { count: 0, avgRating: null },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("platinum");
    });

    it("should return platinum for creators with 25+ templates and 4.7+ rating", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 0,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      expect(tier).toBe("platinum");
    });

    it("should not return diamond tier through automatic calculation", async () => {
      mockDb = setupMockDbWithResponses({
        revenue: 200000,
        templateStats: { count: 100, avgRating: 4.9 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const tier = await service.calculateCreatorTier(mockCreatorId);

      // Diamond can only be achieved through governance
      expect(tier).toBe("platinum");
    });
  });

  // ============================================
  // Tier Upgrade Eligibility Tests
  // ============================================

  describe("checkTierUpgradeEligibility", () => {
    it("should show eligible when creator qualifies for upgrade", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
        revenue: 0,
        templateStats: { count: 5, avgRating: 4.5 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const eligibility = await service.checkTierUpgradeEligibility(mockCreatorId);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.currentTier).toBe("bronze");
      expect(eligibility.potentialTier).toBe("silver");
      expect(eligibility.reasons.length).toBeGreaterThan(0);
    });

    it("should show not eligible when creator already at highest auto tier", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 100000,
        templateStats: { count: 50, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const eligibility = await service.checkTierUpgradeEligibility(mockCreatorId);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.currentTier).toBe("platinum");
    });

    it("should include revenue and template statistics", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
        revenue: 0,
        templateStats: { count: 10, avgRating: 4.5 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const eligibility = await service.checkTierUpgradeEligibility(mockCreatorId);

      expect(eligibility.currentTemplateCount).toBe(10);
      expect(eligibility.currentAvgRating).toBe(4.5);
    });
  });

  // ============================================
  // Tier Benefits Tests
  // ============================================

  describe("getTierBenefits", () => {
    it("should return correct benefits for bronze tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const benefits = service.getTierBenefits("bronze");

      expect(benefits.revenueSharePercentage).toBe(60);
      expect(benefits.platformFeePercentage).toBe(40);
      expect(benefits.withdrawalFrequency).toBe("monthly");
      expect(benefits.prioritySupport).toBe(false);
      expect(benefits.featuredListing).toBe(false);
    });

    it("should return correct benefits for silver tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const benefits = service.getTierBenefits("silver");

      expect(benefits.revenueSharePercentage).toBe(70);
      expect(benefits.platformFeePercentage).toBe(30);
      expect(benefits.withdrawalFrequency).toBe("biweekly");
      expect(benefits.analyticsAccess).toBe(true);
    });

    it("should return correct benefits for gold tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const benefits = service.getTierBenefits("gold");

      expect(benefits.revenueSharePercentage).toBe(80);
      expect(benefits.platformFeePercentage).toBe(20);
      expect(benefits.withdrawalFrequency).toBe("weekly");
      expect(benefits.prioritySupport).toBe(true);
      expect(benefits.featuredListing).toBe(true);
      expect(benefits.customBranding).toBe(true);
    });

    it("should return correct benefits for platinum tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const benefits = service.getTierBenefits("platinum");

      expect(benefits.revenueSharePercentage).toBe(85);
      expect(benefits.platformFeePercentage).toBe(15);
      expect(benefits.withdrawalFrequency).toBe("anytime");
      expect(benefits.maxWithdrawalAmount).toBe(0); // Unlimited
      expect(benefits.dedicatedAccountManager).toBe(true);
    });

    it("should return correct benefits for diamond tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const benefits = service.getTierBenefits("diamond");

      expect(benefits.revenueSharePercentage).toBe(90);
      expect(benefits.platformFeePercentage).toBe(10);
      expect(benefits.withdrawalFrequency).toBe("anytime");
    });

    it("should return immutable copy of benefits", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const benefits = service.getTierBenefits("bronze");
      benefits.revenueSharePercentage = 999;

      const freshBenefits = service.getTierBenefits("bronze");
      expect(freshBenefits.revenueSharePercentage).toBe(60);
    });
  });

  // ============================================
  // Revenue Share Tests
  // ============================================

  describe("calculateRevenueShare", () => {
    it("should calculate revenue split for bronze tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const split = service.calculateRevenueShare(mockCreatorId, 1000);

      expect(split.creatorPercentage).toBe(60);
      expect(split.platformPercentage).toBe(40);
      expect(split.creatorAmount).toBe(600);
      expect(split.platformAmount).toBe(400);
    });

    it("should handle fractional amounts correctly", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const split = service.calculateRevenueShare(mockCreatorId, 100);

      expect(split.creatorAmount + split.platformAmount).toBe(100);
    });

    it("should return zero amounts for zero revenue", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const split = service.calculateRevenueShare(mockCreatorId, 0);

      expect(split.creatorAmount).toBe(0);
      expect(split.platformAmount).toBe(0);
    });
  });

  describe("getRevenueSharePercentage", () => {
    it("should return correct percentages for each tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      expect(service.getRevenueSharePercentage("bronze")).toBe(60);
      expect(service.getRevenueSharePercentage("silver")).toBe(70);
      expect(service.getRevenueSharePercentage("gold")).toBe(80);
      expect(service.getRevenueSharePercentage("platinum")).toBe(85);
      expect(service.getRevenueSharePercentage("diamond")).toBe(90);
    });
  });

  describe("getPlatformFeePercentage", () => {
    it("should return correct platform fees for each tier", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      expect(service.getPlatformFeePercentage("bronze")).toBe(40);
      expect(service.getPlatformFeePercentage("silver")).toBe(30);
      expect(service.getPlatformFeePercentage("gold")).toBe(20);
      expect(service.getPlatformFeePercentage("platinum")).toBe(15);
      expect(service.getPlatformFeePercentage("diamond")).toBe(10);
    });
  });

  // ============================================
  // Governance (Diamond) Tests
  // ============================================

  describe("nominateForDiamond", () => {
    it("should create a nomination for eligible creators", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      expect(nomination).toBeDefined();
      expect(nomination.creatorId).toBe(mockCreatorId);
      expect(nomination.nominatorId).toBe(mockNominatorId);
      expect(nomination.status).toBe("active");
      expect(nomination.votesFor).toBe(0);
      expect(nomination.votesAgainst).toBe(0);
    });

    it("should reject nomination for already diamond creators", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "diamond" }),
        revenue: 100000,
        templateStats: { count: 50, avgRating: 4.9 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      await expect(service.nominateForDiamond(mockCreatorId, mockNominatorId))
        .rejects.toThrow("Creator is already Diamond tier");
    });

    it("should reject nomination for creators below minimum requirements", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
        revenue: 1000,
        templateStats: { count: 1, avgRating: 3.0 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      await expect(service.nominateForDiamond(mockCreatorId, mockNominatorId))
        .rejects.toThrow("Creator does not meet minimum requirements");
    });
  });

  describe("voteForDiamond", () => {
    it("should record a vote for a nomination", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      const result = await service.voteForDiamond(nomination.id, "voter_1", true);

      expect(result.success).toBe(true);
      expect(result.votesFor).toBe(1);
      expect(result.votesAgainst).toBe(0);
    });

    it("should prevent duplicate votes from same voter", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      await service.voteForDiamond(nomination.id, "voter_1", true);
      const result = await service.voteForDiamond(nomination.id, "voter_1", true);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already cast");
    });

    it("should pass nomination with 70% approval and minimum votes", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      // Cast 8 for votes and 2 against (80% approval, 10 total votes)
      for (let i = 0; i < 8; i++) {
        await service.voteForDiamond(nomination.id, `voter_${i}`, true);
      }
      for (let i = 8; i < 10; i++) {
        await service.voteForDiamond(nomination.id, `voter_${i}`, false);
      }

      const finalResult = await service.voteForDiamond(nomination.id, "voter_10", true);

      expect(finalResult.passed).toBe(true);
      expect(finalResult.message).toContain("promoted to Diamond");
    });

    it("should reject nomination with less than 50% approval", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      // Cast 3 for votes and 7 against (30% approval)
      for (let i = 0; i < 3; i++) {
        await service.voteForDiamond(nomination.id, `voter_${i}`, true);
      }
      for (let i = 3; i < 10; i++) {
        const result = await service.voteForDiamond(nomination.id, `voter_${i}`, false);
        if (i === 9) {
          expect(result.passed).toBe(false);
          expect(result.message).toContain("rejected");
        }
      }
    });

    it("should return error for non-existent nomination", async () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const result = await service.voteForDiamond("non_existent_nom", "voter_1", true);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Nomination not found");
    });
  });

  describe("getDiamondNominations", () => {
    it("should return only active nominations", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      const activeNominations = service.getDiamondNominations();

      expect(activeNominations.length).toBe(1);
      expect(activeNominations[0].id).toBe(nomination.id);
    });
  });

  describe("processDiamondElections", () => {
    it("should expire old nominations without enough votes", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 50000,
        templateStats: { count: 30, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);

      // Manually expire the nomination
      const nominations = service.getAllDiamondNominations();
      const nom = nominations.find((n: any) => n.id === nomination.id);
      if (nom) {
        nom.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      }

      await service.processDiamondElections();

      const updatedNominations = service.getAllDiamondNominations();
      const updatedNom = updatedNominations.find((n: any) => n.id === nomination.id);
      expect(updatedNom?.status).toBe("expired");
    });
  });

  // ============================================
  // Tier Upgrade Tests
  // ============================================

  describe("applyTierUpgrade", () => {
    it("should update creator tier and notify", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
      });
      service = creatorTierService(mockDb);

      await service.applyTierUpgrade(mockCreatorId, "silver");

      expect(mockDb.update).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TierLog]")
      );

      consoleSpy.mockRestore();
    });

    it("should throw error if creator account not found", async () => {
      // Create mock that returns empty array for account lookup
      mockDb = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(),
        query: { creatorRevenueAccounts: { findFirst: vi.fn() } },
      };
      service = creatorTierService(mockDb);

      await expect(service.applyTierUpgrade(mockCreatorId, "silver"))
        .rejects.toThrow("Creator revenue account not found");
    });
  });

  // ============================================
  // Withdrawal Validation Tests
  // ============================================

  describe("validateWithdrawalAmount", () => {
    it("should validate amount within tier limits", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
      });
      service = creatorTierService(mockDb);

      const result = await service.validateWithdrawalAmount(mockCreatorId, 500);

      expect(result.valid).toBe(true);
    });

    it("should reject amount below minimum", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
      });
      service = creatorTierService(mockDb);

      const result = await service.validateWithdrawalAmount(mockCreatorId, 50);

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Minimum withdrawal");
    });

    it("should reject amount above maximum", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
      });
      service = creatorTierService(mockDb);

      const result = await service.validateWithdrawalAmount(mockCreatorId, 10000);

      expect(result.valid).toBe(false);
      expect(result.message).toContain("Maximum withdrawal");
    });
  });

  describe("canWithdraw", () => {
    it("should allow platinum tier to withdraw anytime", async () => {
      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        lastPayout: { id: "payout_1", requestedAt: new Date() },
      });
      service = creatorTierService(mockDb);

      const result = await service.canWithdraw(mockCreatorId);

      expect(result.canWithdraw).toBe(true);
    });

    it("should restrict bronze tier to monthly withdrawals", async () => {
      const lastPayout = new Date();
      lastPayout.setDate(lastPayout.getDate() - 7); // 1 week ago

      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
        lastPayout: { id: "payout_1", requestedAt: lastPayout },
      });
      service = creatorTierService(mockDb);

      const result = await service.canWithdraw(mockCreatorId);

      expect(result.canWithdraw).toBe(false);
      expect(result.nextWithdrawalDate).toBeDefined();
    });
  });

  // ============================================
  // Configuration Tests
  // ============================================

  describe("getTierThresholds", () => {
    it("should return all tier thresholds", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const thresholds = service.getTierThresholds();

      expect(thresholds.silver.revenue).toBe(1000);
      expect(thresholds.gold.revenue).toBe(10000);
      expect(thresholds.platinum.revenue).toBe(50000);
    });
  });

  describe("getAllTierConfigs", () => {
    it("should return complete tier configurations", () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const configs = service.getAllTierConfigs();

      expect(configs.bronze.benefits.revenueSharePercentage).toBe(60);
      expect(configs.silver.benefits.revenueSharePercentage).toBe(70);
      expect(configs.gold.benefits.revenueSharePercentage).toBe(80);
      expect(configs.platinum.benefits.revenueSharePercentage).toBe(85);
      expect(configs.diamond.benefits.revenueSharePercentage).toBe(90);
    });
  });

  // ============================================
  // Notification Tests
  // ============================================

  describe("notifyTierUpgrade", () => {
    it("should log tier upgrade notification", async () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.notifyTierUpgrade(mockCreatorId, "gold");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TierNotification]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("GOLD")
      );

      consoleSpy.mockRestore();
    });
  });

  describe("notifyTierDowngrade", () => {
    it("should log tier downgrade notification", async () => {
      mockDb = createMockDb();
      service = creatorTierService(mockDb);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.notifyTierDowngrade(mockCreatorId, "gold", "silver");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TierNotification]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("GOLD")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("SILVER")
      );

      consoleSpy.mockRestore();
    });
  });

  // ============================================
  // Constants Export Tests
  // ============================================

  describe("Constants", () => {
    it("should export tier thresholds", () => {
      expect(TIER_THRESHOLDS.silver.revenue).toBe(1000);
      expect(TIER_THRESHOLDS.gold.revenue).toBe(10000);
      expect(TIER_THRESHOLDS.platinum.revenue).toBe(50000);
    });

    it("should export revenue share constants", () => {
      expect(REVENUE_SHARE.bronze.creator).toBe(60);
      expect(REVENUE_SHARE.platinum.creator).toBe(85);
      expect(REVENUE_SHARE.diamond.creator).toBe(90);
    });

    it("should export tier benefits", () => {
      expect(TIER_BENEFITS.bronze.withdrawalFrequency).toBe("monthly");
      expect(TIER_BENEFITS.gold.prioritySupport).toBe(true);
      expect(TIER_BENEFITS.platinum.dedicatedAccountManager).toBe(true);
    });

    it("should export diamond voting constants", () => {
      expect(DIAMOND_MINIMUM_VOTES).toBe(10);
      expect(DIAMOND_PASS_THRESHOLD).toBe(0.7);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe("Full Tier Flow", () => {
    it("should complete full tier upgrade flow", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "bronze" }),
        revenue: 0,
        templateStats: { count: 5, avgRating: 4.5 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      // Check eligibility
      const eligibility = await service.checkTierUpgradeEligibility(mockCreatorId);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.currentTier).toBe("bronze");
      expect(eligibility.potentialTier).toBe("silver");

      // Apply upgrade
      await service.applyTierUpgrade(mockCreatorId, "silver");

      // Verify benefits applied
      const benefits = service.getTierBenefits("silver");
      expect(benefits.revenueSharePercentage).toBe(70);

      consoleSpy.mockRestore();
    });

    it("should handle diamond governance flow end-to-end", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockDb = setupMockDbWithResponses({
        account: createMockRevenueAccount({ tier: "platinum" }),
        revenue: 100000,
        templateStats: { count: 50, avgRating: 4.8 },
        sales: 0,
      });
      service = creatorTierService(mockDb);

      // Nominate creator
      const nomination = await service.nominateForDiamond(mockCreatorId, mockNominatorId);
      expect(nomination.status).toBe("active");

      // Cast enough votes to pass
      for (let i = 0; i < 8; i++) {
        await service.voteForDiamond(nomination.id, `voter_${i}`, true);
      }
      for (let i = 8; i < 11; i++) {
        await service.voteForDiamond(nomination.id, `voter_${i}`, false);
      }

      const result = await service.voteForDiamond(nomination.id, "voter_11", true);
      expect(result.passed).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});

// ============================================
// Test Scripts (for manual testing)
// ============================================

export const testScripts = {
  /**
   * Test tier calculation
   */
  async testTierCalculation(service: ReturnType<typeof creatorTierService>) {
    console.log("=== Testing Tier Calculation ===");

    const testCases = [
      { revenue: 0, templates: 0, rating: 0, expected: "bronze" },
      { revenue: 1500, templates: 0, rating: 0, expected: "silver" },
      { revenue: 0, templates: 5, rating: 4.0, expected: "silver" },
      { revenue: 15000, templates: 0, rating: 0, expected: "gold" },
      { revenue: 0, templates: 15, rating: 4.6, expected: "gold" },
      { revenue: 75000, templates: 0, rating: 0, expected: "platinum" },
      { revenue: 0, templates: 30, rating: 4.8, expected: "platinum" },
    ];

    for (const testCase of testCases) {
      console.log(`Revenue: ¥${testCase.revenue}, Templates: ${testCase.templates}, Rating: ${testCase.rating}`);
      console.log(`Expected: ${testCase.expected}`);
    }
  },

  /**
   * Test revenue share calculation
   */
  async testRevenueShare(service: ReturnType<typeof creatorTierService>) {
    console.log("=== Testing Revenue Share ===");

    const tiers: CreatorTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];
    const amount = 10000; // ¥100

    for (const tier of tiers) {
      const percentage = service.getRevenueSharePercentage(tier);
      const creatorAmount = Math.floor((amount * percentage) / 100);
      const platformAmount = amount - creatorAmount;

      console.log(`${tier.toUpperCase()}: Creator ${creatorAmount} (${percentage}%), Platform ${platformAmount} (${100 - percentage}%)`);
    }
  },

  /**
   * Test tier benefits
   */
  async testTierBenefits(service: ReturnType<typeof creatorTierService>) {
    console.log("=== Testing Tier Benefits ===");

    const tiers: CreatorTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

    for (const tier of tiers) {
      const benefits = service.getTierBenefits(tier);
      console.log(`\n${tier.toUpperCase()} Tier Benefits:`);
      console.log(`  Revenue Share: ${benefits.revenueSharePercentage}%`);
      console.log(`  Withdrawal: ${benefits.withdrawalFrequency}`);
      console.log(`  Priority Support: ${benefits.prioritySupport}`);
      console.log(`  Featured Listing: ${benefits.featuredListing}`);
      console.log(`  API Access: ${benefits.apiAccess}`);
      console.log(`  Dedicated Manager: ${benefits.dedicatedAccountManager}`);
    }
  },

  /**
   * Run all tests
   */
  async runAllTests(service: ReturnType<typeof creatorTierService>) {
    console.log("\n========================================");
    console.log("Running All Creator Tier Tests");
    console.log("========================================\n");

    await this.testTierCalculation(service);
    await this.testRevenueShare(service);
    await this.testTierBenefits(service);

    console.log("\n========================================");
    console.log("Test Complete");
    console.log("========================================");
  },
};
