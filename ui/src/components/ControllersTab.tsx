import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  humanAgentControlsApi,
  type HumanAgentControl,
  type CreateControlInput,
} from "../api/human-agent-controls";
import { membersApi } from "../api/members";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";

interface ControllersTabProps {
  agentId: string;
  companyId: string;
}

const PERMISSION_KEYS = [
  { key: "canWakeup", labelKey: "agents.detail.controllers.permissionWakeUp" },
  { key: "canPause", labelKey: "agents.detail.controllers.permissionPause" },
  { key: "canTerminate", labelKey: "agents.detail.controllers.permissionTerminate" },
  { key: "canConfigure", labelKey: "agents.detail.controllers.permissionConfigure" },
  { key: "canViewLogs", labelKey: "agents.detail.controllers.permissionViewLogs" },
  { key: "canAssignTasks", labelKey: "agents.detail.controllers.permissionAssignTasks" },
  { key: "canManageMemory", labelKey: "agents.detail.controllers.permissionManageMemory" },
  { key: "canInstallSkills", labelKey: "agents.detail.controllers.permissionInstallSkills" },
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number]["key"];

export function ControllersTab({ agentId, companyId }: ControllersTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({
    canWakeup: false,
    canPause: false,
    canTerminate: false,
    canConfigure: false,
    canViewLogs: false,
    canAssignTasks: false,
    canManageMemory: false,
    canInstallSkills: false,
  });
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: controllers, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.controllers(agentId),
    queryFn: () => humanAgentControlsApi.listForAgent(companyId, agentId),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.members.list(companyId),
    queryFn: () => membersApi.listWithUsers(companyId),
    enabled: showForm,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateControlInput) =>
      humanAgentControlsApi.create(companyId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.controllers(agentId) });
      resetForm();
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("agents.detail.controllers.errorAdd"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ controlId, data }: { controlId: string; data: Partial<HumanAgentControl> }) =>
      humanAgentControlsApi.update(companyId, controlId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.controllers(agentId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("agents.detail.controllers.errorUpdate"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (controlId: string) =>
      humanAgentControlsApi.remove(companyId, controlId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.controllers(agentId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("agents.detail.controllers.errorRemove"));
    },
  });

  function resetForm() {
    setShowForm(false);
    setUserId("");
    setIsPrimary(false);
    setPermissions({
      canWakeup: false,
      canPause: false,
      canTerminate: false,
      canConfigure: false,
      canViewLogs: false,
      canAssignTasks: false,
      canManageMemory: false,
      canInstallSkills: false,
    });
    setActionError(null);
  }

  function handleCreate() {
    if (!userId.trim()) return;
    createMutation.mutate({
      userId: userId.trim(),
      agentId,
      isPrimary,
      permissions,
    });
  }

  // Filter out users who are already controllers
  const availableUsers = members?.filter(
    (member) =>
      member.principalType === "user" &&
      member.status === "active" &&
      !controllers?.some((ctrl) => ctrl.userId === member.principalId)
  ) ?? [];

  function handleTogglePrimary(ctrl: HumanAgentControl) {
    updateMutation.mutate({
      controlId: ctrl.id,
      data: { isPrimary: !ctrl.isPrimary },
    });
  }

  function handleTogglePermission(ctrl: HumanAgentControl, key: PermissionKey) {
    const current = ctrl.permissions[key] ?? false;
    updateMutation.mutate({
      controlId: ctrl.id,
      data: {
        permissions: { ...ctrl.permissions, [key]: !current },
      },
    });
  }

  function handleDelete(ctrl: HumanAgentControl) {
    if (!confirm(t("agents.detail.controllers.confirmRemove", { userId: ctrl.userId === "local-board" ? "Board" : ctrl.userId.slice(0, 12) }))) return;
    deleteMutation.mutate(ctrl.id);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {controllers && controllers.length > 0 ? (
        <div className="space-y-3">
          {controllers.map((ctrl) => (
            <div
              key={ctrl.id}
              className="rounded-lg border border-border p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {ctrl.userId === "local-board" ? "Board" : ctrl.userId.slice(0, 12)}
                  </span>
                  {ctrl.isPrimary && (
                    <Badge variant="default" className="text-[10px]">{t("agents.detail.controllers.primary")}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={ctrl.isPrimary}
                      onCheckedChange={() => handleTogglePrimary(ctrl)}
                      disabled={isMutating}
                      aria-label={t("agents.detail.controllers.togglePrimary")}
                    />
                    <span className="text-[10px] text-muted-foreground">{t("agents.detail.controllers.primary")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(ctrl)}
                    disabled={isMutating}
                    aria-label={`Remove ${ctrl.userId}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PERMISSION_KEYS.map(({ key, labelKey }) => {
                  const enabled = ctrl.permissions[key] ?? false;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        enabled
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                      onClick={() => handleTogglePermission(ctrl, key)}
                      disabled={isMutating}
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("agents.detail.controllers.noControllers")}</p>
      )}

      {!showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t("agents.detail.controllers.addController")}
        </Button>
      )}

      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h3 className="text-sm font-medium">{t("agents.detail.controllers.newController")}</h3>

          <div className="space-y-1.5">
            <Label htmlFor="ctrl-user">{t("agents.detail.controllers.user")}</Label>
            {membersLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("agents.detail.controllers.noAvailableUsers")}</p>
            ) : (
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="ctrl-user">
                  <SelectValue placeholder={t("agents.detail.controllers.selectUser")} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((member) => (
                    <SelectItem key={member.principalId} value={member.principalId}>
                      {member.user?.name || member.user?.email || member.principalId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="ctrl-primary"
              checked={isPrimary}
              onCheckedChange={(v) => setIsPrimary(v === true)}
            />
            <Label htmlFor="ctrl-primary">{t("agents.detail.controllers.primaryController")}</Label>
          </div>

          <div className="space-y-2">
            <Label>{t("agents.detail.controllers.permissions")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSION_KEYS.map(({ key, labelKey }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`perm-${key}`}
                    checked={permissions[key]}
                    onCheckedChange={(v) =>
                      setPermissions((prev) => ({ ...prev, [key]: v === true }))
                    }
                  />
                  <Label htmlFor={`perm-${key}`} className="text-xs">
                    {t(labelKey)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !userId.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("agents.detail.controllers.save")}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              {t("agents.detail.controllers.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
