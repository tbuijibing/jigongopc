import { api } from "./client";

export interface IssueWatcher {
  id: string;
  issueId: string;
  watcherType: "agent" | "user";
  watcherId: string;
  createdAt: string;
}

export const issueWatchersApi = {
  list: (companyId: string, issueId: string) =>
    api.get<IssueWatcher[]>(`/companies/${companyId}/issues/${issueId}/watchers`),
  add: (
    companyId: string,
    issueId: string,
    data: { watcherType: string; watcherId: string },
  ) =>
    api.post<IssueWatcher>(`/companies/${companyId}/issues/${issueId}/watchers`, data),
  remove: (companyId: string, issueId: string, watcherId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/issues/${issueId}/watchers/${watcherId}`),
};
