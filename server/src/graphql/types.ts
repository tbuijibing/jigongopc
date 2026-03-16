/**
 * GraphQL Type Definitions
 * TypeScript interfaces matching the GraphQL Schema
 */

// ============================================
// Enums
// ============================================

export type TemplateStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED" | "DEPRECATED";
export type TemplateVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";
export type TemplateCategory =
  | "PROJECT_MANAGEMENT"
  | "SOFTWARE_DEVELOPMENT"
  | "MARKETING"
  | "SALES"
  | "HR"
  | "FINANCE"
  | "OPERATIONS"
  | "DESIGN"
  | "CUSTOM";
export type PricingType = "FREE" | "ONE_TIME" | "SUBSCRIPTION" | "TIERED";
export type PaymentMethod = "BALANCE" | "STRIPE" | "ALIPAY" | "WECHAT";
export type PayoutStatus = "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "REJECTED" | "FAILED";
export type CreatorTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
export type PurchaseStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type InstallStatus = "PENDING" | "INSTALLING" | "INSTALLED" | "FAILED" | "UNINSTALLED";

// ============================================
// Base Types
// ============================================

export interface Node {
  id: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

// ============================================
// Pagination & Filters
// ============================================

export interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface TemplateFilters {
  category?: TemplateCategory;
  status?: TemplateStatus;
  visibility?: TemplateVisibility;
  pricingType?: PricingType;
  priceMin?: number;
  priceMax?: number;
  ratingMin?: number;
  creatorId?: string;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export type TemplateSortField = "CREATED_AT" | "UPDATED_AT" | "PRICE" | "RATING" | "DOWNLOADS" | "NAME";
export type SortDirection = "ASC" | "DESC";

export interface TemplateSortInput {
  field: TemplateSortField;
  direction: SortDirection;
}

// ============================================
// Template Types
// ============================================

export interface Template extends Node {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  category: TemplateCategory;
  tags: string[];
  status: TemplateStatus;
  visibility: TemplateVisibility;
  currentVersionId: string | null;
  currentVersion: TemplateVersion | null;
  versions: TemplateVersion[];
  versionCount: number;
  pricingType: PricingType;
  price: number;
  currency: string;
  subscriptionPeriod: string | null;
  stats: TemplateStats;
  lineage: TemplateLineage | null;
  parentTemplateId: string | null;
  parentTemplate: Template | null;
  forkedTemplates: Template[];
  creatorId: string | null;
  creator: Creator | null;
  iconUrl: string | null;
  coverImages: string[];
  previewUrl: string | null;
  documentationUrl: string | null;
  metadata: Record<string, unknown>;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  // Internal fields for mappers
  downloadCount?: number;
  forkCount?: number;
  ratingCount?: number;
  averageRating: string | null;
}

export interface TemplateVersion extends Node {
  id: string;
  templateId: string;
  template: Template;
  version: string;
  name: string | null;
  description: string | null;
  changelog: string | null;
  workflowDefinition: Record<string, unknown>;
  nodeDefinitions: Record<string, unknown>;
  roleDefinitions: Record<string, unknown>;
  deliverableDefinitions: Record<string, unknown>;
  isLatest: boolean;
  status: string;
  downloads: number;
  installs: number;
  createdBy: string;
  creator: Creator | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface TemplateStats {
  downloads: number;
  installs: number;
  forks: number;
  ratingCount: number;
  averageRating: number | null;
  totalRevenue: number;
  monthlyRevenue: number;
  monthlySales: number;
  lastUpdatedAt: Date;
}

export interface TemplateLineage extends Node {
  id: string;
  templateId: string;
  template: Template;
  rootTemplateId: string | null;
  rootTemplate: Template | null;
  parentTemplateId: string | null;
  parentTemplate: Template | null;
  ancestorChain: TemplateLineageNode[];
  directChildren: Template[];
  totalDescendants: number;
  revenueShareEnabled: boolean;
  ancestorSharePercent: number;
  rootSharePercent: number;
  createdAt: Date;
  updatedAt: Date;
  // Internal fields
  path: string[] | null;
  ancestorId: string;
  descendantId: string;
  depth: number;
}

export interface TemplateLineageNode {
  templateId: string;
  template: Template;
  depth: number;
  relationship: string;
}

// ============================================
// Creator Types
// ============================================

export interface Creator extends Node {
  id: string;
  companyId: string | null;
  userId: string | null;
  agentId: string | null;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  socialLinks: Record<string, unknown>;
  tier: CreatorTier;
  tierUpdatedAt: Date | null;
  stats: CreatorStats;
  templates: Template[];
  templateCount: number;
  revenue: RevenueStats;
  createdAt: Date;
  updatedAt: Date;
  // Internal fields
  totalEarned: number;
  availableBalance: number;
  withdrawnAmount: number;
  pendingAmount: number;
  averageRating: string | null;
  totalTemplates: number;
  totalDownloads: number;
  totalForks: number;
}

export interface CreatorStats {
  totalTemplates: number;
  totalDownloads: number;
  totalForks: number;
  averageRating: number | null;
}

// ============================================
// Revenue Types
// ============================================

export interface RevenueStats {
  totalEarned: number;
  availableBalance: number;
  withdrawnAmount: number;
  pendingAmount: number;
  bySource: RevenueBySource[];
  byMonth: RevenueByMonth[];
  currency: string;
  payouts: PayoutRequest[];
}

export interface RevenueBySource {
  source: string;
  amount: number;
  count: number;
}

export interface RevenueByMonth {
  month: string;
  amount: number;
  sales: number;
}

export interface PayoutRequest extends Node {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: Record<string, unknown>;
  recipientInfo: Record<string, unknown>;
  requestedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  processedAt: Date | null;
  completedAt: Date | null;
  transactionId: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Purchase Types
// ============================================

export interface Purchase extends Node {
  id: string;
  templateId: string;
  template: Template;
  buyerCompanyId: string;
  buyerUserId: string | null;
  amount: number;
  currency: string;
  pricingType: PricingType;
  status: PurchaseStatus;
  paymentMethod: PaymentMethod;
  paymentIntentId: string | null;
  purchasedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface PurchaseResult {
  success: boolean;
  purchase?: Purchase;
  error?: string;
  requiresAction?: boolean;
  clientSecret?: string;
}

// ============================================
// Install Types
// ============================================

export interface InstallResult {
  success: boolean;
  subscriptionId?: string;
  status: InstallStatus;
  message?: string;
  error?: string;
}

// ============================================
// Fork Types
// ============================================

export interface ForkResult {
  success: boolean;
  template?: Template;
  error?: string;
}

// ============================================
// Withdrawal Types
// ============================================

export interface WithdrawalRequest {
  success: boolean;
  request?: PayoutRequest;
  error?: string;
}

// ============================================
// Connections
// ============================================

export interface TemplateConnection extends Connection<Template> {
  edges: TemplateEdge[];
}

export interface TemplateEdge extends Edge<Template> {
  node: Template;
  cursor: string;
}

// ============================================
// Input Types
// ============================================

export interface PublishTemplateInput {
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  category: TemplateCategory;
  tags?: string[];
  visibility: TemplateVisibility;
  pricingType: PricingType;
  price: number;
  currency?: string;
  subscriptionPeriod?: string;
  iconUrl?: string;
  coverImages?: string[];
  previewUrl?: string;
  documentationUrl?: string;
  version: string;
  versionDescription?: string;
  workflowDefinition?: Record<string, unknown>;
  nodeDefinitions?: Record<string, unknown>;
  roleDefinitions?: Record<string, unknown>;
  deliverableDefinitions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  shortDescription?: string;
  category?: TemplateCategory;
  tags?: string[];
  visibility?: TemplateVisibility;
  pricingType?: PricingType;
  price?: number;
  currency?: string;
  subscriptionPeriod?: string;
  iconUrl?: string;
  coverImages?: string[];
  previewUrl?: string;
  documentationUrl?: string;
  metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface PublishVersionInput {
  templateId: string;
  version: string;
  name?: string;
  description?: string;
  changelog?: string;
  workflowDefinition?: Record<string, unknown>;
  nodeDefinitions?: Record<string, unknown>;
  roleDefinitions?: Record<string, unknown>;
  deliverableDefinitions?: Record<string, unknown>;
}

export interface ForkTemplateInput {
  templateId: string;
  customizations?: Record<string, unknown>;
  newName?: string;
  newSlug?: string;
}
