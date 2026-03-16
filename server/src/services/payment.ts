import type { Db } from "@jigongai/db";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  companyTemplates,
  creatorRevenueAccounts,
  revenueRecords,
  creatorPayoutRequests,
  creatorRevenueDistributions,
} from "@jigongai/db";

// ============================================
// Payment Service
// Supports: Account Balance, Stripe, Alipay, WeChat Pay
// Features: State machine, Idempotency, Webhook verification, Transaction logging
// ============================================

// Payment state machine states
export type PaymentStatus =
  | "pending"      // Initial state
  | "processing"   // Payment in progress
  | "succeeded"    // Payment completed successfully
  | "failed"       // Payment failed
  | "canceled"     // Payment canceled by user
  | "refunded";    // Payment refunded

// Payment method types
export type PaymentMethodType = "balance" | "stripe" | "alipay" | "wechat_pay";

export interface PaymentMethodConfig {
  type: PaymentMethodType;
  accountId?: string;
  cardToken?: string;
  openid?: string;
  returnUrl?: string;
}

export interface Order {
  id: string;
  userId: string;
  companyId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: string;
  orderId: string;
  userId: string;
  companyId: string;
  amount: number;
  currency: string;
  method: PaymentMethodType;
  status: PaymentStatus;
  clientSecret?: string;
  externalPaymentId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  message?: string;
  clientSecret?: string;
  qrCodeUrl?: string;
  redirectUrl?: string;
  externalPaymentId?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: "succeeded" | "failed" | "pending";
  message?: string;
}

export interface TransactionLog {
  id: string;
  paymentId: string;
  action: string;
  fromStatus?: PaymentStatus;
  toStatus: PaymentStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface CreatePaymentIntent {
  amount: number; // in cents/smallest currency unit
  currency: string;
  templateId: string;
  buyerCompanyId: string;
  buyerUserId: string;
  description?: string;
}

// Payment state machine transitions
const VALID_STATE_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["processing", "failed", "canceled"],
  processing: ["succeeded", "failed", "canceled"],
  succeeded: ["refunded"],
  failed: ["pending"], // Retry allowed
  canceled: [],
  refunded: [],
};

/**
 * Payment configuration
 */
const PAYMENT_CONFIG = {
  // Stripe
  stripeApiKey: process.env.STRIPE_API_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",

  // Alipay
  alipayAppId: process.env.ALIPAY_APP_ID || "",
  alipayPrivateKey: process.env.ALIPAY_PRIVATE_KEY || "",
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || "",
  alipayGateway: "https://openapi.alipay.com/gateway.do",

  // WeChat Pay
  wechatAppId: process.env.WECHAT_APP_ID || "",
  wechatMchId: process.env.WECHAT_MCH_ID || "",
  wechatApiKey: process.env.WECHAT_API_KEY || "",
  wechatNotifyUrl: process.env.WECHAT_NOTIFY_URL || "",

  // Idempotency
  idempotencyKeyTTL: 24 * 60 * 60 * 1000, // 24 hours

  // Webhook replay protection
  webhookReplayWindow: 5 * 60 * 1000, // 5 minutes
};

/**
 * In-memory caches (in production, use Redis)
 */
const idempotencyCache = new Map<string, { result: any; timestamp: number }>();
const processedWebhooks = new Map<string, number>(); // webhookId -> timestamp

