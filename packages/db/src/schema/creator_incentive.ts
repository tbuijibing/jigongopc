import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { companyTemplates } from "./company_templates.js";

/**
 * Creator Revenue Accounts - 创作者收益账户
 * Tracks earnings and tier for template creators (human or agent)
 */
export const creatorRevenueAccounts = pgTable(
  "creator_revenue_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),

    // Creator identity (either human or agent)
    userId: text("user_id"), // Human creator
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }), // Agent creator

    // Balances (using DECIMAL to avoid floating point errors)
    totalEarned: decimal("total_earned", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    availableBalance: decimal("available_balance", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    withdrawnAmount: decimal("withdrawn_amount", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    pendingAmount: decimal("pending_amount", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),

    // Payment info
    payoutMethod: jsonb("payout_method").$type<{
      type: string;
      currency: string;
      accountNumber?: string;
      bankName?: string;
    }>(),
    taxInfo: jsonb("tax_info").$type<Record<string, unknown>>(), // Tax information

    // Creator tier (bronze, silver, gold, platinum, diamond)
    tier: text("tier").notNull().default("bronze"),
    tierUpdatedAt: timestamp("tier_updated_at", { withTimezone: true }),

    // Statistics
    totalTemplates: integer("total_templates").notNull().default(0),
    totalDownloads: integer("total_downloads").notNull().default(0),
    totalForks: integer("total_forks").notNull().default(0),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }), // 0.00 - 5.00

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // One creator can only have one account per company
    companyUserUnique: uniqueIndex("creator_accounts_company_user_uq").on(
      table.companyId,
      table.userId
    ),
    companyAgentUnique: uniqueIndex("creator_accounts_company_agent_uq").on(
      table.companyId,
      table.agentId
    ),
    companyIdx: index("creator_accounts_company_idx").on(table.companyId),
    tierIdx: index("creator_accounts_tier_idx").on(table.tier),
  })
);

/**
 * Revenue Records - 收益记录主表
 * Tracks all revenue generated from templates
 */
export const revenueRecords = pgTable(
  "revenue_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Revenue source
    sourceType: text("source_type").notNull(),
    // subscription, transaction, customization, marketplace_sale
    sourceId: text("source_id"), // Related order/transaction ID

    // Associated template
    templateId: uuid("template_id")
      .notNull()
      .references(() => companyTemplates.id),

    // Buyer info
    buyerCompanyId: uuid("buyer_company_id").references(() => companies.id),
    buyerUserId: text("buyer_user_id"),

    // Amount (unified in USD, converted at settlement)
    totalAmount: decimal("total_amount", { precision: 19, scale: 4 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // Distribution details (Plan A)
    platformFee: decimal("platform_fee", { precision: 19, scale: 4 }).notNull(), // 15%
    directCreatorShare: decimal("direct_creator_share", {
      precision: 19,
      scale: 4,
    }).notNull(), // 60%
    ancestorShare: decimal("ancestor_share", { precision: 19, scale: 4 }).notNull(), // 15%
    rootShare: decimal("root_share", { precision: 19, scale: 4 }).notNull(), // 10%

    // Status
    status: text("status").notNull().default("pending"),
    // pending, distributed, failed
    distributedAt: timestamp("distributed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    templateIdx: index("revenue_records_template_idx").on(table.templateId),
    statusIdx: index("revenue_records_status_idx").on(table.status),
    sourceIdx: index("revenue_records_source_idx").on(
      table.sourceType,
      table.sourceId
    ),
  })
);

/**
 * Creator Revenue Distributions - 创作者收益分配明细
 * Detailed breakdown of revenue distributions to creators
 */
export const creatorRevenueDistributions = pgTable(
  "creator_revenue_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    revenueRecordId: uuid("revenue_record_id")
      .notNull()
      .references(() => revenueRecords.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => creatorRevenueAccounts.id),

    // Distribution details
    amount: decimal("amount", { precision: 19, scale: 4 }).notNull(),
    percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(),

    // Distribution type (Plan A simplified)
    distributionType: text("distribution_type").notNull(),
    // direct_creator, parent_template, root_template

    // Status
    status: text("status").notNull().default("pending"),
    // pending, credited, disputed
    creditedAt: timestamp("credited_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    recordIdx: index("revenue_distributions_record_idx").on(
      table.revenueRecordId
    ),
    accountIdx: index("revenue_distributions_account_idx").on(table.accountId),
    statusIdx: index("revenue_distributions_status_idx").on(table.status),
  })
);

