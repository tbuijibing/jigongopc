import { api } from "./client";

export interface IssueDependency {
  id: string;
  issueId: string;
  dependsOnIssueId: string;
  dependencyType: "blocks" | "required_by" | "relates_to";
  createdAt: string;
  dependsOnIssue?: { id: string; title: string; identifier?: string; status: string };
}

export interface IssueDependenciesResponse {
  forward: IssueDependency[];
  reverse: IssueDependency[];
}

export const issueDependenciesApi = {
  list: (companyId: string, issueId: string) =>
    api.get<IssueDependenciesResponse>(`/companies/${companyId}/issues/${issueId}/dependencies`),
  create: (
    companyId: string,
    issueId: string,
    data: { dependsOnIssueId: string; dependencyType: string },
  ) =>
    api.post<IssueDependency>(`/companies/${companyId}/issues/${issueId}/dependencies`, data),
  remove: (companyId: string, issueId: string, depId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/issues/${issueId}/dependencies/${depId}`),
};
