import { useState, useMemo, useEffect } from "react";
import type { Agent } from "@Jigongai/shared";
import { useAgentRecommendations } from "../hooks/useAgentRecommendations";
import { AgentRecommendationCard } from "./AgentRecommendationCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, Users } from "lucide-react";
import { cn } from "../lib/utils";

export interface AgentRecommendationsProps {
  companyId: string;
  title: string;
  description: string;
  selectedAgentIds: Set<string>;
  onSelectionChange: (agentIds: Set<string>) => void;
}

export function AgentRecommendations({
  companyId,
  title,
  description,
  selectedAgentIds,
  onSelectionChange,
}: AgentRecommendationsProps) {
  const [open, setOpen] = useState(true);
  const [explicitlyDeselected, setExplicitlyDeselected] = useState<Set<string>>(new Set());

  // Fetch agent recommendations
  const { agents, isLoading, error } = useAgentRecommendations({
    companyId,
    title,
    description,
    enabled: true,
  });

  // Limit to 10 agents
  const displayedAgents = useMemo(() => agents.slice(0, 10), [agents]);

  // Auto-select agents on load and updates
  useEffect(() => {
    if (displayedAgents.length === 0) return;

    const newSelection = new Set(selectedAgentIds);
    let changed = false;

    for (const agent of displayedAgents) {
      if (!explicitlyDeselected.has(agent.id) && !newSelection.has(agent.id)) {
        newSelection.add(agent.id);
        changed = true;
      }
    }

    if (changed) {
      onSelectionChange(newSelection);
    }
  }, [displayedAgents, explicitlyDeselected]);

  // Reset deselection tracking on unmount
  useEffect(() => {
    return () => {
      setExplicitlyDeselected(new Set());
    };
  }, []);

  // Toggle agent selection with deselection tracking
  const handleToggle = (agentId: string) => {
    const newSelection = new Set(selectedAgentIds);
    const newDeselected = new Set(explicitlyDeselected);

    if (newSelection.has(agentId)) {
      // Deselecting — remember this choice
      newSelection.delete(agentId);
      newDeselected.add(agentId);
    } else {
      // Selecting — clear deselection memory
      newSelection.add(agentId);
      newDeselected.delete(agentId);
    }

    setExplicitlyDeselected(newDeselected);
    onSelectionChange(newSelection);
  };

  // Calculate matched capabilities for each agent
  const getMatchedCapabilities = (agent: Agent): string[] => {
    if (!agent.capabilities) return [];
    
    const allCapabilities = [
      ...(agent.capabilities.languages || []),
      ...(agent.capabilities.frameworks || []),
      ...(agent.capabilities.domains || []),
      ...(agent.capabilities.tools || []),
      ...(agent.capabilities.customTags || []),
    ];
    
    return allCapabilities;
  };

  // Don't render if no content to show
  if (!isLoading && displayedAgents.length === 0 && !error) {
    return null;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border border-border bg-accent/20"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent/30 transition-colors">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Recommended Agents
          {displayedAgents.length > 0 && (
            <span className="text-xs">({displayedAgents.length})</span>
          )}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="border-t border-border px-3 py-3">
          {isLoading && (
            <div className="space-y-2" role="status" aria-live="polite" aria-label="Loading agent recommendations">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div 
              className="text-sm text-muted-foreground py-2" 
              role="alert" 
              aria-live="assertive"
            >
              Unable to load recommendations. Check your connection.
            </div>
          )}

          {!isLoading && !error && displayedAgents.length === 0 && (
            <div 
              className="text-sm text-muted-foreground py-2" 
              role="status" 
              aria-live="polite"
            >
              No agents match your task description. Check agent capability
              configurations in the Agents page.
            </div>
          )}

          {!isLoading && !error && displayedAgents.length > 0 && (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-3" role="list" aria-label="Recommended agents">
                {displayedAgents.map((agent) => (
                  <AgentRecommendationCard
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgentIds.has(agent.id)}
                    onToggle={handleToggle}
                    matchedCapabilities={getMatchedCapabilities(agent)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
