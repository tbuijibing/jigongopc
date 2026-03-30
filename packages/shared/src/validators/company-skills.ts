import { z } from "zod";

export const companySkillCreateSchema = z.object({
  key: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  markdown: z.string().min(1),
  sourceType: z.enum(["local_path", "github", "url"]).default("local_path"),
  sourceLocator: z.string().optional().nullable(),
  sourceRef: z.string().optional().nullable(),
  trustLevel: z.enum(["markdown_only", "full_code"]).default("markdown_only"),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const companySkillUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  markdown: z.string().min(1).optional(),
  trustLevel: z.enum(["markdown_only", "full_code"]).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const companySkillFileUpdateSchema = z.object({
  path: z.string().min(1),
  content: z.string().min(1),
});

export const companySkillImportSchema = z.object({
  source: z.string().min(1),
  sourceRef: z.string().optional().nullable(),
  mergeStrategy: z.enum(["merge", "replace"]).default("merge"),
});

export const companySkillProjectScanRequestSchema = z.object({
  projectPath: z.string().min(1),
});
