import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentSixDimensionApi, type HeartbeatConfig } from "../api/agent-six-dimensions";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface HeartbeatTabProps {
  agentId: string;
  companyId: string;
}

type FormState = {
  enabled: boolean;
  intervalSec: number;
  wakeOnAssignment: boolean;
  wakeOnMention: boolean;
  wakeOnDemand: boolean;
  maxConcurrentRuns: number;
  timeoutSec: number;
  cooldownSec: number;
};

function configToForm(c: HeartbeatConfig): FormState {
  return {
    enabled: c.enabled,
    intervalSec: c.intervalSec,
    wakeOnAssignment: c.wakeOnAssignment,
    wakeOnMention: c.wakeOnMention,
    wakeOnDemand: c.wakeOnDemand,
    maxConcurrentRuns: c.maxConcurrentRuns,
    timeoutSec: c.timeoutSec,
    cooldownSec: c.cooldownSec,
  };
}

export function HeartbeatTab({ agentId, companyId }: HeartbeatTabProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: config, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.heartbeatConfig(agentId),
    queryFn: () => agentSixDimensionApi.getHeartbeatConfig(companyId, agentId),
  });

  // Seed form state when data arrives (only if form hasn't been touched yet)
  useEffect(() => {
    if (config && !form) {
      setForm(configToForm(config));
    }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: Partial<HeartbeatConfig>) =>
      agentSixDimensionApi.updateHeartbeatConfig(companyId, agentId, data),
    onSuccess: () => {
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.heartbeatConfig(agentId) });
      // Reset form to track new server state on next fetch
      setForm(null);
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Failed to save heartbeat config");
    },
  });

  function handleSave() {
    if (!form) return;
    mutation.mutate(form);
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
    <div className="space-y-6 max-w-xl">
      {/* Enabled toggle */}
      <div className="flex items-center gap-3">
        <Checkbox
          id="hb-enabled"
          checked={form.enabled}
          onCheckedChange={(v) => setField("enabled", v === true)}
        />
        <Label htmlFor="hb-enabled">Enabled</Label>
      </div>

      {/* Numeric fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hb-interval">Interval (sec)</Label>
          <Input
            id="hb-interval"
            type="number"
            min={1}
            value={form.intervalSec}
            onChange={(e) => setField("intervalSec", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hb-maxConcurrent">Max Concurrent Runs</Label>
          <Input
            id="hb-maxConcurrent"
            type="number"
            min={1}
            value={form.maxConcurrentRuns}
            onChange={(e) => setField("maxConcurrentRuns", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hb-timeout">Timeout (sec)</Label>
          <Input
            id="hb-timeout"
            type="number"
            min={0}
            value={form.timeoutSec}
            onChange={(e) => setField("timeoutSec", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hb-cooldown">Cooldown (sec)</Label>
          <Input
            id="hb-cooldown"
            type="number"
            min={0}
            value={form.cooldownSec}
            onChange={(e) => setField("cooldownSec", Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Wake triggers */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Wake Triggers</legend>
        <div className="flex items-center gap-3">
          <Checkbox
            id="hb-wakeAssign"
            checked={form.wakeOnAssignment}
            onCheckedChange={(v) => setField("wakeOnAssignment", v === true)}
          />
          <Label htmlFor="hb-wakeAssign">Wake on Assignment</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="hb-wakeMention"
            checked={form.wakeOnMention}
            onCheckedChange={(v) => setField("wakeOnMention", v === true)}
          />
          <Label htmlFor="hb-wakeMention">Wake on Mention</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            id="hb-wakeDemand"
            checked={form.wakeOnDemand}
            onCheckedChange={(v) => setField("wakeOnDemand", v === true)}
          />
          <Label htmlFor="hb-wakeDemand">Wake on Demand</Label>
        </div>
      </fieldset>

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
