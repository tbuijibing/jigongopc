import { api } from "./client";
import type {
  Plugin,
  PluginConfig,
  PluginState,
  PluginEntity,
  PluginJob,
  PluginLog,
} from "@jigongai/shared";

export const pluginsApi = {
  list: (companyId: string) =>
    api.get<Plugin[]>(`/companies/${companyId}/plugins`),

  get: (pluginId: string) =>
    api.get<Plugin>(`/plugins/${pluginId}`),

  install: (companyId: string, data: {
    name: string;
    slug: string;
    version: string;
    description?: string | null;
    author?: string | null;
    manifest: Record<string, unknown>;
  }) =>
    api.post<Plugin>(`/companies/${companyId}/plugins`, data),

  updateStatus: (pluginId: string, data: {
    status: "inactive" | "active" | "error";
    error?: string;
  }) =>
    api.patch<Plugin>(`/plugins/${pluginId}/status`, data),

  delete: (pluginId: string) =>
    api.delete<{ ok: true }>(`/plugins/${pluginId}`),

  // Config
  getConfig: (pluginId: string) =>
    api.get<PluginConfig[]>(`/plugins/${pluginId}/config`),

  updateConfig: (pluginId: string, data: {
    configKey: string;
    configValue?: Record<string, unknown> | null;
    isSecret?: boolean;
  }) =>
    api.patch<PluginConfig>(`/plugins/${pluginId}/config`, data),

  // State
  getState: (pluginId: string) =>
    api.get<PluginState[]>(`/plugins/${pluginId}/state`),

  updateState: (pluginId: string, data: {
    stateKey: string;
    stateValue?: Record<string, unknown> | null;
  }) =>
    api.patch<PluginState>(`/plugins/${pluginId}/state`, data),

  // Entities
  getEntities: (pluginId: string, entityType?: string) =>
    api.get<PluginEntity[]>(`/plugins/${pluginId}/entities${entityType ? `?entityType=${entityType}` : ""}`),

  createEntity: (pluginId: string, data: {
    entityType: string;
    entityData: Record<string, unknown>;
  }) =>
    api.post<PluginEntity>(`/plugins/${pluginId}/entities`, data),

  updateEntity: (pluginId: string, entityId: string, data: {
    entityData: Record<string, unknown>;
  }) =>
    api.patch<PluginEntity>(`/plugins/${pluginId}/entities/${entityId}`, data),

  deleteEntity: (pluginId: string, entityId: string) =>
    api.delete<{ ok: true }>(`/plugins/${pluginId}/entities/${entityId}`),

  // Jobs
  getJobs: (pluginId: string) =>
    api.get<PluginJob[]>(`/plugins/${pluginId}/jobs`),

  createJob: (pluginId: string, data: {
    jobType: string;
    payload?: Record<string, unknown> | null;
    priority?: number;
    scheduledAt?: string | null;
  }) =>
    api.post<PluginJob>(`/plugins/${pluginId}/jobs`, data),

  updateJob: (pluginId: string, jobId: string, data: {
    jobStatus?: string;
    result?: Record<string, unknown> | null;
    error?: string | null;
  }) =>
    api.patch<PluginJob>(`/plugins/${pluginId}/jobs/${jobId}`, data),

  // Logs
  getLogs: (pluginId: string, limit?: number) =>
    api.get<PluginLog[]>(`/plugins/${pluginId}/logs${limit ? `?limit=${limit}` : ""}`),
};
