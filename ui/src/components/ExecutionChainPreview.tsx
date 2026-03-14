import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Network, ChevronRight, Bot, UserCircle } from "lucide-react";
import { agentsApi, type OrgNode } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { AgentIcon } from "./AgentIconPicker";
import { StatusBadge } from "./StatusBadge";
import type { Agent } from "@Jigongai/shared";

interface ExecutionChainPreviewProps {
  assigneeId: string | null;
  className?: string;
}

interface ChainNode {
  agent: Agent;
  level: number;
  isLeaf: boolean;
}

export function ExecutionChainPreview({ assigneeId, className }: ExecutionChainPreviewProps) {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();

  const { data: orgTree } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  // Build parent-child relationships from org tree
  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    function walk(node: OrgNode) {
      for (const child of node.reports) {
        map.set(child.id, node.id);
        walk(child);
      }
    }
    for (const root of orgTree ?? []) {
      walk(root);
    }
    return map;
  }, [orgTree]);

  // Build execution chain from assignee up to root
  const executionChain = useMemo((): ChainNode[] => {
    if (!assigneeId) return [];
    const chain: ChainNode[] = [];
    let currentId: string | null = assigneeId;
    let level = 0;

    while (currentId) {
      const agent = agentMap.get(currentId);
      if (!agent) break;
      chain.unshift({ agent, level, isLeaf: level === 0 });
      currentId = parentMap.get(currentId) ?? null;
      level++;
    }

    return chain;
  }, [assigneeId, agentMap, parentMap]);

  if (!assigneeId) {
    return (
      <div className={cn("p-4 border border-border rounded-lg bg-muted/20", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Network className="h-4 w-4" />
          <span className="text-sm">{t("executionChain.noAssignee")}</span>
        </div>
      </div>
    );
  }

  if (executionChain.length === 0) {
    return (
      <div className={cn("p-4 border border-border rounded-lg bg-muted/20", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Network className="h-4 w-4" />
          <span className="text-sm">{t("executionChain.loading")}</span>
        </div>
      </div>
    );
  }

  const leafAgent = executionChain[executionChain.length - 1]?.agent;
  const capabilities = leafAgent?.capabilities;

  return (
    <div className={cn("border border-border rounded-lg bg-card", className)}>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("executionChain.title")}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Execution chain visualization */}
        <div className="space-y-2">
          {executionChain.map((node, index) => (
            <div key={node.agent.id} className="flex items-center gap-3">
              {/* Indentation for hierarchy */}
              <div className="w-4" />

              {/* Connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    index === executionChain.length - 1
                      ? "bg-primary"
                      : "bg-muted-foreground/40"
                  )}
                />
                {index < executionChain.length - 1 && (
                  <div className="w-px h-6 bg-border" />
                )}
              </div>

              {/* Agent card */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border flex-1",
                  index === executionChain.length - 1
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/30"
                )}
              >
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <AgentIcon
                    icon={node.agent.icon}
                    className="h-3.5 w-3.5 text-foreground/70"
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">
                    {node.agent.name}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {node.agent.title || node.agent.role}
                  </span>
                </div>
                <StatusBadge status={node.agent.status} />
              </div>
            </div>
          ))}
        </div>

        {/* Capabilities preview */}
        {capabilities && (
          <div className="pt-3 border-t border-border space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("executionChain.capabilities")}
            </div>

            {/* Tools */}
            {capabilities.tools.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t("executionChain.tools")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {capabilities.tools.slice(0, 8).map((tool) => (
                    <span
                      key={tool}
                      className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ))}
                  {capabilities.tools.length > 8 && (
                    <span className="px-2 py-0.5 text-xs text-muted-foreground">
                      +{capabilities.tools.length - 8}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Domains */}
            {capabilities.domains.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t("executionChain.domains")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {capabilities.domains.slice(0, 5).map((domain) => (
                    <span
                      key={domain}
                      className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                    >
                      {domain}
                    </span>
                  ))}
                  {capabilities.domains.length > 5 && (
                    <span className="px-2 py-0.5 text-xs text-muted-foreground">
                      +{capabilities.domains.length - 5}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Languages & Frameworks */}
            {(capabilities.languages.length > 0 || capabilities.frameworks.length > 0) && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t("executionChain.technologies")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {[...capabilities.languages, ...capabilities.frameworks]
                    .slice(0, 6)
                    .map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 text-xs border border-border rounded-full text-muted-foreground"
                      >
                        {tech}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execution flow summary */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{t("executionChain.flowDescription")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
