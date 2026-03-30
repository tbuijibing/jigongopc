export interface Plugin {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  author: string | null;
  manifest: Record<string, unknown>;
  status: "inactive" | "active" | "error";
  error: string | null;
  installedAt: string;
  updatedAt: string;
}

export interface PluginConfig {
  id: string;
  companyId: string;
  pluginId: string;
  configKey: string;
  configValue: Record<string, unknown> | null;
  isSecret: boolean;
  updatedAt: string;
}

export interface PluginState {
  id: string;
  companyId: string;
  pluginId: string;
  stateKey: string;
  stateValue: Record<string, unknown> | null;
  updatedAt: string;
}

export interface PluginEntity {
  id: string;
  companyId: string;
  pluginId: string;
  entityType: string;
  entityData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PluginJob {
  id: string;
  companyId: string;
  pluginId: string;
  jobType: string;
  jobStatus: "pending" | "running" | "completed" | "failed";
  priority: number;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PluginJobRun {
  id: string;
  companyId: string;
  pluginId: string;
  jobId: string;
  runStatus: string;
  log: string | null;
  createdAt: string;
}

export interface PluginWebhookDelivery {
  id: string;
  companyId: string;
  pluginId: string;
  webhookUrl: string;
  event: string;
  payload: Record<string, unknown> | null;
  responseStatus: number | null;
  responseBody: string | null;
  deliveredAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface PluginLog {
  id: string;
  companyId: string;
  pluginId: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  main?: string;
  engines?: {
    paperclip?: string;
  };
  permissions?: string[];
  config?: Record<string, unknown>;
  tools?: Array<{
    name: string;
    description: string;
    handler: string;
  }>;
}
