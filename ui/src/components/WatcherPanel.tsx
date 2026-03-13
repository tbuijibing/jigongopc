import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issueWatchersApi, type IssueWatcher } from "../api/issue-watchers";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { useAgentRecommendations } from "../hooks/useAgentRecommendations";
import type { Agent } from "@Jigongai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "../lib/utils";
import { extractKeywords } from "../lib/keywordExtractor";
import { ChevronDown, Eye, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { AgentRecommendationCard } from "./AgentRecommendationCard";

type RecommendationMode = 'idle' | 'loading' | 'selecting' | 'adding';

interface WatcherPanelProps {
  issueId: string;
}

export function WatcherPanel({ issueId }: WatcherPanelProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [watcherType, setWatcherType] = useState<string>("agent");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWatcherId, setSelectedWatcherId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Refresh recommendations state
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>('idle');
  const [issueForRecommendation, setIssueForRecommendation] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [selectedForAdd, setSelectedForAdd] = useState<Set<string>>(new Set());

  const { data: watchers, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.watchers(issueId),
    queryFn: () => issueWatchersApi.list(selectedCompanyId!, issueId),
    enabled: !!selectedCompanyId,
  });

  // Fetch issue details for keyword extraction
  const { data: issue } = useQuery({
    queryKey: queryKeys.issues.detail(issueId),
    queryFn: () => issuesApi.get(issueId),
    enabled: !!selectedCompanyId,
  });

  // Use issue's companyId for company-scoped operations
  const issueCompanyId = issue?.companyId ?? selectedCompanyId;

  // Fetch recommendations when in recommendation mode
  const { agents: recommendedAgents, isLoading: isLoadingRecs } = useAgentRecommendations({
    companyId: issueCompanyId!,
    title: issueForRecommendation?.title ?? '',
    description: issueForRecommendation?.description ?? '',
    enabled: recommendationMode === 'loading' && !!issueCompanyId,
  });

  // Filter out existing watchers from recommendations
  const filteredRecommendations = useMemo(() => {
    if (!recommendedAgents || !watchers) return [];
    
    const watcherAgentIds = new Set(
      watchers
        .filter(w => w.watcherType === 'agent')
        .map(w => w.watcherId)
    );
    
    return recommendedAgents.filter(agent => !watcherAgentIds.has(agent.id));
  }, [recommendedAgents, watchers]);

  // Transition to 'selecting' mode when recommendations finish loading
  useEffect(() => {
    if (recommendationMode === 'loading' && !isLoadingRecs) {
      setRecommendationMode('selecting');
    }
  }, [recommendationMode, isLoadingRecs]);

  // Load agents for name resolution and search
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && showForm,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(a.id, a.name);
    return map;
  }, [agents]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    if (watcherType === "agent") {
      return (agents ?? [])
        .filter((a) => a.name.toLowerCase().includes(q) && a.status !== "terminated")
        .slice(0, 10)
        .map((a) => ({ id: a.id, label: a.name }));
    }
    // For user type, allow free-text user ID entry
    return [];
  }, [agents, searchQuery, watcherType]);

  const createMutation = useMutation({
    mutationFn: (data: { watcherType: string; watcherId: string }) =>
      issueWatchersApi.add(selectedCompanyId!, issueId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.watchers(issueId) });
      setShowForm(false);
      setSearchQuery("");
      setSelectedWatcherId(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to add watcher");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (watcherId: string) =>
      issueWatchersApi.remove(selectedCompanyId!, issueId, watcherId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.watchers(issueId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to remove watcher");
    },
  });

  function handleAdd() {
    const id = selectedWatcherId || (watcherType === "user" ? searchQuery.trim() : null);
    if (!id) return;
    createMutation.mutate({ watcherType, watcherId: id });
  }

  function handleRefreshRecommendations() {
    if (!issue) return;
    
    // Verify company context
    if (!issueCompanyId) {
      setActionError('Unable to load recommendations: company context not available.');
      return;
    }
    
    // Verify company match
    if (selectedCompanyId && issue.companyId !== selectedCompanyId) {
      setActionError('Unable to load recommendations: issue belongs to a different company.');
      return;
    }
    
    // Extract keywords from issue
    const keywords = extractKeywords(`${issue.title} ${issue.description || ''}`);
    
    if (keywords.length === 0) {
      setActionError('Issue content is too short for recommendations. Add more details to the title or description.');
      return;
    }
    
    setIssueForRecommendation({
      title: issue.title,
      description: issue.description || '',
    });
    setRecommendationMode('loading');
  }

  async function handleAddSelected() {
    if (selectedForAdd.size === 0) return;
    if (!issueCompanyId) {
      setActionError('Unable to add watchers: company context not available.');
      return;
    }

    setRecommendationMode('adding');
    const errors: string[] = [];

    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
      Array.from(selectedForAdd).map(agentId =>
        issueWatchersApi.add(issueCompanyId, issueId, {
          watcherType: 'agent',
          watcherId: agentId,
        })
      )
    );

    // Track which agents failed
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const agentId = Array.from(selectedForAdd)[index];
        const agentName = agents?.find(a => a.id === agentId)?.name ?? agentId;
        errors.push(agentName);
      }
    });

    if (errors.length > 0) {
      setActionError(`Failed to add: ${errors.join(', ')}`);
    }

    // Refresh watchers and reset state
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.watchers(issueId) });
    setRecommendationMode('idle');
    setSelectedForAdd(new Set());
    setIssueForRecommendation(null);
  }

  function handleCancelRecommendations() {
    setRecommendationMode('idle');
    setSelectedForAdd(new Set());
    setIssueForRecommendation(null);
    setActionError(null);
  }


  // Calculate matched capabilities for each agent
  function getMatchedCapabilities(agent: Agent): string[] {
    if (!agent.capabilities) return [];
    
    const allCapabilities = [
      ...(agent.capabilities.languages || []),
      ...(agent.capabilities.frameworks || []),
      ...(agent.capabilities.domains || []),
      ...(agent.capabilities.tools || []),
      ...(agent.capabilities.customTags || []),
    ];
    
    return allCapabilities;
  }

  function watcherName(w: IssueWatcher): string {
    if (w.watcherType === "agent") {
      return agentMap.get(w.watcherId) || w.watcherId.slice(0, 8);
    }
    return w.watcherId === "local-board" ? "Board" : w.watcherId.slice(0, 8);
  }

  const isMutating = createMutation.isPending || deleteMutation.isPending;
  const totalCount = (watchers ?? []).length;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Watchers{totalCount > 0 ? ` (${totalCount})` : ""}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border px-3 py-3 space-y-3">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error.message}</p>}
          {actionError && <p className="text-xs text-destructive">{actionError}</p>}

          {!isLoading && watchers && (
            <>
              {watchers.length > 0 ? (
                <div className="space-y-1">
                  {watchers.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {w.watcherType}
                        </Badge>
                        <span className="text-xs truncate">{watcherName(w)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => deleteMutation.mutate(w.id)}
                        disabled={isMutating}
                        aria-label="Remove watcher"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                !showForm && (
                  <p className="text-xs text-muted-foreground">No watchers.</p>
                )
              )}
            </>
          )}

          {!showForm ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(true)}
                  disabled={recommendationMode !== 'idle'}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Watcher
                </Button>
                {recommendationMode === 'idle' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshRecommendations}
                    aria-label="Refresh agent recommendations for this issue"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh Recommendations
                  </Button>
                )}
              </div>

              {/* Recommendation interface */}
              {recommendationMode !== 'idle' && (
                <div className="space-y-3 rounded border border-border p-3">
                  {recommendationMode === 'loading' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading recommendations...
                    </div>
                  )}
                  
                  {recommendationMode === 'selecting' && (
                    <>
                      {filteredRecommendations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          All relevant agents are already watching this issue.
                        </p>
                      ) : (
                        <ScrollArea className="max-h-[300px]">
                          <div className="space-y-2 pr-3">
                            {filteredRecommendations.map(agent => (
                              <AgentRecommendationCard
                                key={agent.id}
                                agent={agent}
                                isSelected={selectedForAdd.has(agent.id)}
                                onToggle={(id) => {
                                  const newSelection = new Set(selectedForAdd);
                                  if (newSelection.has(id)) {
                                    newSelection.delete(id);
                                  } else {
                                    newSelection.add(id);
                                  }
                                  setSelectedForAdd(newSelection);
                                }}
                                matchedCapabilities={getMatchedCapabilities(agent)}
                              />
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddSelected}
                          disabled={selectedForAdd.size === 0}
                        >
                          Add Selected ({selectedForAdd.size})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelRecommendations}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  )}
                  
                  {recommendationMode === 'adding' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding watchers...
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 rounded border border-border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Watcher Type</Label>
                <Select
                  value={watcherType}
                  onValueChange={(v) => {
                    setWatcherType(v);
                    setSearchQuery("");
                    setSelectedWatcherId(null);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  {watcherType === "agent" ? "Search Agent" : "User ID"}
                </Label>
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedWatcherId(null);
                  }}
                  placeholder={
                    watcherType === "agent"
                      ? "Type to search agents..."
                      : "Enter user ID..."
                  }
                  className="h-8 text-xs"
                />
                {filteredOptions.length > 0 && !selectedWatcherId && (
                  <div className="max-h-40 overflow-y-auto rounded border border-border divide-y divide-border">
                    {filteredOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-accent/50 text-left"
                        onClick={() => {
                          setSelectedWatcherId(opt.id);
                          setSearchQuery(opt.label);
                        }}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={
                    (!selectedWatcherId && !(watcherType === "user" && searchQuery.trim())) ||
                    createMutation.isPending
                  }
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  )}
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setSearchQuery("");
                    setSelectedWatcherId(null);
                    setActionError(null);
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
