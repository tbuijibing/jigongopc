import { api } from "./client";
import type { Routine, RoutineDetail, RoutineTrigger, RoutineRun } from "@jigongai/shared";

export const routinesApi = {
  list: (companyId: string) =>
    api.get<Routine[]>(`/companies/${companyId}/routines`),

  get: (routineId: string) =>
    api.get<RoutineDetail>(`/routines/${routineId}`),

  create: (companyId: string, data: {
    projectId: string;
    goalId?: string | null;
    parentIssueId?: string | null;
    title: string;
    description?: string | null;
    assigneeAgentId: string;
    priority?: string;
    status?: string;
    concurrencyPolicy?: string;
    catchUpPolicy?: string;
  }) =>
    api.post<Routine>(`/companies/${companyId}/routines`, data),

  update: (routineId: string, data: {
    title?: string;
    description?: string | null;
    assigneeAgentId?: string;
    priority?: string;
    status?: string;
    concurrencyPolicy?: string;
    catchUpPolicy?: string;
  }) =>
    api.patch<Routine>(`/routines/${routineId}`, data),

  delete: (routineId: string) =>
    api.delete<{ ok: true }>(`/routines/${routineId}`),

  // Triggers
  createTrigger: (routineId: string, data: {
    kind: string;
    label?: string | null;
    enabled?: boolean;
    cronExpression?: string | null;
    timezone?: string | null;
  }) =>
    api.post<RoutineTrigger>(`/routines/${routineId}/triggers`, data),

  updateTrigger: (routineId: string, triggerId: string, data: {
    label?: string | null;
    enabled?: boolean;
    cronExpression?: string | null;
    timezone?: string | null;
  }) =>
    api.patch<RoutineTrigger>(`/routines/${routineId}/triggers/${triggerId}`, data),

  deleteTrigger: (routineId: string, triggerId: string) =>
    api.delete<{ ok: true }>(`/routines/${routineId}/triggers/${triggerId}`),

  // Manual run
  run: (routineId: string, payload?: Record<string, unknown>) =>
    api.post<RoutineRun>(`/routines/${routineId}/run`, { payload }),
};
