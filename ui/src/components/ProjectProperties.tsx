import { useState } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Project } from "@Jigongai/shared";
import { StatusBadge } from "./StatusBadge";
import { cn, formatDate } from "../lib/utils";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { agentsApi } from "../api/agents";
import { projectAgentsApi, type ProjectAgentWithDetails } from "../api/project-agents";
import { workspaceAgentsApi, type WorkspaceAgentWithDetails } from "../api/workspace-agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Github, Plus, Trash2, X, User, Shield } from "lucide-react";
import { ChoosePathButton } from "./PathInstructionsModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PROJECT_STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface ProjectPropertiesProps {
  project: Project;
  onUpdate?: (data: Record<string, unknown>) => void;
}

const REPO_ONLY_CWD_SENTINEL = "/__Jigong_repo_only__";

/**
 * Format GitHub repo URL to a short display name (owner/repo)
 */
function formatGitHubRepo(value: string): string {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return value;
    const owner = segments[0];
    const repo = segments[1]?.replace(/\.git$/i, "");
    if (!owner || !repo) return value;
    return `${owner}/${repo}`;
  } catch {
    return value;
  }
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

function ProjectStatusPicker({ status, onChange }: { status: string; onChange: (status: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const colorClass = statusBadge[status] ?? statusBadgeDefault;

  const PROJECT_STATUSES = [
    { value: "backlog", label: t("projects.newDialog.status.backlog") },
    { value: "planned", label: t("projects.newDialog.status.planned") },
    { value: "in_progress", label: t("projects.newDialog.status.in_progress") },
    { value: "completed", label: t("projects.newDialog.status.completed") },
    { value: "cancelled", label: t("projects.newDialog.status.cancelled") },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer hover:opacity-80 transition-opacity",
            colorClass,
          )}
        >
          {PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status.replace("_", " ")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {PROJECT_STATUSES.map((s) => (
          <Button
            key={s.value}
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-2 text-xs", s.value === status && "bg-accent")}
            onClick={() => {
              onChange(s.value);
              setOpen(false);
            }}
          >
            {s.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ProjectProperties({ project, onUpdate }: ProjectPropertiesProps) {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [goalOpen, setGoalOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"local" | "repo" | null>(null);
  const [workspaceCwd, setWorkspaceCwd] = useState("");
  const [workspaceRepoUrl, setWorkspaceRepoUrl] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const { data: allGoals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const linkedGoalIds = project.goalIds.length > 0
    ? project.goalIds
    : project.goalId
      ? [project.goalId]
      : [];

  const linkedGoals = project.goals.length > 0
    ? project.goals
    : linkedGoalIds.map((id) => ({
        id,
        title: allGoals?.find((g) => g.id === id)?.title ?? id.slice(0, 8),
      }));

  const availableGoals = (allGoals ?? []).filter((g) => !linkedGoalIds.includes(g.id));
  const workspaces = project.workspaces ?? [];

  // Agent bindings
  const { data: agentBindings, isLoading: isLoadingBindings } = useQuery({
    queryKey: queryKeys.projectAgents.list(project.id),
    queryFn: () => projectAgentsApi.listByProject(project.id, selectedCompanyId ?? undefined),
    enabled: !!project.id && !!selectedCompanyId,
  });

  const [addAgentDialogOpen, setAddAgentDialogOpen] = useState(false);

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
    if (selectedCompanyId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId) });
    }
  };

  const createWorkspace = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.createWorkspace(project.id, data),
    onSuccess: () => {
      setWorkspaceCwd("");
      setWorkspaceRepoUrl("");
      setWorkspaceMode(null);
      setWorkspaceError(null);
      invalidateProject();
    },
  });

  const removeWorkspace = useMutation({
    mutationFn: (workspaceId: string) => projectsApi.removeWorkspace(project.id, workspaceId),
    onSuccess: invalidateProject,
  });
  const updateWorkspace = useMutation({
    mutationFn: ({ workspaceId, data }: { workspaceId: string; data: Record<string, unknown> }) =>
      projectsApi.updateWorkspace(project.id, workspaceId, data),
    onSuccess: invalidateProject,
  });

  const removeGoal = (goalId: string) => {
    if (!onUpdate) return;
    onUpdate({ goalIds: linkedGoalIds.filter((id) => id !== goalId) });
  };

  const addGoal = (goalId: string) => {
    if (!onUpdate || linkedGoalIds.includes(goalId)) return;
    onUpdate({ goalIds: [...linkedGoalIds, goalId] });
    setGoalOpen(false);
  };

  const isAbsolutePath = (value: string) => value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);

  const isGitHubRepoUrl = (value: string) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.toLowerCase();
      if (host !== "github.com" && host !== "www.github.com") return false;
      const segments = parsed.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  };

  const deriveWorkspaceNameFromPath = (value: string) => {
    const normalized = value.trim().replace(/[\\/]+$/, "");
    const segments = normalized.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? "Local folder";
  };

  const deriveWorkspaceNameFromRepo = (value: string) => {
    try {
      const parsed = new URL(value);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const repo = segments[segments.length - 1]?.replace(/\.git$/i, "") ?? "";
      return repo || "GitHub repo";
    } catch {
      return "GitHub repo";
    }
  };

  const formatGitHubRepo = (value: string) => {
    try {
      const parsed = new URL(value);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return value;
      const owner = segments[0];
      const repo = segments[1]?.replace(/\.git$/i, "");
      if (!owner || !repo) return value;
      return `${owner}/${repo}`;
    } catch {
      return value;
    }
  };

  const submitLocalWorkspace = () => {
    const cwd = workspaceCwd.trim();
    if (!isAbsolutePath(cwd)) {
      setWorkspaceError(t("projects.properties.localPathError"));
      return;
    }
    setWorkspaceError(null);
    createWorkspace.mutate({
      name: deriveWorkspaceNameFromPath(cwd),
      cwd,
    });
  };

  const submitRepoWorkspace = () => {
    const repoUrl = workspaceRepoUrl.trim();
    if (!isGitHubRepoUrl(repoUrl)) {
      setWorkspaceError(t("projects.properties.repoUrlError"));
      return;
    }
    setWorkspaceError(null);
    createWorkspace.mutate({
      name: deriveWorkspaceNameFromRepo(repoUrl),
      cwd: REPO_ONLY_CWD_SENTINEL,
      repoUrl,
    });
  };

  const clearLocalWorkspace = (workspace: Project["workspaces"][number]) => {
    const confirmed = window.confirm(
      workspace.repoUrl
        ? "Clear local folder from this workspace?"
        : "Delete this workspace local folder?",
    );
    if (!confirmed) return;
    if (workspace.repoUrl) {
      updateWorkspace.mutate({
        workspaceId: workspace.id,
        data: { cwd: null },
      });
      return;
    }
    removeWorkspace.mutate(workspace.id);
  };

  const clearRepoWorkspace = (workspace: Project["workspaces"][number]) => {
    const hasLocalFolder = Boolean(workspace.cwd && workspace.cwd !== REPO_ONLY_CWD_SENTINEL);
    const confirmed = window.confirm(
      hasLocalFolder
        ? "Clear GitHub repo from this workspace?"
        : "Delete this workspace repo?",
    );
    if (!confirmed) return;
    if (hasLocalFolder) {
      updateWorkspace.mutate({
        workspaceId: workspace.id,
        data: { repoUrl: null, repoRef: null },
      });
      return;
    }
    removeWorkspace.mutate(workspace.id);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PropertyRow label={t("projects.properties.status")}>
          {onUpdate ? (
            <ProjectStatusPicker
              status={project.status}
              onChange={(status) => onUpdate({ status })}
            />
          ) : (
            <StatusBadge status={project.status} />
          )}
        </PropertyRow>
        {project.leadAgentId && (
          <PropertyRow label={t("projects.properties.lead")}>
            <span className="text-sm font-mono">{project.leadAgentId.slice(0, 8)}</span>
          </PropertyRow>
        )}
        <div className="py-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t("projects.properties.goals")}</span>
            <div className="flex flex-col items-end gap-1.5">
              {linkedGoals.length === 0 ? (
                <span className="text-sm text-muted-foreground">{t("goals.properties.none")}</span>
              ) : (
                <div className="flex flex-wrap justify-end gap-1.5 max-w-[220px]">
                  {linkedGoals.map((goal) => (
                    <span
                      key={goal.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                    >
                      <Link to={`/goals/${goal.id}`} className="hover:underline max-w-[140px] truncate">
                        {goal.title}
                      </Link>
                      {onUpdate && (
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          type="button"
                          onClick={() => removeGoal(goal.id)}
                          aria-label={`Remove goal ${goal.title}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {onUpdate && (
                <Popover open={goalOpen} onOpenChange={setGoalOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="xs"
                      className="h-6 px-2"
                      disabled={availableGoals.length === 0}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t("projects.properties.goals")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="end">
                    {availableGoals.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        {t("projects.properties.allGoalsLinked")}
                      </div>
                    ) : (
                      availableGoals.map((goal) => (
                        <button
                          key={goal.id}
                          className="flex items-center w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50"
                          onClick={() => addGoal(goal.id)}
                        >
                          {goal.title}
                        </button>
                      ))
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>
        {project.targetDate && (
          <PropertyRow label={t("projects.properties.targetDate")}>
            <span className="text-sm">{formatDate(project.targetDate)}</span>
          </PropertyRow>
        )}
      </div>

      <Separator />

      <div className="space-y-1">
        <div className="py-1.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("projects.properties.workspaces")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                  aria-label="Workspaces help"
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Workspaces give your agents hints about where the work is
              </TooltipContent>
            </Tooltip>
          </div>
          {workspaces.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              {t("projects.properties.noWorkspace")}
            </p>
          ) : (
            <div className="space-y-1">
              {workspaces.map((workspace) => (
                <WorkspaceAgentsSection
                  key={workspace.id}
                  workspace={workspace}
                  companyId={selectedCompanyId ?? undefined}
                />
              ))}
            </div>
          )}
          <div className="flex flex-col items-start gap-2">
            <Button
              variant="outline"
              size="xs"
              className="h-7 px-2.5"
              onClick={() => {
                setWorkspaceMode("local");
                setWorkspaceError(null);
              }}
            >
              {t("projects.properties.addWorkspaceLocal")}
            </Button>
            <Button
              variant="outline"
              size="xs"
              className="h-7 px-2.5"
              onClick={() => {
                setWorkspaceMode("repo");
                setWorkspaceError(null);
              }}
            >
              {t("projects.properties.addWorkspaceRepo")}
            </Button>
          </div>
          {workspaceMode === "local" && (
            <div className="space-y-1.5 rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                  value={workspaceCwd}
                  onChange={(e) => setWorkspaceCwd(e.target.value)}
                  placeholder="/absolute/path/to/workspace"
                />
                <ChoosePathButton />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  className="h-6 px-2"
                  disabled={!workspaceCwd.trim() || createWorkspace.isPending}
                  onClick={submitLocalWorkspace}
                >
                  {t("common.save")}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2"
                  onClick={() => {
                    setWorkspaceMode(null);
                    setWorkspaceCwd("");
                    setWorkspaceError(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
          {workspaceMode === "repo" && (
            <div className="space-y-1.5 rounded-md border border-border p-2">
              <input
                className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
                value={workspaceRepoUrl}
                onChange={(e) => setWorkspaceRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  className="h-6 px-2"
                  disabled={!workspaceRepoUrl.trim() || createWorkspace.isPending}
                  onClick={submitRepoWorkspace}
                >
                  {t("common.save")}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2"
                  onClick={() => {
                    setWorkspaceMode(null);
                    setWorkspaceRepoUrl("");
                    setWorkspaceError(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
          {workspaceError && (
            <p className="text-xs text-destructive">{workspaceError}</p>
          )}
          {createWorkspace.isError && (
            <p className="text-xs text-destructive">{t("projects.properties.failedSaveWorkspace")}</p>
          )}
          {removeWorkspace.isError && (
            <p className="text-xs text-destructive">{t("projects.properties.failedDeleteWorkspace")}</p>
          )}
          {updateWorkspace.isError && (
            <p className="text-xs text-destructive">{t("projects.properties.failedUpdateWorkspace")}</p>
          )}
        </div>

        {/* Agent Bindings Section */}
        <div className="py-1.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{t("projects.properties.agents")}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:text-foreground"
                    aria-label="Agent bindings help"
                  >
                    ?
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Bind agents to this project with specific roles
                </TooltipContent>
              </Tooltip>
            </div>
            <Dialog open={addAgentDialogOpen} onOpenChange={setAddAgentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="xs" className="h-6 px-2">
                  <Plus className="h-3 w-3 mr-1" />
                  {t("projects.properties.addAgent")}
                </Button>
              </DialogTrigger>
              <AddAgentDialog
                projectId={project.id}
                companyId={selectedCompanyId ?? undefined}
                open={addAgentDialogOpen}
                onOpenChange={setAddAgentDialogOpen}
                existingAgentIds={agentBindings?.map((b) => b.agentId) ?? []}
              />
            </Dialog>
          </div>
          {isLoadingBindings ? (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : agentBindings && agentBindings.length > 0 ? (
            <div className="space-y-1">
              {agentBindings.map((binding) => (
                <AgentBindingRow
                  key={binding.id}
                  binding={binding}
                  projectId={project.id}
                  companyId={selectedCompanyId ?? undefined}
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.projectAgents.list(project.id) });
                    invalidateProject();
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              {t("projects.properties.noAgents")}
            </p>
          )}
        </div>

        <Separator />

        <PropertyRow label={t("projects.properties.created")}>
          <span className="text-sm">{formatDate(project.createdAt)}</span>
        </PropertyRow>
        <PropertyRow label={t("projects.properties.updated")}>
          <span className="text-sm">{formatDate(project.updatedAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}

interface AddAgentDialogProps {
  projectId: string;
  companyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAgentIds: string[];
}

function AddAgentDialog({ projectId, companyId, open, onOpenChange, existingAgentIds }: AddAgentDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"lead" | "member" | "observer">("member");

  const { data: allAgents } = useQuery({
    queryKey: queryKeys.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const addBinding = useMutation({
    mutationFn: () => projectAgentsApi.addBinding(projectId, selectedAgentId, selectedRole, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectAgents.list(projectId) });
      setSelectedAgentId("");
      setSelectedRole("member");
      onOpenChange(false);
    },
  });

  const availableAgents = (allAgents ?? []).filter((a) => !existingAgentIds.includes(a.id));

  const handleSubmit = () => {
    if (!selectedAgentId) return;
    addBinding.mutate();
  };

  return (
    <DialogContent className="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{t("projects.properties.addAgent")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("projects.properties.selectAgent")}</label>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue placeholder={t("projects.properties.selectAgentPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {availableAgents.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t("projects.properties.noAvailableAgents")}
                </div>
              ) : (
                availableAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name || agent.id.slice(0, 8)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("projects.properties.role")}</label>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "lead" | "member" | "observer")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">{t("projects.properties.roles.lead")}</SelectItem>
              <SelectItem value="member">{t("projects.properties.roles.member")}</SelectItem>
              <SelectItem value="observer">{t("projects.properties.roles.observer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!selectedAgentId || addBinding.isPending}
          >
            {t("common.save")}
          </Button>
        </div>
        {addBinding.isError && (
          <p className="text-sm text-destructive">{t("projects.properties.failedAddAgent")}</p>
        )}
      </div>
    </DialogContent>
  );
}

interface AgentBindingRowProps {
  binding: ProjectAgentWithDetails;
  projectId: string;
  companyId?: string;
  onUpdate: () => void;
}

function AgentBindingRow({ binding, projectId, companyId, onUpdate }: AgentBindingRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const updateRole = useMutation({
    mutationFn: (role: "lead" | "member" | "observer") =>
      projectAgentsApi.updateRole(projectId, binding.agentId, role, companyId),
    onSuccess: onUpdate,
  });

  const removeBinding = useMutation({
    mutationFn: () => projectAgentsApi.removeBinding(projectId, binding.agentId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectAgents.list(projectId) });
      onUpdate();
    },
  });

  const roleLabels: Record<"lead" | "member" | "observer", string> = {
    lead: t("projects.properties.roles.lead"),
    member: t("projects.properties.roles.member"),
    observer: t("projects.properties.roles.observer"),
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px]">
            {(binding.agentName || binding.agentId.slice(0, 2)).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium truncate block">
            {binding.agentName || binding.agentId.slice(0, 8)}
          </span>
          <span className="text-xs text-muted-foreground truncate block">
            {binding.agentTitle || binding.agentId}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Select
          value={binding.role}
          onValueChange={(v) => updateRole.mutate(v as "lead" | "member" | "observer")}
        >
          <SelectTrigger className="h-7 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">{roleLabels.lead}</SelectItem>
            <SelectItem value="member">{roleLabels.member}</SelectItem>
            <SelectItem value="observer">{roleLabels.observer}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            if (window.confirm(t("projects.properties.confirmRemoveAgent"))) {
              removeBinding.mutate();
            }
          }}
          disabled={removeBinding.isPending}
          aria-label={t("projects.properties.removeAgent")}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface WorkspaceAgentsSectionProps {
  workspace: Project["workspaces"][number];
  companyId?: string;
}

function WorkspaceAgentsSection({ workspace, companyId }: WorkspaceAgentsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: bindings, isLoading } = useQuery({
    queryKey: queryKeys.workspaceAgents.list(workspace.id),
    queryFn: () => workspaceAgentsApi.listByWorkspace(workspace.id, companyId),
    enabled: !!workspace.id && !!companyId,
  });

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const existingAgentIds = (bindings ?? []).map((b) => b.agentId);

  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <div className="space-y-1">
        {workspace.cwd && workspace.cwd !== REPO_ONLY_CWD_SENTINEL ? (
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{workspace.cwd}</span>
          </div>
        ) : null}
        {workspace.repoUrl ? (
          <div className="flex items-center justify-between gap-2 py-1">
            <a
              href={workspace.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <Github className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatGitHubRepo(workspace.repoUrl)}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        ) : null}
      </div>

      <Separator className="my-2" />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{t("projects.properties.agents")}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="h-5 w-5"
          onClick={() => setAddDialogOpen(true)}
          aria-label={t("projects.properties.addAgent")}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">{t("common.loading")}</div>
      ) : bindings && bindings.length > 0 ? (
        <div className="space-y-1">
          {bindings.map((binding) => (
            <WorkspaceAgentBindingRow
              key={binding.id}
              binding={binding}
              workspaceId={workspace.id}
              companyId={companyId}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.workspaceAgents.list(workspace.id) });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{t("projects.properties.noAgents")}</div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <AddWorkspaceAgentDialog
          workspaceId={workspace.id}
          companyId={companyId}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          existingAgentIds={existingAgentIds}
        />
      </Dialog>
    </div>
  );
}

interface AddWorkspaceAgentDialogProps {
  workspaceId: string;
  companyId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAgentIds: string[];
}

function AddWorkspaceAgentDialog({ workspaceId, companyId, open, onOpenChange, existingAgentIds }: AddWorkspaceAgentDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"lead" | "member" | "observer">("member");

  const { data: allAgents } = useQuery({
    queryKey: queryKeys.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId,
  });

  const addBinding = useMutation({
    mutationFn: () => workspaceAgentsApi.addBinding(workspaceId, selectedAgentId, selectedRole, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceAgents.list(workspaceId) });
      setSelectedAgentId("");
      setSelectedRole("member");
      onOpenChange(false);
    },
  });

  const availableAgents = (allAgents ?? []).filter((a) => !existingAgentIds.includes(a.id));

  const handleSubmit = () => {
    if (!selectedAgentId) return;
    addBinding.mutate();
  };

  return (
    <DialogContent className="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{t("projects.properties.addAgent")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("projects.properties.selectAgent")}</label>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue placeholder={t("projects.properties.selectAgentPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {availableAgents.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t("projects.properties.noAvailableAgents")}
                </div>
              ) : (
                availableAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name || agent.id.slice(0, 8)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("projects.properties.role")}</label>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "lead" | "member" | "observer")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">{t("projects.properties.roles.lead")}</SelectItem>
              <SelectItem value="member">{t("projects.properties.roles.member")}</SelectItem>
              <SelectItem value="observer">{t("projects.properties.roles.observer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!selectedAgentId || addBinding.isPending}
          >
            {t("common.save")}
          </Button>
        </div>
        {addBinding.isError && (
          <p className="text-sm text-destructive">{t("projects.properties.failedAddAgent")}</p>
        )}
      </div>
    </DialogContent>
  );
}

interface WorkspaceAgentBindingRowProps {
  binding: WorkspaceAgentWithDetails;
  workspaceId: string;
  companyId?: string;
  onUpdate: () => void;
}

function WorkspaceAgentBindingRow({ binding, workspaceId, companyId, onUpdate }: WorkspaceAgentBindingRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const updateRole = useMutation({
    mutationFn: (role: "lead" | "member" | "observer") =>
      workspaceAgentsApi.updateRole(workspaceId, binding.agentId, role, companyId),
    onSuccess: onUpdate,
  });

  const removeBinding = useMutation({
    mutationFn: () => workspaceAgentsApi.removeBinding(workspaceId, binding.agentId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceAgents.list(workspaceId) });
      onUpdate();
    },
  });

  const roleLabels: Record<"lead" | "member" | "observer", string> = {
    lead: t("projects.properties.roles.lead"),
    member: t("projects.properties.roles.member"),
    observer: t("projects.properties.roles.observer"),
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px]">
            {(binding.agentName || binding.agentId.slice(0, 2)).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium truncate block">
            {binding.agentName || binding.agentId.slice(0, 8)}
          </span>
          <span className="text-xs text-muted-foreground truncate block">
            {binding.agentTitle || binding.agentId}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Select
          value={binding.role}
          onValueChange={(v) => updateRole.mutate(v as "lead" | "member" | "observer")}
        >
          <SelectTrigger className="h-7 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lead">{roleLabels.lead}</SelectItem>
            <SelectItem value="member">{roleLabels.member}</SelectItem>
            <SelectItem value="observer">{roleLabels.observer}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            if (window.confirm(t("projects.properties.confirmRemoveAgent"))) {
              removeBinding.mutate();
            }
          }}
          disabled={removeBinding.isPending}
          aria-label={t("projects.properties.removeAgent")}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