/**
 * Revenue Settlement Cycles - 收益结算周期表
 * Tracks settlement periods for revenue distribution
 */
export const revenueSettlementCycles = pgTable(
  "revenue_settlement_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Cycle info
    cycleType: text("cycle_type").notNull(), // daily, weekly, monthly
    cycleStart: timestamp("cycle_start", { withTimezone: true }).notNull(),
    cycleEnd: timestamp("cycle_end", { withTimezone: true }).notNull(),

    // Statistics
    totalRevenue: decimal("total_revenue", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    totalDistributed: decimal("total_distributed", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    totalAccounts: integer("total_accounts").notNull().default(0),

    // Status
    status: text("status").notNull().default("open"),
    // open, processing, completed, failed

    processedAt: timestamp("processed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index("settlement_cycles_status_idx").on(table.status),
    dateIdx: index("settlement_cycles_date_idx").on(table.cycleStart, table.cycleEnd),
  })
);

/**
 * Creator Payout Requests - 提现申请
 * Tracks withdrawal requests from creators
 */
export const creatorPayoutRequests = pgTable(
  "creator_payout_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => creatorRevenueAccounts.id),

    amount: decimal("amount", { precision: 19, scale: 4 }).notNull(),
    currency: text("currency").notNull().default("USD"),

    // Payment details
    payoutMethod: jsonb("payout_method").notNull().$type<Record<string, unknown>>(),
    recipientInfo: jsonb("recipient_info").notNull().$type<Record<string, unknown>>(),

    // Status
    status: text("status").notNull().default("pending"),
    // pending, approved, processing, completed, rejected, failed

    // Processing info
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    transactionId: text("transaction_id"), // External transaction ID

    // Failure info
    failureReason: text("failure_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    accountIdx: index("payout_requests_account_idx").on(table.accountId),
    statusIdx: index("payout_requests_status_idx").on(table.status),
  })
);

/**
 * Creator Tier History - 创作者等级历史
 * Tracks tier changes for creators
 */
export const creatorTierHistory = pgTable(
  "creator_tier_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => creatorRevenueAccounts.id, { onDelete: "cascade" }),

    oldTier: text("old_tier").notNull(),
    newTier: text("new_tier").notNull(),

    // Upgrade reason
    reason: text("reason").notNull(),
    // templates_count, downloads_count, revenue_threshold, manual_review
    metricsSnapshot: jsonb("metrics_snapshot").$type<Record<string, unknown>>(),

    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changedBy: text("changed_by"), // null for system upgrades
  },
  (table) => ({
    accountIdx: index("tier_history_account_idx").on(table.accountId),
  })
);

/**
 * Template Revenue Stats - 模板收入统计（缓存表）
 * Cached statistics for fast queries
 */
export const templateRevenueStats = pgTable(
  "template_revenue_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .unique()
      .references(() => companyTemplates.id, { onDelete: "cascade" }),

    // Revenue stats
    totalSales: integer("total_sales").notNull().default(0),
    totalRevenue: decimal("total_revenue", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),
    totalForks: integer("total_forks").notNull().default(0),
    totalUsage: integer("total_usage").notNull().default(0), // Usage count

    // Monthly stats
    monthlySales: integer("monthly_sales").notNull().default(0),
    monthlyRevenue: decimal("monthly_revenue", { precision: 19, scale: 4 })
      .notNull()
      .default("0"),

    // Ratings
    ratingCount: integer("rating_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),

    // Update time
    statsUpdatedAt: timestamp("stats_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    revenueIdx: index("template_stats_revenue_idx").on(table.totalRevenue),
    ratingIdx: index("template_stats_rating_idx").on(table.averageRating),
  })
);
