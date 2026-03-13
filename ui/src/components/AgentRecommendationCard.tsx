import { AGENT_ROLE_LABELS, type Agent } from "@Jigongai/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AgentIcon } from "./AgentIconPicker";
import { cn } from "../lib/utils";

export interface AgentRecommendationCardProps {
  agent: Agent;
  isSelected: boolean;
  onToggle: (agentId: string) => void;
  matchedCapabilities: string[];
}

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

export function AgentRecommendationCard({
  agent,
  isSelected,
  onToggle,
  matchedCapabilities,
}: AgentRecommendationCardProps) {
  const roleLabel = roleLabels[agent.role] || agent.role;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border border-border transition-colors cursor-pointer hover:bg-accent/50",
        isSelected && "bg-accent border-primary/40"
      )}
      onClick={() => onToggle(agent.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(agent.id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${agent.name}`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(agent.id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${isSelected ? "Deselect" : "Select"} agent ${agent.name}`}
      />
      
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <AgentIcon icon={agent.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{agent.name}</span>
        </div>
        
        <div className="text-xs text-muted-foreground">
          Role: {roleLabel}
        </div>
        
        {matchedCapabilities.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1" aria-label="Matching capabilities">
            {matchedCapabilities.map((capability) => (
              <Badge
                key={capability}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
                aria-label={`Capability: ${capability}`}
              >
                {capability}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
