import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentSixDimensionApi, type Soul } from "../api/agent-six-dimensions";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface SoulTabProps {
  agentId: string;
  companyId: string;
}

type FormState = {
  systemPrompt: string;
  personality: string;
  constraints: string;
  outputFormat: string;
  language: string;
};

function soulToForm(s: Soul): FormState {
  return {
    systemPrompt: s.systemPrompt ?? "",
    personality: s.personality ?? "",
    constraints: s.constraints ?? "",
    outputFormat: s.outputFormat ?? "",
    language: s.language ?? "",
  };
}

export function SoulTab({ agentId, companyId }: SoulTabProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: soul, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.soul(agentId),
    queryFn: () => agentSixDimensionApi.getSoul(companyId, agentId),
  });

  // Seed form state when data arrives (only if form hasn't been touched yet)
  useEffect(() => {
    if (soul && !form) {
      setForm(soulToForm(soul));
    }
  }, [soul]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: Partial<Soul>) =>
      agentSixDimensionApi.updateSoul(companyId, agentId, data),
    onSuccess: () => {
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.soul(agentId) });
      // Reset form to track new server state on next fetch
      setForm(null);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Failed to save soul");
    },
  });

  function handleSave() {
    if (!form) return;
    mutation.mutate({
      systemPrompt: form.systemPrompt,
      personality: form.personality || null,
      constraints: form.constraints || null,
      outputFormat: form.outputFormat || null,
      language: form.language,
    });
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  // Error loading
  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!form) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Version display (read-only) */}
      {soul && (
        <p className="text-sm text-muted-foreground">
          Version: <span className="font-medium text-foreground">{soul.version}</span>
        </p>
      )}

      {/* System Prompt */}
      <div className="space-y-1.5">
        <Label htmlFor="soul-systemPrompt">System Prompt</Label>
        <Textarea
          id="soul-systemPrompt"
          rows={8}
          value={form.systemPrompt}
          onChange={(e) => setField("systemPrompt", e.target.value)}
          placeholder="Enter the system prompt for this agent..."
        />
      </div>

      {/* Personality */}
      <div className="space-y-1.5">
        <Label htmlFor="soul-personality">Personality</Label>
        <Textarea
          id="soul-personality"
          rows={3}
          value={form.personality}
          onChange={(e) => setField("personality", e.target.value)}
          placeholder="Describe the agent's personality traits..."
        />
      </div>

      {/* Constraints */}
      <div className="space-y-1.5">
        <Label htmlFor="soul-constraints">Constraints</Label>
        <Textarea
          id="soul-constraints"
          rows={3}
          value={form.constraints}
          onChange={(e) => setField("constraints", e.target.value)}
          placeholder="Define behavioral constraints..."
        />
      </div>

      {/* Output Format */}
      <div className="space-y-1.5">
        <Label htmlFor="soul-outputFormat">Output Format</Label>
        <Textarea
          id="soul-outputFormat"
          rows={3}
          value={form.outputFormat}
          onChange={(e) => setField("outputFormat", e.target.value)}
          placeholder="Specify preferred output format..."
        />
      </div>

      {/* Language */}
      <div className="space-y-1.5">
        <Label htmlFor="soul-language">Language</Label>
        <Input
          id="soul-language"
          value={form.language}
          onChange={(e) => setField("language", e.target.value)}
          placeholder="e.g. en, zh, ja"
        />
      </div>

      {/* Error message */}
      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      {/* Save button */}
      <Button onClick={handleSave} disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save
      </Button>
    </div>
  );
}
