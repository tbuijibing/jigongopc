import { z } from "zod";

export const installPluginSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  manifest: z.record(z.unknown()),
});

export const updatePluginConfigSchema = z.object({
  configKey: z.string().min(1),
  configValue: z.record(z.unknown()).optional().nullable(),
  isSecret: z.boolean().default(false),
});

export const updatePluginStateSchema = z.object({
  stateKey: z.string().min(1),
  stateValue: z.record(z.unknown()).optional().nullable(),
});

export const createPluginEntitySchema = z.object({
  entityType: z.string().min(1),
  entityData: z.record(z.unknown()),
});

export const updatePluginEntitySchema = z.object({
  entityData: z.record(z.unknown()),
});

export const createPluginJobSchema = z.object({
  jobType: z.string().min(1),
  payload: z.record(z.unknown()).optional().nullable(),
  priority: z.number().int().default(0),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export const updatePluginJobSchema = z.object({
  jobStatus: z.enum(["pending", "running", "completed", "failed"]).optional(),
  result: z.record(z.unknown()).optional().nullable(),
  error: z.string().optional().nullable(),
});

export const deliverPluginWebhookSchema = z.object({
  webhookUrl: z.string().url(),
  event: z.string().min(1),
  payload: z.record(z.unknown()),
});
