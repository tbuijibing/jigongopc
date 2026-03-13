import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentSixDimensionApi,
  type AgentTool,
  type CreateToolInput,
} from "../api/agent-six-dimensions";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Trash2 } from "lucide-react";

interface ToolsTabProps {
  agentId: string;
  companyId: string;
}

const TOOL_TYPES = ["mcp", "api", "shell", "builtin"] as const;

const toolTypeBadgeVariant: Record<AgentTool["toolType"], "default" | "secondary" | "outline"> = {
  mcp: "default",
  api: "secondary",
  shell: "outline",
  builtin: "secondary",
};

const emptyForm: CreateToolInput & { enabled: boolean } = {
  toolType: "mcp",
  name: "",
  description: "",
  config: {},
  enabled: true,
};

export function ToolsTab({ agentId, companyId }: ToolsTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [configText, setConfigText] = useState("{}");
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Queries & Mutations ---
  const { data: tools, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.tools(agentId),
    queryFn: () => agentSixDimensionApi.listTools(companyId, agentId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateToolInput) =>
      agentSixDimensionApi.createTool(companyId, agentId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.tools(agentId) });
      setShowForm(false);
      setForm({ ...emptyForm });
      setConfigText("{}");
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to create tool");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ toolId, data }: { toolId: string; data: Partial<AgentTool> }) =>
      agentSixDimensionApi.updateTool(companyId, agentId, toolId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.tools(agentId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to update tool");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (toolId: string) =>
      agentSixDimensionApi.deleteTool(companyId, agentId, toolId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.tools(agentId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to delete tool");
    },
  });

  // --- Handlers ---
  function handleCreate() {
    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = JSON.parse(configText);
    } catch {
      setActionError("Invalid JSON in config field");
      return;
    }
    createMutation.mutate({
      toolType: form.toolType,
      name: form.name,
      description: form.description || undefined,
      config: parsedConfig,
      enabled: form.enabled,
    });
  }

  function handleToggleEnabled(tool: AgentTool) {
    updateMutation.mutate({ toolId: tool.id, data: { enabled: !tool.enabled } });
  }

  function handleDelete(tool: AgentTool) {
    if (!confirm(`Delete tool "${tool.name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(tool.id);
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

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Error banner */}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Tool list */}
      {tools && tools.length > 0 ? (
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant={toolTypeBadgeVariant[tool.toolType]}>{tool.toolType}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tool.name}</p>
                  {tool.description && (
                    <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  checked={tool.enabled}
                  onCheckedChange={() => handleToggleEnabled(tool)}
                  disabled={isMutating}
                  aria-label={`Toggle ${tool.name}`}
                />
                <span className="text-xs text-muted-foreground w-16">
                  {tool.enabled ? "Enabled" : "Disabled"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(tool)}
                  disabled={isMutating}
                  aria-label={`Delete ${tool.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No tools configured yet.</p>
      )}

      {/* Add tool toggle */}
      {!showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tool
        </Button>
      )}

      {/* Add tool form */}
      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <h3 className="text-sm font-medium">New Tool</h3>

          {/* Tool Type */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-type">Type</Label>
            <Select
              value={form.toolType}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, toolType: v as AgentTool["toolType"] }))
              }
            >
              <SelectTrigger id="tool-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOOL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-name">Name</Label>
            <Input
              id="tool-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. web-search"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-desc">Description</Label>
            <Input
              id="tool-desc"
              value={form.description ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="What does this tool do?"
            />
          </div>

          {/* Config (JSON) */}
          <div className="space-y-1.5">
            <Label htmlFor="tool-config">Config (JSON)</Label>
            <Textarea
              id="tool-config"
              rows={4}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder='{"endpoint": "https://..."}'
              className="font-mono text-xs"
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="tool-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, enabled: v === true }))}
            />
            <Label htmlFor="tool-enabled">Enabled</Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={createMutation.isPending || !form.name.trim()}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setForm({ ...emptyForm });
                setConfigText("{}");
                setActionError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
