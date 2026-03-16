import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  GitFork,
  GitCommit,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Info,
  User,
  Calendar,
  Tag,
  FileDiff,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import { client } from "@/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

interface TemplateLineageNode {
  id: string;
  name: string;
  version: string;
  author: string;
  createdAt: string;
  description?: string;
  forkReason?: string;
  changes?: string[];
}

interface TemplateLineageData {
  current: TemplateLineageNode;
  ancestors: TemplateLineageNode[];
  descendants: TemplateLineageNode[];
  siblings: TemplateLineageNode[];
  stats: {
    totalForks: number;
    generation: number;
    rootTemplateId?: string;
    parentTemplateId?: string;
  };
}

interface TemplateLineageProps {
  templateId: string;
  companyId?: string;
  className?: string;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchTemplateLineage(
  companyId: string,
  templateId: string
): Promise<TemplateLineageData> {
  const response = await client.get(
    `/v1/marketplace/company-templates/${templateId}/lineage`,
    { params: { companyId } }
  );
  return response.data.data;
}

// =============================================================================
// Helper Components
// =============================================================================

function LineageNodeCard({
  node,
  isCurrent,
  isRoot,
  isLeaf,
  onClick,
  expanded,
  onToggleExpand,
  hasChildren,
}: {
  node: TemplateLineageNode;
  isCurrent?: boolean;
  isRoot?: boolean;
  isLeaf?: boolean;
  onClick?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  hasChildren?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border p-4 transition-all cursor-pointer",
        isCurrent
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/50 hover:bg-accent/50",
        "min-w-[240px] max-w-[320px]"
      )}
      onClick={onClick}
    >
      {/* Node Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isCurrent ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {isRoot ? (
              <GitCommit className="h-4 w-4" />
            ) : (
              <GitFork className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm truncate">{node.name}</span>
            <span className="text-xs text-muted-foreground">
              v{node.version}
            </span>
          </div>
        </div>
        {isCurrent && (
          <Badge variant="default" className="shrink-0">
            {t("templateLineage.current")}
          </Badge>
        )}
      </div>

      {/* Node Details */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{node.author}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{formatDate(node.createdAt)}</span>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      {hasChildren && onToggleExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center h-6 w-6 rounded-full bg-background border border-border shadow-sm hover:bg-accent"
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}

function ConnectorLine({
  direction = "vertical",
  variant = "solid",
}: {
  direction?: "vertical" | "horizontal";
  variant?: "solid" | "dashed";
}) {
  return (
    <div
      className={cn(
        "bg-border",
        direction === "vertical" ? "w-px h-8" : "h-px w-8",
        variant === "dashed" && "border-dashed"
      )}
    />
  );
}

function ForkBranch({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Horizontal connector */}
        <div className="absolute top-0 left-0 right-0 h-px bg-border" />
        {/* Branch point */}
        <div className="flex items-start justify-center gap-4 pt-4">
          {children}
        </div>
      </div>
      {count && count > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="mt-2">
              +{count} {count === 1 ? "fork" : "forks"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <span>{count} forked templates</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function NodeDetailsDialog({
  node,
  parentNode,
  isOpen,
  onClose,
}: {
  node: TemplateLineageNode | null;
  parentNode?: TemplateLineageNode | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (!node) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5" />
            {node.name}
          </DialogTitle>
          <DialogDescription>
            {t("templateLineage.version")} {node.version}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("templateLineage.author")}
              </span>
              <div className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {node.author}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("templateLineage.createdAt")}
              </span>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(node.createdAt)}
              </div>
            </div>
          </div>

          {/* Description */}
          {node.description && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("templateLineage.description")}
              </span>
              <p className="text-sm">{node.description}</p>
            </div>
          )}

          {/* Fork Reason */}
          {node.forkReason && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("templateLineage.forkReason")}
              </span>
              <p className="text-sm bg-muted rounded-md p-2">{node.forkReason}</p>
            </div>
          )}

          {/* Changes */}
          {node.changes && node.changes.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileDiff className="h-3.5 w-3.5" />
                {t("templateLineage.changes")}
              </span>
              <ul className="space-y-1">
                {node.changes.map((change, index) => (
                  <li
                    key={index}
                    className="text-sm flex items-start gap-2"
                  >
                    <span className="text-primary mt-1">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparison with Parent */}
          {parentNode && (
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {t("templateLineage.forkedFrom")}
              </span>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <GitCommit className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{parentNode.name}</span>
                <Badge variant="secondary" className="text-xs">
                  v{parentNode.version}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TemplateLineage({
  templateId,
  companyId: propCompanyId,
  className,
}: TemplateLineageProps) {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const companyId = propCompanyId || selectedCompanyId;

  const [selectedNode, setSelectedNode] = useState<TemplateLineageNode | null>(
    null
  );
  const [expandedDescendants, setExpandedDescendants] = useState<Set<string>>(
    new Set()
  );
  const [showAncestors, setShowAncestors] = useState(true);
  const [showDescendants, setShowDescendants] = useState(true);

  const {
    data: lineage,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.templates.lineage(companyId!, templateId),
    queryFn: () => fetchTemplateLineage(companyId!, templateId),
    enabled: !!companyId && !!templateId,
  });

  const parentNode = useMemo(() => {
    if (!lineage || lineage.ancestors.length === 0) return null;
    return lineage.ancestors[lineage.ancestors.length - 1];
  }, [lineage]);

  const toggleDescendants = (nodeId: string) => {
    setExpandedDescendants((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card className={cn("min-h-[300px]", className)}>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">{t("common.loading")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("min-h-[300px]", className)}>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Info className="h-8 w-8" />
            <span className="text-sm">{t("common.error")}</span>
            <span className="text-xs">
              {error instanceof Error ? error.message : "Unknown error"}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lineage) {
    return (
      <Card className={cn("min-h-[300px]", className)}>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <GitFork className="h-8 w-8" />
            <span className="text-sm">{t("templateLineage.noData")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAncestors = lineage.ancestors.length > 0;
  const hasDescendants = lineage.descendants.length > 0;
  const hasSiblings = lineage.siblings.length > 0;

  return (
    <TooltipProvider>
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitFork className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">
                {t("templateLineage.title")}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {t("templateLineage.generation")} {lineage.stats.generation}
              </Badge>
              <Badge variant="outline">
                {lineage.stats.totalForks} {t("templateLineage.forks")}
              </Badge>
            </div>
          </div>
          <CardDescription>{t("templateLineage.description")}</CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            {/* Ancestors Section */}
            {hasAncestors && showAncestors && (
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("templateLineage.ancestors")}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  {lineage.ancestors.map((ancestor, index) => (
                    <div key={ancestor.id} className="flex flex-col items-center">
                      <LineageNodeCard
                        node={ancestor}
                        isRoot={index === 0}
                        onClick={() => setSelectedNode(ancestor)}
                      />
                      {index < lineage.ancestors.length - 1 && (
                        <ConnectorLine />
                      )}
                    </div>
                  ))}
                </div>
                <ConnectorLine />
              </div>
            )}

            {/* Current Node */}
            <div className="flex flex-col items-center">
              <LineageNodeCard
                node={lineage.current}
                isCurrent
                onClick={() => setSelectedNode(lineage.current)}
              />
            </div>

            {/* Siblings Section */}
            {hasSiblings && (
              <div className="flex flex-col items-center w-full">
                <ConnectorLine />
                <div className="flex items-center gap-2 my-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("templateLineage.siblings")}
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-center gap-4">
                  {lineage.siblings.map((sibling) => (
                    <LineageNodeCard
                      key={sibling.id}
                      node={sibling}
                      onClick={() => setSelectedNode(sibling)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Descendants Section */}
            {hasDescendants && showDescendants && (
              <div className="flex flex-col items-center w-full">
                <ConnectorLine />
                <div className="flex items-center gap-2 my-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {t("templateLineage.descendants")}
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-center gap-4">
                  {lineage.descendants.map((descendant) => (
                    <div key={descendant.id} className="flex flex-col items-center">
                      <LineageNodeCard
                        node={descendant}
                        isLeaf={!expandedDescendants.has(descendant.id)}
                        onClick={() => setSelectedNode(descendant)}
                        expanded={expandedDescendants.has(descendant.id)}
                        onToggleExpand={() => toggleDescendants(descendant.id)}
                        hasChildren={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-8 pt-4 border-t flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span>{t("templateLineage.current")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-muted border border-border" />
              <span>{t("templateLineage.related")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitCommit className="h-3 w-3" />
              <span>{t("templateLineage.root")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitFork className="h-3 w-3" />
              <span>{t("templateLineage.fork")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Details Dialog */}
      <NodeDetailsDialog
        node={selectedNode}
        parentNode={
          selectedNode?.id === lineage.current.id ? parentNode : null
        }
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </TooltipProvider>
  );
}

export default TemplateLineage;
