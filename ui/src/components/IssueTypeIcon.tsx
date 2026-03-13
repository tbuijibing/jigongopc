import type { IssueType } from "@Jigongai/shared";
import {
  CheckSquare,
  BookOpen,
  Bug,
  Layers,
  Eye,
  ShieldCheck,
  FileText,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";

export interface IssueTypeMapping {
  icon: LucideIcon;
  label: string;
}

export const ISSUE_TYPE_MAP: Record<IssueType, IssueTypeMapping> = {
  task: { icon: CheckSquare, label: "Task" },
  story: { icon: BookOpen, label: "Story" },
  bug: { icon: Bug, label: "Bug" },
  epic: { icon: Layers, label: "Epic" },
  review: { icon: Eye, label: "Review" },
  approval: { icon: ShieldCheck, label: "Approval" },
  document: { icon: FileText, label: "Document" },
  milestone: { icon: Flag, label: "Milestone" },
};

export function getIssueTypeMapping(issueType: IssueType): IssueTypeMapping {
  return ISSUE_TYPE_MAP[issueType];
}

interface IssueTypeIconProps {
  issueType: IssueType;
  className?: string;
  showLabel?: boolean;
}

export function IssueTypeIcon({ issueType, className, showLabel }: IssueTypeIconProps) {
  const mapping = ISSUE_TYPE_MAP[issueType];
  const Icon = mapping.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {showLabel && <span className="text-sm">{mapping.label}</span>}
    </span>
  );
}
