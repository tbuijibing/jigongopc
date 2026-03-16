/**
 * GraphQL Schema Definition for Template Marketplace
 * Includes types for Templates, Versions, Lineage, Creators, Revenue, and Purchases
 */

// GraphQL Schema Definition Language
export const typeDefs = /* GraphQL */ `
  scalar JSON
  scalar DateTime

  # ============================================
  # Enums
  # ============================================

  enum TemplateStatus {
    DRAFT
    PENDING_REVIEW
    PUBLISHED
    REJECTED
    ARCHIVED
    DEPRECATED
  }

  enum TemplateVisibility {
    PUBLIC
    PRIVATE
    UNLISTED
  }

  enum TemplateCategory {
    PROJECT_MANAGEMENT
    SOFTWARE_DEVELOPMENT
    MARKETING
    SALES
    HR
    FINANCE
    OPERATIONS
    DESIGN
    CUSTOM
  }

  enum PricingType {
    FREE
    ONE_TIME
    SUBSCRIPTION
    TIERED
  }

  enum PaymentMethod {
    BALANCE
    STRIPE
    ALIPAY
    WECHAT
  }

  enum PayoutStatus {
    PENDING
    APPROVED
    PROCESSING
    COMPLETED
    REJECTED
    FAILED
  }

  enum CreatorTier {
    BRONZE
    SILVER
    GOLD
    PLATINUM
    DIAMOND
  }

  enum PurchaseStatus {
    PENDING
    COMPLETED
    FAILED
    REFUNDED
  }

  enum InstallStatus {
    PENDING
    INSTALLING
    INSTALLED
    FAILED
    UNINSTALLED
  }

  # ============================================
  # Interfaces
  # ============================================

  interface Node {
    id: ID!
  }

  interface Connection {
    edges: [Edge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  interface Edge {
    node: Node!
    cursor: String!
  }

  # ============================================
  # Pagination Types
  # ============================================

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input PaginationInput {
    first: Int = 20
    after: String
    last: Int
    before: String
  }

  # ============================================
  # Filter Types
  # ============================================

  input TemplateFilters {
    category: TemplateCategory
    status: TemplateStatus
    visibility: TemplateVisibility
    pricingType: PricingType
    priceMin: Float
    priceMax: Float
    ratingMin: Float
    creatorId: ID
    tags: [String!]
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input TemplateSortInput {
    field: TemplateSortField!
    direction: SortDirection!
  }

  enum TemplateSortField {
    CREATED_AT
    UPDATED_AT
    PRICE
    RATING
    DOWNLOADS
    NAME
  }

  enum SortDirection {
    ASC
    DESC
  }

  # ============================================
  # Template Types
  # ============================================

  type Template implements Node {
    id: ID!
    companyId: ID!
    name: String!
    slug: String!
    description: String
    shortDescription: String
    category: TemplateCategory!
    tags: [String!]!
    status: TemplateStatus!
    visibility: TemplateVisibility!

    # Version info
    currentVersionId: ID
    currentVersion: TemplateVersion
    versions: [TemplateVersion!]!
    versionCount: Int!

    # Pricing
    pricingType: PricingType!
    price: Float!
    currency: String!
    subscriptionPeriod: String

    # Stats
    stats: TemplateStats!

    # Lineage
    lineage: TemplateLineage
    parentTemplateId: ID
    parentTemplate: Template
    forkedTemplates: [Template!]!

    # Creator
    creatorId: ID
    creator: Creator

    # Content
    iconUrl: String
    coverImages: [String!]!
    previewUrl: String
    documentationUrl: String

    # Metadata
    metadata: JSON
    settings: JSON

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!
    publishedAt: DateTime
  }

  type TemplateVersion implements Node {
    id: ID!
    templateId: ID!
    template: Template!
    version: String!
    name: String
    description: String
    changelog: String

    # Content
    workflowDefinition: JSON
    nodeDefinitions: JSON
    roleDefinitions: JSON
    deliverableDefinitions: JSON

    # Status
    isLatest: Boolean!
    status: String!

    # Stats
    downloads: Int!
    installs: Int!

    # Creator
    createdBy: ID!
    creator: Creator

    # Timestamps
    createdAt: DateTime!
    publishedAt: DateTime
  }

  type TemplateStats {
    downloads: Int!
    installs: Int!
    forks: Int!
    ratingCount: Int!
    averageRating: Float
    totalRevenue: Float!
    monthlyRevenue: Float!
    monthlySales: Int!
    lastUpdatedAt: DateTime
  }

  type TemplateLineage implements Node {
    id: ID!
    templateId: ID!
    template: Template!

    # Ancestor chain
    rootTemplateId: ID
    rootTemplate: Template
    parentTemplateId: ID
    parentTemplate: Template
    ancestorChain: [TemplateLineageNode!]!

    # Descendants
    directChildren: [Template!]!
    totalDescendants: Int!

    # Revenue sharing
    revenueShareEnabled: Boolean!
    ancestorSharePercent: Float!
    rootSharePercent: Float!

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TemplateLineageNode {
    templateId: ID!
    template: Template!
    depth: Int!
    relationship: String!
  }

  # ============================================
  # Creator Types
  # ============================================

  type Creator implements Node {
    id: ID!
    companyId: ID
    userId: ID
    agentId: ID

    # Identity
    name: String!
    displayName: String
    avatarUrl: String
    bio: String
    website: String
    socialLinks: JSON

    # Tier
    tier: CreatorTier!
    tierUpdatedAt: DateTime

    # Stats
    stats: CreatorStats!

    # Templates
    templates: [Template!]!
    templateCount: Int!

    # Revenue
    revenue: RevenueStats!

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CreatorStats {
    totalTemplates: Int!
    totalDownloads: Int!
    totalForks: Int!
    averageRating: Float
  }

  # ============================================
  # Revenue Types
  # ============================================

  type RevenueStats {
    totalEarned: Float!
    availableBalance: Float!
    withdrawnAmount: Float!
    pendingAmount: Float!

    # Breakdown
    bySource: [RevenueBySource!]!
    byMonth: [RevenueByMonth!]!

    # Currency
    currency: String!

    # Payout history
    payouts: [PayoutRequest!]!
  }

  type RevenueBySource {
    source: String!
    amount: Float!
    count: Int!
  }

  type RevenueByMonth {
    month: String!
    amount: Float!
    sales: Int!
  }

  type PayoutRequest implements Node {
    id: ID!
    accountId: ID!
    amount: Float!
    currency: String!
    status: PayoutStatus!

    # Payment details
    payoutMethod: JSON!
    recipientInfo: JSON!

    # Processing
    requestedAt: DateTime!
    approvedAt: DateTime
    approvedBy: String
    processedAt: DateTime
    completedAt: DateTime
    transactionId: String

    # Failure
    failureReason: String

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ============================================
  # Purchase Types
  # ============================================

  type Purchase implements Node {
    id: ID!
    templateId: ID!
    template: Template!
    buyerCompanyId: ID!
    buyerUserId: ID

    # Pricing
    amount: Float!
    currency: String!
    pricingType: PricingType!

    # Status
    status: PurchaseStatus!

    # Payment
    paymentMethod: PaymentMethod!
    paymentIntentId: String

    # Timestamps
    purchasedAt: DateTime
    expiresAt: DateTime
    createdAt: DateTime!
  }

  type PurchaseResult {
    success: Boolean!
    purchase: Purchase
    error: String
    requiresAction: Boolean
    clientSecret: String
  }

  # ============================================
  # Install Types
  # ============================================

  type InstallResult {
    success: Boolean!
    subscriptionId: ID
    status: InstallStatus!
    message: String
    error: String
  }

  # ============================================
  # Fork Types
  # ============================================

  type ForkResult {
    success: Boolean!
    template: Template
    error: String
  }

  # ============================================
  # Withdrawal Types
  # ============================================

  type WithdrawalRequest {
    success: Boolean!
    request: PayoutRequest
    error: String
  }

  # ============================================
  # Connections
  # ============================================

  type TemplateConnection implements Connection {
    edges: [TemplateEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TemplateEdge implements Edge {
    node: Template!
    cursor: String!
  }

  # ============================================
  # Input Types
  # ============================================

  input PublishTemplateInput {
    name: String!
    slug: String
    description: String
    shortDescription: String
    category: TemplateCategory!
    tags: [String!]
    visibility: TemplateVisibility!
    pricingType: PricingType!
    price: Float!
    currency: String
    subscriptionPeriod: String

    # Content
    iconUrl: String
    coverImages: [String!]
    previewUrl: String
    documentationUrl: String

    # Initial version
    version: String!
    versionDescription: String
    workflowDefinition: JSON
    nodeDefinitions: JSON
    roleDefinitions: JSON
    deliverableDefinitions: JSON

    # Metadata
    metadata: JSON
    settings: JSON
  }

  input UpdateTemplateInput {
    name: String
    description: String
    shortDescription: String
    category: TemplateCategory
    tags: [String!]
    visibility: TemplateVisibility
    pricingType: PricingType
    price: Float
    currency: String
    subscriptionPeriod: String
    iconUrl: String
    coverImages: [String!]
    previewUrl: String
    documentationUrl: String
    metadata: JSON
    settings: JSON
  }

  input PublishVersionInput {
    templateId: ID!
    version: String!
    name: String
    description: String
    changelog: String
    workflowDefinition: JSON
    nodeDefinitions: JSON
    roleDefinitions: JSON
    deliverableDefinitions: JSON
  }

  input ForkTemplateInput {
    templateId: ID!
    customizations: JSON
    newName: String
    newSlug: String
  }

  # ============================================
  # Query Types
  # ============================================

  type Query {
    # Template queries
    templates(
      query: String
      filters: TemplateFilters
      sort: TemplateSortInput
      pagination: PaginationInput
    ): TemplateConnection!

    template(id: ID!): Template
    templateBySlug(slug: String!): Template

    # Version queries
    templateVersions(templateId: ID!, pagination: PaginationInput): [TemplateVersion!]!
    templateVersion(id: ID!): TemplateVersion

    # Lineage queries
    templateLineage(templateId: ID!): TemplateLineage
    templateForks(templateId: ID!, pagination: PaginationInput): TemplateConnection!
    templateAncestors(templateId: ID!): [Template!]!

    # Creator queries
    creator(id: ID!): Creator
    creatorByUserId(userId: ID!): Creator
    topCreators(pagination: PaginationInput): [Creator!]!

    # My queries (authenticated)
    myRevenue: RevenueStats
    myTemplates(pagination: PaginationInput): [Template!]!
    myPurchases(pagination: PaginationInput): [Purchase!]!
    myInstalls: [Template!]!

    # Search
    searchTemplates(query: String!, pagination: PaginationInput): TemplateConnection!
    searchCreators(query: String!, pagination: PaginationInput): [Creator!]!
  }

  # ============================================
  # Mutation Types
  # ============================================

  type Mutation {
    # Purchase and install
    purchaseTemplate(templateId: ID!, paymentMethod: PaymentMethod!, amount: Float): PurchaseResult!
    installTemplate(templateId: ID!): InstallResult!
    uninstallTemplate(subscriptionId: ID!): Boolean!

    # Fork
    forkTemplate(input: ForkTemplateInput!): ForkResult!

    # Publishing
    publishTemplate(input: PublishTemplateInput!): Template!
    updateTemplate(id: ID!, input: UpdateTemplateInput!): Template!
    publishVersion(input: PublishVersionInput!): TemplateVersion!
    deprecateTemplate(id: ID!, reason: String): Template!
    archiveTemplate(id: ID!): Template!

    # Reviews
    rateTemplate(templateId: ID!, rating: Int!, review: String): Boolean!
    updateReview(templateId: ID!, rating: Int, review: String): Boolean!
    deleteReview(templateId: ID!): Boolean!

    # Revenue
    requestWithdrawal(amount: Float!, method: PaymentMethod!): WithdrawalRequest!

    # Admin
    approveTemplate(id: ID!): Template!
    rejectTemplate(id: ID!, reason: String!): Template!
    featureTemplate(id: ID!, featured: Boolean!): Template!
  }

  # ============================================
  # Subscription Types
  # ============================================

  type Subscription {
    # Real-time updates
    templateUpdated(templateId: ID!): Template!
    templateStatsUpdated(templateId: ID!): TemplateStats!
    revenueUpdated: RevenueStats!
  }
`;