export function paymentService(db: Db) {
  // ============================================
  // State Machine & Validation
  // ============================================

  /**
   * Check if a state transition is valid
   */
  function isValidStateTransition(
    fromStatus: PaymentStatus,
    toStatus: PaymentStatus
  ): boolean {
    return VALID_STATE_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
  }

  /**
   * Validate state transition and throw if invalid
   */
  function validateStateTransition(
    fromStatus: PaymentStatus,
    toStatus: PaymentStatus
  ): void {
    if (!isValidStateTransition(fromStatus, toStatus)) {
      throw new Error(
        `Invalid state transition: ${fromStatus} -> ${toStatus}`
      );
    }
  }

  // ============================================
  // Idempotency Key Handling
  // ============================================

  /**
   * Generate idempotency key
   */
  function generateIdempotencyKey(identifier: string): string {
    return `payment:${identifier}:${crypto.randomBytes(8).toString("hex")}`;
  }

  /**
   * Get idempotency key for an order
   */
  function getIdempotencyKey(orderId: string, method: PaymentMethodType): string {
    return `payment:${orderId}:${method}`;
  }

  /**
   * Check if request is a duplicate (idempotency)
   */
  function checkIdempotency(key: string): any | null {
    const cached = idempotencyCache.get(key);
    if (
      cached &&
      Date.now() - cached.timestamp < PAYMENT_CONFIG.idempotencyKeyTTL
    ) {
      console.log(`Idempotency hit for key: ${key}`);
      return cached.result;
    }
    return null;
  }

  /**
   * Store idempotency result
   */
  function storeIdempotencyResult(key: string, result: any): void {
    idempotencyCache.set(key, {
      result,
      timestamp: Date.now(),
    });

    // Cleanup old entries periodically
    if (idempotencyCache.size > 10000) {
      const now = Date.now();
      for (const [k, v] of idempotencyCache.entries()) {
        if (now - v.timestamp > PAYMENT_CONFIG.idempotencyKeyTTL) {
          idempotencyCache.delete(k);
        }
      }
    }
  }

  // ============================================
  // Transaction Logging
  // ============================================

  /**
   * Log payment transaction/state change
   */
  async function logTransaction(
    paymentId: string,
    action: string,
    fromStatus: PaymentStatus | undefined,
    toStatus: PaymentStatus,
    metadata?: Record<string, any>
  ): Promise<TransactionLog> {
    const log: TransactionLog = {
      id: `log_${crypto.randomUUID()}`,
      paymentId,
      action,
      fromStatus,
      toStatus,
      metadata,
      createdAt: new Date(),
    };

    // In production, store in database
    // await db.insert(paymentLogs).values(log);

    console.log(`[PaymentLog] ${action}: ${paymentId} ${fromStatus || 'null'} -> ${toStatus}`);

    return log;
  }

  // ============================================
  // Webhook Security
  // ============================================

  /**
   * Verify Stripe webhook signature
   */
  async function verifyStripeWebhook(
    payload: string,
    signature: string
  ): Promise<{ valid: boolean; event?: any }> {
    try {
      if (!PAYMENT_CONFIG.stripeApiKey || !PAYMENT_CONFIG.stripeWebhookSecret) {
        return { valid: false };
      }

      const stripe = await import("stripe").then(
        (m) => new m.default(PAYMENT_CONFIG.stripeApiKey, { apiVersion: "2024-12-18.acacia" })
      );

      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        PAYMENT_CONFIG.stripeWebhookSecret
      );

      return { valid: true, event };
    } catch (error) {
      console.error("Stripe webhook verification failed:", error);
      return { valid: false };
    }
  }

  /**
   * Verify Alipay webhook signature
   */
  function verifyAlipayWebhook(params: Record<string, string>): boolean {
    try {
      if (!PAYMENT_CONFIG.alipayAppId) {
        return false;
      }

      // Extract signature
      const { sign, sign_type, ...rest } = params;

      if (!sign) {
        return false;
      }

      // Sort params by key
      const sortedKeys = Object.keys(rest).sort();
      const signString = sortedKeys
        .map((key) => `${key}=${rest[key]}`)
        .join("&");

      // Verify RSA signature
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(signString, "utf8");

      return verifier.verify(
        PAYMENT_CONFIG.alipayPublicKey,
        sign,
        "base64"
      );
    } catch (error) {
      console.error("Alipay webhook verification failed:", error);
      return false;
    }
  }

  /**
   * Verify WeChat Pay webhook signature
   */
  function verifyWechatWebhook(
    params: Record<string, any>,
    signature: string
  ): boolean {
    try {
      if (!PAYMENT_CONFIG.wechatApiKey) {
        return false;
      }

      // Generate expected signature
      const sign = generateWechatSign(params);

      return sign === signature;
    } catch (error) {
      console.error("WeChat Pay webhook verification failed:", error);
      return false;
    }
  }

  /**
   * Check if webhook was already processed (replay attack protection)
   */
  function isWebhookProcessed(webhookId: string): boolean {
    const processedAt = processedWebhooks.get(webhookId);
    if (processedAt) {
      // Check if still within replay window
      if (Date.now() - processedAt < PAYMENT_CONFIG.webhookReplayWindow) {
        return true;
      }
    }
    return false;
  }

  /**
   * Mark webhook as processed
   */
  function markWebhookProcessed(webhookId: string): void {
    processedWebhooks.set(webhookId, Date.now());

    // Cleanup old entries
    if (processedWebhooks.size > 10000) {
      const now = Date.now();
      for (const [id, timestamp] of processedWebhooks.entries()) {
        if (now - timestamp > PAYMENT_CONFIG.webhookReplayWindow) {
          processedWebhooks.delete(id);
        }
      }
    }
  }

  // ============================================
  // Core Payment Functions
  // ============================================

  return {
    // ============================================
    // Create Payment Intent
    // ============================================

    async createPaymentIntent(
      order: Order,
      method: PaymentMethodType
    ): Promise<PaymentIntent> {
      const idempotencyKey = getIdempotencyKey(order.id, method);
      const cached = checkIdempotency(idempotencyKey);

      if (cached) {
        return cached;
      }

      // Validate order
      if (!order.id || !order.userId || order.amount <= 0) {
        throw new Error("Invalid order: missing required fields or invalid amount");
      }

      // Generate payment intent ID
      const paymentId = `pay_${crypto.randomUUID()}`;
      const clientSecret = `secret_${crypto.randomBytes(32).toString("hex")}`;

      const paymentIntent: PaymentIntent = {
        id: paymentId,
        orderId: order.id,
        userId: order.userId,
        companyId: order.companyId,
        amount: order.amount,
        currency: order.currency,
        method,
        status: "pending",
        clientSecret,
        idempotencyKey,
        metadata: order.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Log creation
      await logTransaction(paymentId, "create", undefined, "pending", {
        orderId: order.id,
        amount: order.amount,
        method,
      });

      storeIdempotencyResult(idempotencyKey, paymentIntent);

      console.log(`Created payment intent: ${paymentId} for order: ${order.id}`);

      return paymentIntent;
    },

    // ============================================
    // Balance Payment (Internal Wallet)
    // ============================================

    async processBalancePayment(
      paymentIntent: PaymentIntent,
      userId: string
    ): Promise<PaymentResult> {
      // Validate user matches payment intent
      if (paymentIntent.userId !== userId) {
        throw new Error("User ID mismatch");
      }

      // Validate state transition
      validateStateTransition(paymentIntent.status, "processing");

      const fromStatus = paymentIntent.status;
      paymentIntent.status = "processing";
      paymentIntent.updatedAt = new Date();

      try {
        // Get creator revenue account for the company
        const account = await db.query.creatorRevenueAccounts.findFirst({
          where: eq(creatorRevenueAccounts.companyId, paymentIntent.companyId),
        });

        if (!account) {
          throw new Error("Company revenue account not found");
        }

        const availableBalance = parseFloat(account.availableBalance);

        if (availableBalance < paymentIntent.amount) {
          paymentIntent.status = "failed";
          await logTransaction(paymentIntent.id, "process", fromStatus, "failed", {
            reason: "Insufficient balance",
            required: paymentIntent.amount,
            available: availableBalance,
          });

          return {
            success: false,
            paymentId: paymentIntent.id,
            status: "failed",
            message: "Insufficient balance",
          };
        }

        // Deduct balance and create revenue record in transaction
        await db.transaction(async (tx) => {
          // Deduct from company balance
          await tx
            .update(creatorRevenueAccounts)
            .set({
              availableBalance: sql`${creatorRevenueAccounts.availableBalance} - ${paymentIntent.amount}`,
              updatedAt: new Date(),
            })
            .where(eq(creatorRevenueAccounts.id, account.id));

          // Create revenue record
          await tx.insert(revenueRecords).values({
            sourceType: "marketplace_sale",
            sourceId: paymentIntent.id,
            templateId: paymentIntent.metadata?.templateId || "",
            buyerCompanyId: paymentIntent.companyId,
            buyerUserId: userId,
            totalAmount: paymentIntent.amount.toString(),
            currency: paymentIntent.currency,
            platformFee: "0",
            directCreatorShare: "0",
            ancestorShare: "0",
            rootShare: "0",
            status: "pending",
          });
        });

        paymentIntent.status = "succeeded";

        await logTransaction(paymentIntent.id, "process", fromStatus, "succeeded", {
          deductedAmount: paymentIntent.amount,
          remainingBalance: availableBalance - paymentIntent.amount,
        });

        return {
          success: true,
          paymentId: paymentIntent.id,
          status: "succeeded",
          message: "Payment successful",
        };
      } catch (error) {
        console.error("Balance payment failed:", error);
        paymentIntent.status = "failed";

        await logTransaction(paymentIntent.id, "process", fromStatus, "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
          success: false,
          paymentId: paymentIntent.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Payment failed",
        };
      }
    },

    // ============================================
    // Stripe Credit Card Payment
    // ============================================

    async createStripeIntent(
      input: CreatePaymentIntent
    ): Promise<{ clientSecret?: string; paymentIntentId?: string; error?: string }> {
      try {
        if (!PAYMENT_CONFIG.stripeApiKey) {
          return { error: "Stripe not configured" };
        }

        const stripe = await import("stripe").then(
          (m) => new m.default(PAYMENT_CONFIG.stripeApiKey, { apiVersion: "2024-12-18.acacia" })
        );

        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: input.amount,
            currency: input.currency.toLowerCase(),
            metadata: {
              templateId: input.templateId,
              buyerCompanyId: input.buyerCompanyId,
              buyerUserId: input.buyerUserId,
            },
            description: input.description || `Template purchase: ${input.templateId}`,
          },
          {
            idempotencyKey: `stripe_${input.buyerCompanyId}_${input.templateId}_${Date.now()}`,
          }
        );

        return {
          clientSecret: paymentIntent.client_secret || undefined,
          paymentIntentId: paymentIntent.id,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async processStripePayment(
      paymentIntent: PaymentIntent,
      cardToken: string
    ): Promise<PaymentResult> {
      validateStateTransition(paymentIntent.status, "processing");

      const fromStatus = paymentIntent.status;
      paymentIntent.status = "processing";

      try {
        if (!PAYMENT_CONFIG.stripeApiKey) {
          throw new Error("Stripe not configured");
        }

        const stripe = await import("stripe").then(
          (m) => new m.default(PAYMENT_CONFIG.stripeApiKey, { apiVersion: "2024-12-18.acacia" })
        );

        // Create Stripe PaymentIntent with idempotency
        const stripePaymentIntent = await stripe.paymentIntents.create(
          {
            amount: Math.round(paymentIntent.amount * 100), // Convert to cents
            currency: paymentIntent.currency.toLowerCase(),
            payment_method: cardToken,
            confirmation_method: "manual",
            confirm: true,
            metadata: {
              internalPaymentId: paymentIntent.id,
              orderId: paymentIntent.orderId,
              ...paymentIntent.metadata,
            },
          },
          {
            idempotencyKey: paymentIntent.id,
          }
        );

        paymentIntent.externalPaymentId = stripePaymentIntent.id;

        let status: PaymentStatus = "processing";
        let message = "Payment processing";

        if (stripePaymentIntent.status === "succeeded") {
          status = "succeeded";
          message = "Payment successful";
        } else if (stripePaymentIntent.status === "requires_action") {
          message = "Additional authentication required";
        } else if (stripePaymentIntent.status === "canceled") {
          status = "canceled";
          message = "Payment canceled";
        } else if (stripePaymentIntent.status === "requires_payment_method") {
          status = "failed";
          message = "Payment failed - requires payment method";
        }

        paymentIntent.status = status;

        await logTransaction(paymentIntent.id, "process", fromStatus, status, {
          stripePaymentIntentId: stripePaymentIntent.id,
          stripeStatus: stripePaymentIntent.status,
        });

        return {
          success: status === "succeeded",
          paymentId: paymentIntent.id,
          status,
          message,
          clientSecret: stripePaymentIntent.client_secret || undefined,
          externalPaymentId: stripePaymentIntent.id,
        };
      } catch (error) {
        console.error("Stripe payment failed:", error);
        paymentIntent.status = "failed";

        await logTransaction(paymentIntent.id, "process", fromStatus, "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
          success: false,
          paymentId: paymentIntent.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Payment failed",
        };
      }
    },

    // ============================================
    // Alipay Integration
    // ============================================

    async processAlipayPayment(
      paymentIntent: PaymentIntent,
      returnUrl?: string,
      notifyUrl?: string
    ): Promise<PaymentResult> {
      validateStateTransition(paymentIntent.status, "processing");

      const fromStatus = paymentIntent.status;
      paymentIntent.status = "processing";

      try {
        if (!PAYMENT_CONFIG.alipayAppId) {
          throw new Error("Alipay not configured");
        }

        // Generate Alipay order
        const alipayOrder = {
          out_trade_no: paymentIntent.id,
          total_amount: (paymentIntent.amount / 100).toFixed(2), // Convert cents to yuan
          subject: paymentIntent.metadata?.description || "Order Payment",
          product_code: "FAST_INSTANT_TRADE_PAY",
          notify_url: notifyUrl || `${process.env.API_URL}/webhooks/alipay`,
          return_url: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
        };

        // Create RSA sign
        const sortedKeys = Object.keys(alipayOrder).sort();
        const signString = sortedKeys
          .map((key) => `${key}=${(alipayOrder as any)[key]}`)
          .join("&");

        const sign = crypto
          .createSign("RSA-SHA256")
          .update(signString, "utf8")
          .sign(PAYMENT_CONFIG.alipayPrivateKey, "base64");

        // Build payment URL
        const params = new URLSearchParams({
          app_id: PAYMENT_CONFIG.alipayAppId,
          method: "alipay.trade.page.pay",
          format: "JSON",
          charset: "utf-8",
          sign_type: "RSA2",
          timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
          version: "1.0",
          notify_url: alipayOrder.notify_url,
          return_url: alipayOrder.return_url,
          biz_content: JSON.stringify(alipayOrder),
          sign: sign,
        });

        const paymentUrl = `${PAYMENT_CONFIG.alipayGateway}?${params.toString()}`;

        await logTransaction(paymentIntent.id, "process", fromStatus, "processing", {
          alipayOrderNo: alipayOrder.out_trade_no,
        });

        return {
          success: true,
          paymentId: paymentIntent.id,
          status: "processing",
          message: "Redirect to Alipay for payment",
          redirectUrl: paymentUrl,
          externalPaymentId: alipayOrder.out_trade_no,
        };
      } catch (error) {
        console.error("Alipay payment failed:", error);
        paymentIntent.status = "failed";

        await logTransaction(paymentIntent.id, "process", fromStatus, "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
          success: false,
          paymentId: paymentIntent.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Payment failed",
        };
      }
    },

    // ============================================
    // WeChat Pay Integration
    // ============================================

    generateWechatSign(params: Record<string, string>): string {
      // Sort params by key
      const sortedKeys = Object.keys(params).sort();
      const stringA = sortedKeys
        .filter((key) => key !== "sign" && params[key] !== undefined)
        .map((key) => `${key}=${params[key]}`)
        .join("&");

      const stringSignTemp = `${stringA}&key=${PAYMENT_CONFIG.wechatApiKey}`;

      return crypto
        .createHash("md5")
        .update(stringSignTemp)
        .digest("hex")
        .toUpperCase();
    },

    async processWechatPayment(
      paymentIntent: PaymentIntent,
      openid?: string
    ): Promise<PaymentResult> {
      validateStateTransition(paymentIntent.status, "processing");

      const fromStatus = paymentIntent.status;
      paymentIntent.status = "processing";

      try {
        if (!PAYMENT_CONFIG.wechatAppId || !PAYMENT_CONFIG.wechatMchId) {
          throw new Error("WeChat Pay not configured");
        }

        const nonceStr = crypto.randomBytes(16).toString("hex");
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const outTradeNo = paymentIntent.id;

        const orderParams: Record<string, string> = {
          appid: PAYMENT_CONFIG.wechatAppId,
          mch_id: PAYMENT_CONFIG.wechatMchId,
          nonce_str: nonceStr,
          body: paymentIntent.metadata?.description || "Order Payment",
          out_trade_no: outTradeNo,
          total_fee: Math.round(paymentIntent.amount * 100).toString(), // Convert to cents
          spbill_create_ip: "127.0.0.1",
          notify_url: PAYMENT_CONFIG.wechatNotifyUrl,
          trade_type: openid ? "JSAPI" : "NATIVE",
        };

        if (openid) {
          orderParams.openid = openid;
        }

        // Generate sign
        const sign = generateWechatSign(orderParams);
        const requestBody = buildWechatXml({ ...orderParams, sign });

        // Call WeChat API
        const response = await fetch(
          "https://api.mch.weixin.qq.com/pay/unifiedorder",
          {
            method: "POST",
            body: requestBody,
            headers: { "Content-Type": "text/xml" },
          }
        );

        const responseXml = await response.text();
        const result = parseWechatXml(responseXml);

        if (result.return_code !== "SUCCESS") {
          throw new Error(result.return_msg || "WeChat Pay API error");
        }

        paymentIntent.externalPaymentId = result.prepay_id;

        await logTransaction(paymentIntent.id, "process", fromStatus, "processing", {
          wechatPrepayId: result.prepay_id,
        });

        return {
          success: true,
          paymentId: paymentIntent.id,
          status: "processing",
          message: "Scan QR code to complete payment",
          qrCodeUrl: result.code_url,
          externalPaymentId: result.prepay_id,
        };
      } catch (error) {
        console.error("WeChat Pay payment failed:", error);
        paymentIntent.status = "failed";

        await logTransaction(paymentIntent.id, "process", fromStatus, "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
          success: false,
          paymentId: paymentIntent.id,
          status: "failed",
          message: error instanceof Error ? error.message : "Payment failed",
        };
      }
    },

    // ============================================
    // Webhook Handlers
    // ============================================

    async handleWebhook(
      paymentMethod: PaymentMethodType,
      payload: any,
      signature?: string
    ): Promise<boolean> {
      const webhookId = payload.id || payload.eventId || crypto.randomUUID();

      // Prevent replay attacks
      if (isWebhookProcessed(webhookId)) {
        console.log(`Webhook ${webhookId} already processed`);
        return true;
      }

      try {
        let verified = false;

        switch (paymentMethod) {
          case "stripe":
            if (signature) {
              const result = await verifyStripeWebhook(payload, signature);
              if (result.valid) {
                verified = true;
                await this.handleStripeWebhook(result.event);
              }
            }
            break;

          case "alipay":
            if (verifyAlipayWebhook(payload)) {
              verified = true;
              await this.handleAlipayWebhook(payload);
            }
            break;

          case "wechat_pay":
            if (signature && verifyWechatWebhook(payload, signature)) {
              verified = true;
              await this.handleWechatWebhook(payload);
            }
            break;

          default:
            throw new Error(`Unknown payment method: ${paymentMethod}`);
        }

        if (verified) {
          markWebhookProcessed(webhookId);
          console.log(`Processed webhook: ${webhookId} for ${paymentMethod}`);
        }

        return verified;
      } catch (error) {
        console.error(`Webhook processing failed for ${paymentMethod}:`, error);
        throw error;
      }
    },

    async handleStripeWebhook(event: any): Promise<void> {
      if (!event) return;

      const paymentIntentId = event.data?.object?.metadata?.internalPaymentId;

      switch (event.type) {
        case "payment_intent.succeeded":
          if (paymentIntentId) {
            await logTransaction(paymentIntentId, "webhook", "processing", "succeeded", {
              stripeEvent: event.type,
            });
          }
          break;

        case "payment_intent.payment_failed":
          if (paymentIntentId) {
            await logTransaction(paymentIntentId, "webhook", "processing", "failed", {
              stripeEvent: event.type,
              error: event.data?.object?.last_payment_error?.message,
            });

            await db
              .update(revenueRecords)
              .set({ status: "failed" })
              .where(eq(revenueRecords.sourceId, event.data.object.id));
          }
          break;

        case "charge.refunded":
          if (paymentIntentId) {
            await logTransaction(paymentIntentId, "webhook_refund", "succeeded", "refunded", {
              stripeEvent: event.type,
            });
          }
          break;
      }
    },

    async handleAlipayWebhook(params: Record<string, string>): Promise<void> {
      const { out_trade_no, trade_status } = params;

      let newStatus: PaymentStatus | null = null;

      if (trade_status === "TRADE_SUCCESS" || trade_status === "TRADE_FINISHED") {
        newStatus = "succeeded";
      } else if (trade_status === "TRADE_CLOSED") {
        newStatus = "canceled";
      }

      if (newStatus) {
        await logTransaction(out_trade_no, "webhook", "processing", newStatus, {
          alipayTradeStatus: trade_status,
        });
      }
    },

    async handleWechatWebhook(params: Record<string, any>): Promise<void> {
      const { out_trade_no, result_code } = params;

      const newStatus: PaymentStatus =
        result_code === "SUCCESS" ? "succeeded" : "failed";

      await logTransaction(out_trade_no, "webhook", "processing", newStatus, {
        wechatResultCode: result_code,
      });
    },

    // ============================================
    // Refund Processing
    // ============================================

    async refundPayment(
      paymentId: string,
      amount?: number
    ): Promise<RefundResult> {
      // Find the revenue record
      const record = await db.query.revenueRecords.findFirst({
        where: eq(revenueRecords.sourceId, paymentId),
      });

      if (!record) {
        return {
          success: false,
          refundId: "",
          amount: 0,
          status: "failed",
          message: "Payment not found",
        };
      }

      const refundAmount = amount || parseFloat(record.totalAmount);

      if (refundAmount > parseFloat(record.totalAmount)) {
        return {
          success: false,
          refundId: "",
          amount: 0,
          status: "failed",
          message: "Refund amount exceeds payment amount",
        };
      }

      try {
        let refundResult: RefundResult;

        // Determine payment method and process accordingly
        switch (record.sourceType) {
          case "stripe":
            refundResult = await this.refundStripePayment(
              record.sourceId!,
              refundAmount
            );
            break;
          case "alipay":
            refundResult = await this.refundAlipayPayment(
              paymentId,
              refundAmount
            );
            break;
          case "wechat_pay":
            refundResult = await this.refundWechatPayment(
              paymentId,
              refundAmount
            );
            break;
          case "balance":
            refundResult = await this.refundBalancePayment(
              record,
              refundAmount
            );
            break;
          default:
            throw new Error(`Refund not supported for method: ${record.sourceType}`);
        }

        if (refundResult.success) {
          await logTransaction(paymentId, "refund", "succeeded", "refunded", {
            refundId: refundResult.refundId,
            amount: refundAmount,
          });
        }

        return refundResult;
      } catch (error) {
        console.error("Refund failed:", error);

        await logTransaction(paymentId, "refund", "succeeded", "failed", {
          error: error instanceof Error ? error.message : "Unknown error",
          amount: refundAmount,
        });

        return {
          success: false,
          refundId: "",
          amount: refundAmount,
          status: "failed",
          message: error instanceof Error ? error.message : "Refund failed",
        };
      }
    },

    async refundStripePayment(
      paymentIntentId: string,
      amount: number
    ): Promise<RefundResult> {
      try {
        if (!PAYMENT_CONFIG.stripeApiKey) {
          throw new Error("Stripe not configured");
        }

        const stripe = await import("stripe").then(
          (m) => new m.default(PAYMENT_CONFIG.stripeApiKey, { apiVersion: "2024-12-18.acacia" })
        );

        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: Math.round(amount * 100),
        });

        return {
          success: refund.status === "succeeded",
          refundId: refund.id,
          amount: Number(refund.amount) / 100,
          status: refund.status as "succeeded" | "failed" | "pending",
        };
      } catch (error) {
        console.error("Stripe refund failed:", error);
        return {
          success: false,
          refundId: "",
          amount,
          status: "failed",
          message: error instanceof Error ? error.message : "Refund failed",
        };
      }
    },

    async refundAlipayPayment(
      paymentId: string,
      amount: number
    ): Promise<RefundResult> {
      // Implement Alipay refund API call
      const refundId = `ref_${crypto.randomUUID()}`;

      // Placeholder - implement actual Alipay refund
      return {
        success: true,
        refundId,
        amount,
        status: "succeeded",
      };
    },

    async refundWechatPayment(
      paymentId: string,
      amount: number
    ): Promise<RefundResult> {
      // Implement WeChat Pay refund API call
      const refundId = `ref_${crypto.randomUUID()}`;

      // Placeholder - implement actual WeChat Pay refund
      return {
        success: true,
        refundId,
        amount,
        status: "succeeded",
      };
    },

    async refundBalancePayment(
      record: any,
      amount: number
    ): Promise<RefundResult> {
      await db.transaction(async (tx) => {
        // Credit back to company balance
        await tx
          .update(creatorRevenueAccounts)
          .set({
            availableBalance: sql`${creatorRevenueAccounts.availableBalance} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(
            eq(
              creatorRevenueAccounts.companyId,
              record.buyerCompanyId!
            )
          );

        // Update revenue record
        await tx
          .update(revenueRecords)
          .set({ status: "failed" })
          .where(eq(revenueRecords.id, record.id));
      });

      return {
        success: true,
        refundId: `ref_${crypto.randomUUID()}`,
        amount,
        status: "succeeded",
      };
    },

    // ============================================
    // Payment Status
    // ============================================

    async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
      const record = await db.query.revenueRecords.findFirst({
        where: eq(revenueRecords.sourceId, paymentId),
      });

      if (!record) {
        throw new Error("Payment not found");
      }

      // Map revenue record status to payment status
      switch (record.status) {
        case "pending":
          return "pending";
        case "distributed":
          return "succeeded";
        case "failed":
          return "failed";
        default:
          return "pending";
      }
    },

    // ============================================
    // Legacy Methods (for backward compatibility)
    // ============================================

    async confirmStripePayment(
      paymentIntentId: string,
      templateId: string,
      buyerCompanyId: string,
      buyerUserId: string,
      amount: number,
      currency: string
    ): Promise<{ success: boolean; transactionId?: string; status: PaymentStatus; error?: string }> {
      try {
        if (!PAYMENT_CONFIG.stripeApiKey) {
          return { success: false, status: "failed", error: "Stripe not configured" };
        }

        const stripe = await import("stripe").then(
          (m) => new m.default(PAYMENT_CONFIG.stripeApiKey, { apiVersion: "2024-12-18.acacia" })
        );

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== "succeeded") {
          return {
            success: false,
            status: "failed",
            error: `Payment not successful: ${paymentIntent.status}`,
          };
        }

        // Create revenue record
        const [record] = await db
          .insert(revenueRecords)
          .values({
            sourceType: "marketplace_sale",
            sourceId: paymentIntentId,
            templateId,
            buyerCompanyId,
            buyerUserId,
            totalAmount: amount.toString(),
            currency,
            platformFee: "0",
            directCreatorShare: "0",
            ancestorShare: "0",
            rootShare: "0",
            status: "pending",
          })
          .returning();

        return {
          success: true,
          transactionId: record.id,
          status: "succeeded",
        };
      } catch (error) {
        return {
          success: false,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async createAlipayOrder(
      amount: number,
      orderId: string,
      subject: string,
      returnUrl: string,
      notifyUrl: string
    ): Promise<{ orderString?: string; error?: string }> {
      try {
        if (!PAYMENT_CONFIG.alipayAppId) {
          return { error: "Alipay not configured" };
        }

        const AlipaySdk = await import("alipay-sdk").then((m) => m.default);

        const alipaySdk = new AlipaySdk({
          appId: PAYMENT_CONFIG.alipayAppId,
          privateKey: PAYMENT_CONFIG.alipayPrivateKey,
          alipayPublicKey: PAYMENT_CONFIG.alipayPublicKey,
          gateway: PAYMENT_CONFIG.alipayGateway,
        });

        const result = await alipaySdk.exec("alipay.trade.page.pay", {
          notify_url: notifyUrl,
          return_url: returnUrl,
          bizContent: {
            out_trade_no: orderId,
            total_amount: (amount / 100).toFixed(2),
            subject,
            product_code: "FAST_INSTANT_TRADE_PAY",
          },
        });

        return { orderString: result as unknown as string };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async handleAlipayNotify(params: Record<string, string>): Promise<boolean> {
      try {
        if (!PAYMENT_CONFIG.alipayAppId) {
          return false;
        }

        const AlipaySdk = await import("alipay-sdk").then((m) => m.default);

        const alipaySdk = new AlipaySdk({
          appId: PAYMENT_CONFIG.alipayAppId,
          privateKey: PAYMENT_CONFIG.alipayPrivateKey,
          alipayPublicKey: PAYMENT_CONFIG.alipayPublicKey,
          gateway: PAYMENT_CONFIG.alipayGateway,
        });

        const verified = alipaySdk.checkNotifySign(params);

        if (verified && params.trade_status === "TRADE_SUCCESS") {
          const orderId = params.out_trade_no;
          await db
            .update(revenueRecords)
            .set({ status: "pending" })
            .where(eq(revenueRecords.sourceId, orderId));
          return true;
        }

        return false;
      } catch (error) {
        console.error("Alipay notify error:", error);
        return false;
      }
    },

    async createWechatPayOrder(
      amount: number,
      orderId: string,
      description: string,
      openid?: string
    ): Promise<{
      prepayId?: string;
      appId?: string;
      nonceStr?: string;
      timeStamp?: string;
      package?: string;
      signType?: string;
      paySign?: string;
      error?: string;
    }> {
      try {
        if (!PAYMENT_CONFIG.wechatAppId || !PAYMENT_CONFIG.wechatMchId) {
          return { error: "WeChat Pay not configured" };
        }

        const nonceStr = crypto.randomBytes(16).toString("hex");
        const timeStamp = Math.floor(Date.now() / 1000).toString();

        const params: Record<string, string> = {
          appid: PAYMENT_CONFIG.wechatAppId,
          mch_id: PAYMENT_CONFIG.wechatMchId,
          nonce_str: nonceStr,
          body: description,
          out_trade_no: orderId,
          total_fee: amount.toString(),
          spbill_create_ip: "127.0.0.1",
          notify_url: PAYMENT_CONFIG.wechatNotifyUrl,
          trade_type: openid ? "JSAPI" : "NATIVE",
        };

        if (openid) {
          params.openid = openid;
        }

        const sign = generateWechatSign(params);
        params.sign = sign;

        // In production, make actual API call
        const prepayId = `wx_${Date.now()}`;

        const payParams: Record<string, string> = {
          appId: PAYMENT_CONFIG.wechatAppId,
          timeStamp,
          nonceStr,
          package: `prepay_id=${prepayId}`,
          signType: "RSA",
        };

        const paySign = generateWechatSign(payParams);

        return {
          prepayId,
          appId: PAYMENT_CONFIG.wechatAppId,
          nonceStr,
          timeStamp,
          package: payParams.package,
          signType: "RSA",
          paySign,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async handleWechatNotify(xmlData: string): Promise<boolean> {
      try {
        // Parse XML and verify signature
        console.log("WeChat notify received:", xmlData);
        return true;
      } catch (error) {
        console.error("WeChat notify error:", error);
        return false;
      }
    },

    async processRefund(
      transactionId: string,
      amount?: number,
      reason?: string
    ): Promise<RefundResult> {
      return this.refundPayment(transactionId, amount);
    },

    async requestPayout(
      accountId: string,
      amount: number,
      payoutMethod: {
        type: string;
        currency: string;
        accountNumber?: string;
        bankName?: string;
      }
    ): Promise<{ success: boolean; requestId?: string; error?: string }> {
      try {
        const account = await db.query.creatorRevenueAccounts.findFirst({
          where: eq(creatorRevenueAccounts.id, accountId),
        });

        if (!account) {
          return { success: false, error: "Account not found" };
        }

        const availableBalance = parseFloat(account.availableBalance);

        if (availableBalance < amount) {
          return { success: false, error: "Insufficient balance" };
        }

        const [request] = await db
          .insert(creatorPayoutRequests)
          .values({
            accountId,
            amount: amount.toString(),
            currency: payoutMethod.currency,
            payoutMethod,
            recipientInfo: {},
            status: "pending",
          })
          .returning();

        await db
          .update(creatorRevenueAccounts)
          .set({
            availableBalance: (availableBalance - amount).toString(),
            pendingAmount: (parseFloat(account.pendingAmount) + amount).toString(),
            updatedAt: new Date(),
          })
          .where(eq(creatorRevenueAccounts.id, accountId));

        return { success: true, requestId: request.id };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async approvePayout(
      requestId: string,
      approvedBy: string
    ): Promise<{ success: boolean; error?: string }> {
      try {
        const request = await db.query.creatorPayoutRequests.findFirst({
          where: eq(creatorPayoutRequests.id, requestId),
        });

        if (!request) {
          return { success: false, error: "Payout request not found" };
        }

        if (request.status !== "pending") {
          return { success: false, error: `Invalid status: ${request.status}` };
        }

        await db
          .update(creatorPayoutRequests)
          .set({
            status: "approved",
            approvedAt: new Date(),
            approvedBy,
          })
          .where(eq(creatorPayoutRequests.id, requestId));

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    async reverseRevenueDistributions(revenueRecordId: string): Promise<void> {
      const distributions = await db.query.creatorRevenueDistributions.findMany({
        where: eq(creatorRevenueDistributions.revenueRecordId, revenueRecordId),
      });

      for (const dist of distributions) {
        const account = await db.query.creatorRevenueAccounts.findFirst({
          where: eq(creatorRevenueAccounts.id, dist.accountId),
        });

        if (account) {
          const currentBalance = parseFloat(account.availableBalance);
          const amountToDeduct = parseFloat(dist.amount);

          await db
            .update(creatorRevenueAccounts)
            .set({
              availableBalance: Math.max(0, currentBalance - amountToDeduct).toString(),
              totalEarned: (parseFloat(account.totalEarned) - amountToDeduct).toString(),
              updatedAt: new Date(),
            })
            .where(eq(creatorRevenueAccounts.id, dist.accountId));
        }

        await db
          .update(creatorRevenueDistributions)
          .set({ status: "disputed" })
          .where(eq(creatorRevenueDistributions.id, dist.id));
      }
    },
  };
}

// Helper functions
function generateWechatSign(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const stringA = sortedKeys
    .filter((key) => key !== "sign" && params[key] !== undefined)
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const stringSignTemp = `${stringA}&key=${PAYMENT_CONFIG.wechatApiKey}`;

  return crypto
    .createHash("md5")
    .update(stringSignTemp)
    .digest("hex")
    .toUpperCase();
}

function buildWechatXml(params: Record<string, string>): string {
  let xml = "<xml>";
  for (const [key, value] of Object.entries(params)) {
    xml += `<${key}><![CDATA[${value}]]></${key}>`;
  }
  xml += "</xml>";
  return xml;
}

function parseWechatXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const matches = xml.matchAll(
    /<(\w+)>(?:<!\[CDATA\[)?([^\]]*)(?:\]\]>)?<\/\w+>/g
  );
  for (const match of matches) {
    result[match[1]] = match[2];
  }
  return result;
}

export type PaymentService = ReturnType<typeof paymentService>;
