import type { Db } from "@jigongai/db";
import { eq, and, desc } from "drizzle-orm";
import {
  companyTemplates,
  templateSubscriptions,
  templateMarketplace,
  templateWorkflows,
  templateRoles,
  projectTemplateAssignments,
} from "@jigongai/db";

export interface TemplatePackage {
  manifest: {
    apiVersion: string;
    kind: string;
    metadata: {
      name: string;
      version: string;
      author?: string;
      category?: string;
      encrypted?: boolean;
    };
  };
  core: {
    encrypted: boolean;
    encryptedData?: string;
    data?: {
      workflows: unknown[];
      globalRules: unknown;
      checks: unknown[];
    };
  };
  customization: {
    variables: Record<string, unknown>;
    integrations: Record<string, unknown>;
    notifications: Record<string, unknown>;
  };
  roles: unknown[];
  agentBehaviors: Record<string, unknown>;
}

export interface ParseTemplateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  package: TemplatePackage | null;
}

export interface CompiledTemplate {
  id: string;
  manifest: TemplatePackage["manifest"];
  workflows: unknown[];
  roles: unknown[];
  variables: Record<string, unknown>;
  agentBehaviors: Record<string, unknown>;
}

export function templateEngineService(db: Db) {
  return {
    /**
     * Parse and validate a template package
     */
    async parseTemplate(content: string): Promise<ParseTemplateResult> {
      const errors: string[] = [];
      const warnings: string[] = [];

      try {
        const pkg = JSON.parse(content) as TemplatePackage;

        // Validate manifest
        if (!pkg.manifest?.apiVersion) {
          errors.push("Missing manifest.apiVersion");
        }
        if (!pkg.manifest?.kind) {
          errors.push("Missing manifest.kind");
        }
        if (!pkg.manifest?.metadata?.name) {
          errors.push("Missing manifest.metadata.name");
        }
        if (!pkg.manifest?.metadata?.version) {
          errors.push("Missing manifest.metadata.version");
        }

        // Validate core section
        if (!pkg.core) {
          errors.push("Missing core section");
        } else if (pkg.core.encrypted && !pkg.core.encryptedData) {
          errors.push("Core is encrypted but missing encryptedData");
        } else if (!pkg.core.encrypted && !pkg.core.data) {
          errors.push("Core is not encrypted but missing data");
        }

        // Validate customization section
        if (!pkg.customization) {
          warnings.push("Missing customization section, using defaults");
        }

        // Validate roles
        if (!Array.isArray(pkg.roles)) {
          warnings.push("Roles should be an array");
        }

        if (errors.length > 0) {
          return { valid: false, errors, warnings, package: null };
        }

        return { valid: true, errors, warnings, package: pkg };
      } catch (e) {
        errors.push(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return { valid: false, errors, warnings, package: null };
      }
    },

    /**
     * Load and compile a template for use
     */
    async compileTemplate(
      templateId: string,
      customVariables?: Record<string, unknown>
    ): Promise<CompiledTemplate | null> {
      const [template] = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, templateId))
        .limit(1);

      if (!template || !template.templatePackage) {
        return null;
      }

      const pkg = template.templatePackage as TemplatePackage;

      // Decrypt core if needed (placeholder for actual encryption)
      let coreData = pkg.core.data;
      if (pkg.core.encrypted && pkg.core.encryptedData) {
        // TODO: Implement actual decryption
        coreData = await this.decryptCore(pkg.core.encryptedData, template.encryptionConfig);
      }

      // Merge variables
      const variables = {
        ...pkg.customization?.variables,
        ...customVariables,
      };

      // Load workflows from database
      const workflows = await db
        .select()
        .from(templateWorkflows)
        .where(
          and(
            eq(templateWorkflows.templateId, templateId),
            eq(templateWorkflows.isActive, true)
          )
        );

      // Load roles from database
      const roles = await db
        .select()
        .from(templateRoles)
        .where(
          and(
            eq(templateRoles.templateId, templateId),
            eq(templateRoles.isActive, true)
          )
        );

      return {
        id: template.id,
        manifest: pkg.manifest,
        workflows: workflows.map(w => w.definition),
        roles: roles.map(r => r.definition),
        variables,
        agentBehaviors: pkg.agentBehaviors || {},
      };
    },

    /**
     * Import a template package
     */
    async importTemplate(
      companyId: string,
      packageContent: string,
      options: {
        importedBy: string;
        sourceType?: string;
        isDefault?: boolean;
      }
    ): Promise<{ success: boolean; templateId?: string; errors?: string[] }> {
      const parseResult = await this.parseTemplate(packageContent);

      if (!parseResult.valid) {
        return { success: false, errors: parseResult.errors };
      }

      const pkg = parseResult.package!;
      const slug = this.generateSlug(pkg.manifest.metadata.name);

      // Check for duplicate slug
      const existing = await db
        .select({ id: companyTemplates.id })
        .from(companyTemplates)
        .where(
          and(
            eq(companyTemplates.companyId, companyId),
            eq(companyTemplates.slug, slug)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return { success: false, errors: [`Template with slug "${slug}" already exists`] };
      }

      // Create template record
      const [template] = await db
        .insert(companyTemplates)
        .values({
          companyId,
          name: pkg.manifest.metadata.name,
          slug,
          description: `Imported from ${options.sourceType || "unknown"}`,
          version: pkg.manifest.metadata.version,
          sourceType: options.sourceType || "imported",
          templatePackage: pkg,
          isActive: true,
          isDefault: options.isDefault || false,
          createdBy: options.importedBy,
          updatedBy: options.importedBy,
          importedAt: new Date(),
        })
        .returning();

      // Extract and save workflows
      if (pkg.core.data?.workflows) {
        for (const workflow of pkg.core.data.workflows as Array<{
          code: string;
          name: string;
          description?: string;
          definition: unknown;
        }>) {
          await db.insert(templateWorkflows).values({
            companyId,
            templateId: template.id,
            code: workflow.code,
            name: workflow.name,
            description: workflow.description,
            definition: workflow.definition,
          });
        }
      }

      // Extract and save roles
      for (const role of pkg.roles as Array<{
        code: string;
        name: string;
        description?: string;
        definition: unknown;
      }>) {
        await db.insert(templateRoles).values({
          companyId,
          templateId: template.id,
          code: role.code,
          name: role.name,
          description: role.description,
          definition: role.definition,
        });
      }

      return { success: true, templateId: template.id };
    },

    /**
     * Export a template package
     */
    async exportTemplate(
      templateId: string,
      options?: {
        includeCustomization?: boolean;
        encryptCore?: boolean;
      }
    ): Promise<{ success: boolean; content?: string; error?: string }> {
      const [template] = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, templateId))
        .limit(1);

      if (!template) {
        return { success: false, error: "Template not found" };
      }

      const pkg = template.templatePackage as TemplatePackage;

      // Prepare export package
      const exportPkg: TemplatePackage = {
        manifest: pkg.manifest,
        core: pkg.core,
        customization: options?.includeCustomization !== false ? pkg.customization : {
          variables: {},
          integrations: {},
          notifications: {},
        },
        roles: pkg.roles,
        agentBehaviors: pkg.agentBehaviors,
      };

      // Encrypt core if requested
      if (options?.encryptCore && !pkg.core.encrypted) {
        // TODO: Implement actual encryption
        exportPkg.core = {
          encrypted: true,
          encryptedData: await this.encryptCore(pkg.core.data),
        };
      }

      return { success: true, content: JSON.stringify(exportPkg, null, 2) };
    },

    /**
     * Create a copy (fork) of a template
     */
    async forkTemplate(
      templateId: string,
      companyId: string,
      forkedBy: string,
      customizations?: Record<string, unknown>
    ): Promise<{ success: boolean; newTemplateId?: string; error?: string }> {
      const exportResult = await this.exportTemplate(templateId, {
        includeCustomization: true,
        encryptCore: false,
      });

      if (!exportResult.success) {
        return { success: false, error: exportResult.error };
      }

      // Modify the package to indicate it's a fork
      const pkg = JSON.parse(exportResult.content!) as TemplatePackage;
      pkg.manifest.metadata.name = `${pkg.manifest.metadata.name} (Fork)`;

      // Apply customizations
      if (customizations) {
        pkg.customization = {
          ...pkg.customization,
          ...customizations,
        };
      }

      return this.importTemplate(companyId, JSON.stringify(pkg), {
        importedBy: forkedBy,
        sourceType: "forked",
      });
    },

    /**
     * Publish a template to the marketplace
     */
    async publishToMarketplace(
      templateId: string,
      options: {
        category?: string;
        tags?: string[];
        publishedBy: string;
      }
    ): Promise<{ success: boolean; error?: string }> {
      const [template] = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, templateId))
        .limit(1);

      if (!template) {
        return { success: false, error: "Template not found" };
      }

      // Generate share code
      const shareCode = this.generateShareCode();

      // Update template
      await db
        .update(companyTemplates)
        .set({
          isPublic: true,
          shareCode,
          updatedAt: new Date(),
        })
        .where(eq(companyTemplates.id, templateId));

      // Create marketplace entry
      await db.insert(templateMarketplace).values({
        companyId: template.companyId,
        templateId,
        status: "pending",
        category: options.category || "general",
        tags: options.tags || [],
      });

      return { success: true };
    },

    /**
     * List available templates for a company
     */
    async listTemplates(companyId: string, options?: {
      includePublic?: boolean;
      category?: string;
    }) {
      const companyTemplates = await db.query.companyTemplates.findMany({
        where: (t, { eq, and }) =>
          and(
            eq(t.companyId, companyId),
            eq(t.isActive, true)
          ),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });

      // TODO: Include public templates if requested

      return companyTemplates;
    },

    /**
     * Get template by share code
     */
    async getTemplateByShareCode(shareCode: string) {
      const [template] = await db
        .select()
        .from(companyTemplates)
        .where(
          and(
            eq(companyTemplates.shareCode, shareCode),
            eq(companyTemplates.isPublic, true)
          )
        )
        .limit(1);

      return template || null;
    },

    // Private helpers
    generateSlug(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        + "-"
        + Date.now().toString(36);
    },

    generateShareCode(): string {
      return "tpl-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    },

    async encryptCore(_data: unknown): Promise<string> {
      // TODO: Implement actual encryption
      return Buffer.from(JSON.stringify(_data)).toString("base64");
    },

    async decryptCore(
      _encryptedData: string,
      _config: unknown
    ): Promise<unknown> {
      // TODO: Implement actual decryption
      return JSON.parse(Buffer.from(_encryptedData, "base64").toString());
    },
  };
}

export type TemplateEngineService = ReturnType<typeof templateEngineService>;
