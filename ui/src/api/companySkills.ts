import { api } from "./client";
import type { CompanySkill, CompanySkillFile, CompanySkillUpdateStatus } from "@jigongai/shared";

export const companySkillsApi = {
  list: (companyId: string) =>
    api.get<CompanySkill[]>(`/companies/${companyId}/skills`),

  get: (companyId: string, skillId: string) =>
    api.get<CompanySkill>(`/companies/${companyId}/skills/${skillId}`),

  getUpdateStatus: (companyId: string, skillId: string) =>
    api.get<CompanySkillUpdateStatus>(`/companies/${companyId}/skills/${skillId}/update-status`),

  getFile: (companyId: string, skillId: string, path: string) =>
    api.get<CompanySkillFile>(`/companies/${companyId}/skills/${skillId}/files?path=${encodeURIComponent(path)}`),

  create: (companyId: string, data: {
    key: string;
    slug: string;
    name: string;
    description?: string | null;
    markdown: string;
    sourceType?: string;
    sourceLocator?: string | null;
    sourceRef?: string | null;
    trustLevel?: string;
    metadata?: Record<string, unknown> | null;
  }) =>
    api.post<CompanySkill>(`/companies/${companyId}/skills`, data),

  update: (companyId: string, skillId: string, data: {
    name?: string;
    description?: string | null;
    markdown?: string;
    trustLevel?: string;
    metadata?: Record<string, unknown> | null;
  }) =>
    api.patch<CompanySkill>(`/companies/${companyId}/skills/${skillId}`, data),

  delete: (companyId: string, skillId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/skills/${skillId}`),
};
