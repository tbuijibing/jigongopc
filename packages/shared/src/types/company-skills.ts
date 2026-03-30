export interface CompanySkill {
  id: string;
  companyId: string;
  key: string;
  slug: string;
  name: string;
  description: string | null;
  markdown: string;
  sourceType: "local_path" | "github" | "url";
  sourceLocator: string | null;
  sourceRef: string | null;
  trustLevel: "markdown_only" | "full_code";
  compatibility: "compatible" | "incompatible" | "unknown";
  fileInventory: Array<Record<string, unknown>>;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySkillFile {
  path: string;
  content: string;
  type: "markdown" | "code" | "config";
}

export interface CompanySkillUpdateStatus {
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  changelog?: string;
}
