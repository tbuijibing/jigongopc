import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issueDependenciesApi, type IssueDependency } from "../api/issue-dependencies";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { groupDependencies, type DependencyGroup } from "../lib/dependency-grouping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ChevronDown, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";

interface DependencyPanelProps {
  issueId: string;
}

const DEP_TYPES = [
  { value: "blocks", label: "Blocks" },
  { value: "required_by", label: "Required By" },
  { value: "relates_to", label: "Relates To" },
] as const;

export function DependencyPanel({ issueId }: DependencyPanelProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [depType, setDepType] = useState<string>("blocks");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: deps, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.dependencies(issueId),
    queryFn: () => issueDependenciesApi.list(selectedCompanyId!, issueId),
    enabled: !!selectedCompanyId,
  });

  // Search issues for the add-dependency form
  const { data: allIssues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && showForm,
  });

  const filteredIssues = useMemo(() => {
    if (!allIssues || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allIssues
      .filter(
        (i) =>
          i.id !== issueId &&
          (i.title.toLowerCase().includes(q) ||
            (i.identifier ?? "").toLowerCase().includes(q)),
      )
      .slice(0, 10);
  }, [allIssues, searchQuery, issueId]);

  const grouped = useMemo(() => {
    if (!deps) return { blocks: [], blockedBy: [], related: [] };
    // Combine forward and reverse dependencies into a single array
    const allDeps = [...deps.forward, ...deps.reverse];
    return groupDependencies(allDeps, issueId);
  }, [deps, issueId]);

  const createMutation = useMutation({
    mutationFn: (data: { dependsOnIssueId: string; dependencyType: string }) =>
      issueDependenciesApi.create(selectedCompanyId!, issueId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.dependencies(issueId) });
      setShowForm(false);
      setSearchQuery("");
      setSelectedIssueId(null);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to add dependency";
      setActionError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (depId: string) =>
      issueDependenciesApi.remove(selectedCompanyId!, issueId, depId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.dependencies(issueId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to remove dependency");
    },
  });

  function handleAdd() {
    if (!selectedIssueId) return;
    createMutation.mutate({ dependsOnIssueId: selectedIssueId, dependencyType: depType });
  }

  const isMutating = createMutation.isPending || deleteMutation.isPending;
  const totalCount = deps ? deps.forward.length + deps.reverse.length : 0;

  function renderDepList(label: string, items: IssueDependency[]) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {items.map((dep) => {
          const target = dep.dependsOnIssue;
          return (
            <div
              key={dep.id}
              className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5"
            >
              <Link
                to={`/issues/${target?.identifier ?? dep.dependsOnIssueId}`}
                className="text-xs hover:underline truncate min-w-0"
              >
                {target
                  ? `${target.identifier ?? target.id.slice(0, 8)} — ${target.title}`
                  : dep.dependsOnIssueId.slice(0, 8)}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => deleteMutation.mutate(dep.id)}
                disabled={isMutating}
                aria-label="Remove dependency"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Dependencies{totalCount > 0 ? ` (${totalCount})` : ""}
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

          {!isLoading && deps && (
            <>
              {renderDepList("Blocks", grouped.blocks)}
              {renderDepList("Blocked By", grouped.blockedBy)}
              {renderDepList("Related", grouped.related)}
              {totalCount === 0 && !showForm && (
                <p className="text-xs text-muted-foreground">No dependencies.</p>
              )}
            </>
          )}

          {!showForm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Dependency
            </Button>
          ) : (
            <div className="space-y-3 rounded border border-border p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dependency Type</Label>
                <Select value={depType} onValueChange={setDepType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEP_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Search Issue</Label>
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedIssueId(null);
                  }}
                  placeholder="Type to search issues..."
                  className="h-8 text-xs"
                />
                {filteredIssues.length > 0 && !selectedIssueId && (
                  <div className="max-h-40 overflow-y-auto rounded border border-border divide-y divide-border">
                    {filteredIssues.map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-accent/50 text-left"
                        onClick={() => {
                          setSelectedIssueId(issue.id);
                          setSearchQuery(
                            `${issue.identifier ?? issue.id.slice(0, 8)} — ${issue.title}`,
                          );
                        }}
                      >
                        <span className="font-mono text-muted-foreground shrink-0">
                          {issue.identifier ?? issue.id.slice(0, 8)}
                        </span>
                        <span className="truncate">{issue.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!selectedIssueId || createMutation.isPending}
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
                    setSelectedIssueId(null);
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
