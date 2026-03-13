import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentSixDimensionApi,
  type AgentSkill,
  type SkillRegistryEntry,
} from "../api/agent-six-dimensions";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";

interface SkillsTabProps {
  agentId: string;
  companyId: string;
}

export function SkillsTab({ agentId, companyId }: SkillsTabProps) {
  const queryClient = useQueryClient();
  const [storeOpen, setStoreOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Queries ---
  const { data: skills, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.skills(agentId),
    queryFn: () => agentSixDimensionApi.listSkills(companyId, agentId),
  });

  const { data: storeSkills, isLoading: storeLoading } = useQuery({
    queryKey: queryKeys.skillStore(companyId),
    queryFn: () => agentSixDimensionApi.listSkillStore(companyId),
    enabled: storeOpen,
  });

  // --- Mutations ---
  const installMutation = useMutation({
    mutationFn: (skillId: string) =>
      agentSixDimensionApi.installSkill(companyId, agentId, { skillId }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.skills(agentId) });
      setStoreOpen(false);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to install skill");
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (skillId: string) =>
      agentSixDimensionApi.uninstallSkill(companyId, agentId, skillId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.skills(agentId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to uninstall skill");
    },
  });

  // --- Handlers ---
  function handleUninstall(skill: AgentSkill) {
    if (!confirm(`Uninstall skill "${skill.name ?? skill.skillId}"? This cannot be undone.`)) return;
    uninstallMutation.mutate(skill.id);
  }

  function handleInstall(entry: SkillRegistryEntry) {
    installMutation.mutate(entry.id);
  }

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // --- Error loading ---
  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const isMutating = installMutation.isPending || uninstallMutation.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Error banner */}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Installed skills list */}
      {skills && skills.length > 0 ? (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary">{skill.category ?? "general"}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{skill.name ?? skill.skillId}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {skill.installType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={skill.enabled ? "default" : "outline"}>
                  {skill.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUninstall(skill)}
                  disabled={isMutating}
                  aria-label={`Uninstall ${skill.name ?? skill.skillId}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No skills installed yet.</p>
      )}

      {/* Install Skill button */}
      <Button variant="outline" size="sm" onClick={() => setStoreOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Install Skill
      </Button>

      {/* Skill Store Dialog */}
      <Dialog open={storeOpen} onOpenChange={setStoreOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skill Store</DialogTitle>
            <DialogDescription>Browse and install skills for this agent.</DialogDescription>
          </DialogHeader>

          {storeLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : storeSkills && storeSkills.length > 0 ? (
            <div className="space-y-3">
              {storeSkills.map((entry) => {
                const alreadyInstalled = skills?.some((s) => s.skillId === entry.id);
                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{entry.name}</p>
                        <Badge variant="secondary">{entry.category}</Badge>
                      </div>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {entry.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInstall(entry)}
                      disabled={installMutation.isPending || !!alreadyInstalled}
                    >
                      {installMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : alreadyInstalled ? (
                        "Installed"
                      ) : (
                        "Install"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No skills available in the store.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
