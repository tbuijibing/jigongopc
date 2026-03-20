import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentSixDimensionApi,
  type AgentMemory,
  type CreateMemoryInput,
} from "../api/agent-six-dimensions";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Pencil, X } from "lucide-react";

interface MemoryTabProps {
  agentId: string;
  companyId: string;
}

const MEMORY_LAYERS = ["agent", "project", "task"] as const;
const MEMORY_TYPES = ["fact", "preference", "learning", "context"] as const;
type MemoryLayerFilter = "all" | "agent" | "project" | "task";

const layerBadgeVariant: Record<AgentMemory["memoryLayer"], "default" | "secondary" | "outline"> = {
  agent: "default",
  project: "secondary",
  task: "outline",
};

const emptyForm: CreateMemoryInput = {
  key: "",
  value: "",
  memoryLayer: "agent",
  scopeId: undefined,
  memoryType: "fact",
  importance: 5,
  expiresAt: null,
};

interface EditState {
  memoryId: string;
  value: string;
  importance: number;
  expiresAt: string;
}

function truncateValue(value: string, maxLen = 80): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + "…";
}

export function MemoryTab({ agentId, companyId }: MemoryTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [layerFilter, setLayerFilter] = useState<MemoryLayerFilter>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateMemoryInput>({ ...emptyForm });
  const [expiresAtText, setExpiresAtText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  // --- Queries & Mutations ---
  const filterLayer = layerFilter === "all" ? undefined : layerFilter;
  const { data: memories, isLoading, error } = useQuery({
    queryKey: [...queryKeys.agents.memories(agentId), filterLayer],
    queryFn: () => agentSixDimensionApi.listMemories(companyId, agentId, filterLayer),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMemoryInput) =>
      agentSixDimensionApi.createMemory(companyId, agentId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.memories(agentId) });
      setShowForm(false);
      setForm({ ...emptyForm });
      setExpiresAtText("");
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("agents.detail.memory.errorCreate"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ memoryId, data }: { memoryId: string; data: Partial<AgentMemory> }) =>
      agentSixDimensionApi.updateMemory(companyId, agentId, memoryId, data),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.memories(agentId) });
      setEditState(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("agents.detail.memory.errorUpdate"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (memoryId: string) =>
      agentSixDimensionApi.deleteMemory(companyId, agentId, memoryId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.memories(agentId) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : t("agents.detail.memory.errorDelete"));
    },
  });

  // --- Handlers ---
  function handleCreate() {
    const data: CreateMemoryInput = {
      key: form.key,
      value: form.value,
      memoryLayer: form.memoryLayer,
      memoryType: form.memoryType,
      importance: form.importance,
      expiresAt: expiresAtText ? new Date(expiresAtText).toISOString() : null,
    };
    if (form.memoryLayer !== "agent" && form.scopeId) {
      data.scopeId = form.scopeId;
    }
    createMutation.mutate(data);
  }

  function handleDelete(memory: AgentMemory) {
    if (!confirm(t("agents.detail.memory.confirmDelete", { memoryKey: memory.key }))) return;
    deleteMutation.mutate(memory.id);
  }

  function handleStartEdit(memory: AgentMemory) {
    setEditState({
      memoryId: memory.id,
      value: memory.value,
      importance: memory.importance,
      expiresAt: memory.expiresAt ? memory.expiresAt.slice(0, 16) : "",
    });
  }

  function handleSaveEdit() {
    if (!editState) return;
    updateMutation.mutate({
      memoryId: editState.memoryId,
      data: {
        value: editState.value,
        importance: editState.importance,
        expiresAt: editState.expiresAt ? new Date(editState.expiresAt).toISOString() : null,
      },
    });
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

      {/* Layer filter */}
      <div className="flex items-center gap-3">
        <Label htmlFor="memory-layer-filter">{t("agents.detail.memory.filterByLayer")}</Label>
        <Select
          value={layerFilter}
          onValueChange={(v) => setLayerFilter(v as MemoryLayerFilter)}
        >
          <SelectTrigger id="memory-layer-filter" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("agents.detail.memory.filterAll")}</SelectItem>
            {MEMORY_LAYERS.map((l) => (
              <SelectItem key={l} value={l}>{t(`agents.detail.memory.layer${l.charAt(0).toUpperCase() + l.slice(1)}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Memory list */}
      {memories && memories.length > 0 ? (
        <div className="space-y-2">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="rounded-lg border border-border p-3 space-y-2"
            >
              {editState?.memoryId === memory.id ? (
                /* Inline edit form */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>{t("agents.detail.memory.value")}</Label>
                    <Textarea
                      rows={3}
                      value={editState.value}
                      onChange={(e) => setEditState((s) => s ? { ...s, value: e.target.value } : s)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-1.5 flex-1">
                      <Label>{t("agents.detail.memory.importance")}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={editState.importance}
                        onChange={(e) =>
                          setEditState((s) => s ? { ...s, importance: Number(e.target.value) } : s)
                        }
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <Label>{t("agents.detail.memory.expiresAt")}</Label>
                      <Input
                        type="datetime-local"
                        value={editState.expiresAt}
                        onChange={(e) =>
                          setEditState((s) => s ? { ...s, expiresAt: e.target.value } : s)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("agents.detail.memory.save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditState(null)}>
                      {t("agents.detail.memory.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={layerBadgeVariant[memory.memoryLayer]}>
                        {t(`agents.detail.memory.layer_${memory.memoryLayer}`)}
                      </Badge>
                      <Badge variant="outline">
                        {t(`agents.detail.memory.type_${memory.memoryType}`)}
                      </Badge>
                      <p className="text-sm font-medium truncate">{memory.key}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(memory)}
                        disabled={isMutating}
                        aria-label={`Edit ${memory.key}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(memory)}
                        disabled={isMutating}
                        aria-label={`Delete ${memory.key}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{truncateValue(memory.value)}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{t("agents.detail.memory.importance")}: {memory.importance}</span>
                    <span>{t("agents.detail.memory.accessCount")}: {memory.accessCount}</span>
                    {memory.expiresAt && <span>{t("agents.detail.memory.expires")}: {new Date(memory.expiresAt).toLocaleString()}</span>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("agents.detail.memory.noMemories")}</p>
      )}

      {/* Add memory toggle */}
      {!showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t("agents.detail.memory.addMemory")}
        </Button>
      )}

      {/* Add memory form */}
      {showForm && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t("agents.detail.memory.newMemory")}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowForm(false);
                setForm({ ...emptyForm });
                setExpiresAtText("");
                setActionError(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Key */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-key">{t("agents.detail.memory.key")}</Label>
            <Input
              id="mem-key"
              value={form.key}
              onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
              placeholder={t("agents.detail.memory.keyHelp")}
            />
          </div>

          {/* Value */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-value">{t("agents.detail.memory.value")}</Label>
            <Textarea
              id="mem-value"
              rows={3}
              value={form.value}
              onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
              placeholder={t("agents.detail.memory.valueHelp")}
            />
          </div>

          {/* Memory Layer */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-layer">{t("agents.detail.memory.layer")}</Label>
            <Select
              value={form.memoryLayer}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, memoryLayer: v as AgentMemory["memoryLayer"] }))
              }
            >
              <SelectTrigger id="mem-layer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMORY_LAYERS.map((l) => (
                  <SelectItem key={l} value={l}>{t(`agents.detail.memory.layer${l.charAt(0).toUpperCase() + l.slice(1)}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scope ID — only for project/task layers */}
          {(form.memoryLayer === "project" || form.memoryLayer === "task") && (
            <div className="space-y-1.5">
              <Label htmlFor="mem-scope">{t("agents.detail.memory.scopeId")}</Label>
              <Input
                id="mem-scope"
                value={form.scopeId ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, scopeId: e.target.value }))}
                placeholder={`${form.memoryLayer} ID`}
              />
            </div>
          )}

          {/* Memory Type */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-type">{t("agents.detail.memory.type")}</Label>
            <Select
              value={form.memoryType ?? "fact"}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, memoryType: v as AgentMemory["memoryType"] }))
              }
            >
              <SelectTrigger id="mem-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEMORY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`agents.detail.memory.type${type.charAt(0).toUpperCase() + type.slice(1)}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Importance */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-importance">{t("agents.detail.memory.importance")}</Label>
            <Input
              id="mem-importance"
              type="number"
              min={1}
              max={10}
              value={form.importance ?? 5}
              onChange={(e) => setForm((prev) => ({ ...prev, importance: Number(e.target.value) }))}
            />
          </div>

          {/* Expires At */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-expires">{t("agents.detail.memory.expiresAt")}</Label>
            <Input
              id="mem-expires"
              type="datetime-local"
              value={expiresAtText}
              onChange={(e) => setExpiresAtText(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !form.key.trim() || !form.value.trim()}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("agents.detail.memory.save")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setForm({ ...emptyForm });
                setExpiresAtText("");
                setActionError(null);
              }}
            >
              {t("agents.detail.memory.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
