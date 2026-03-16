import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";
import pc from "picocolors";

interface TemplateListOptions extends BaseClientOptions {
  companyId?: string;
  category?: string;
  freeOnly?: boolean;
  sort?: "popular" | "newest" | "rating" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
}

interface TemplateInstallOptions extends BaseClientOptions {
  companyId?: string;
  targetCompanyId?: string;
  customize?: boolean;
  preview?: boolean;
}

interface TemplateSearchOptions extends BaseClientOptions {
  companyId?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  sort?: "popular" | "newest" | "rating" | "price_asc" | "price_desc";
}

interface TemplateForkOptions extends BaseClientOptions {
  companyId?: string;
  name?: string;
  description?: string;
  price?: number;
  isPublic?: boolean;
}

interface CompanyTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  version: string;
  category?: string;
  isPublic: boolean;
  priceCents: number;
  installCount: number;
  rating?: number;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

interface TemplateDetail extends CompanyTemplate {
  content?: object;
  lineage?: {
    forkedFrom?: string;
    forkedFromName?: string;
    ancestorChain: Array<{
      id: string;
      name: string;
      level: number;
    }>;
    forks: Array<{
      id: string;
      name: string;
      companyName: string;
    }>;
  };
  versions: Array<{
    version: string;
    changeLog?: string;
    createdAt: string;
  }>;
}

interface InstallResult {
  success: boolean;
  templateId: string;
  installedCompanyId: string;
  version: string;
  customizationLayer?: object;
  message?: string;
}

interface PurchaseResult {
  success: boolean;
  transactionId: string;
  amountCents: number;
  status: "completed" | "pending" | "failed";
}

export function registerTemplateCommands(program: Command): void {
  const template = program.command("template").description("Template marketplace operations");

  // List templates
  addCommonClientOptions(
    template
      .command("list")
      .description("List templates from the marketplace")
      .option("-C, --company-id <id>", "Source company ID (default: public marketplace)")
      .option("--category <category>", "Filter by category")
      .option("--free-only", "Show only free templates")
      .option("--sort <sort>", "Sort by: popular, newest, rating, price_asc, price_desc", "popular")
      .option("--page <page>", "Page number", (v) => Number(v), 1)
      .option("--limit <limit>", "Items per page", (v) => Number(v), 20)
      .action(async (opts: TemplateListOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const params = new URLSearchParams();
          if (opts.category) params.set("category", opts.category);
          if (opts.freeOnly) params.set("freeOnly", "true");
          if (opts.sort) params.set("sort", opts.sort);
          params.set("page", String(opts.page ?? 1));
          params.set("limit", String(opts.limit ?? 20));

          const companyId = opts.companyId || "marketplace";
          const url = `/api/companies/${companyId}/templates?${params.toString()}`;
          const result = await ctx.api.get<{ templates: CompanyTemplate[]; total: number }>(url);

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (!result?.templates?.length) {
            console.log(pc.dim("No templates found."));
            return;
          }

          console.log(pc.bold(`\nTemplates (${result.total} total):\n`));
          for (const t of result.templates) {
            const price = t.priceCents === 0 ? pc.green("Free") : pc.yellow(`$${(t.priceCents / 100).toFixed(2)}`);
            console.log(`${pc.bold(t.name)} ${pc.dim(`(${t.slug})`)}`);
            console.log(`  ${pc.dim("ID:")} ${t.id}`);
            console.log(`  ${pc.dim("Price:")} ${price} ${pc.dim(`| Installs: ${t.installCount} | Rating: ${t.rating?.toFixed(1) ?? "-"}`)}`);
            console.log(`  ${pc.dim("Version:")} ${t.version} ${pc.dim("| Updated:")} ${new Date(t.updatedAt).toLocaleDateString()}`);
            if (t.description) {
              console.log(`  ${t.description.slice(0, 100)}${t.description.length > 100 ? "..." : ""}`);
            }
            console.log();
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Search templates
  addCommonClientOptions(
    template
      .command("search")
      .description("Search templates in the marketplace")
      .argument("<query>", "Search query")
      .option("-C, --company-id <id>", "Source company ID (default: public marketplace)")
      .option("--category <category>", "Filter by category")
      .option("--price-min <cents>", "Minimum price in cents", (v) => Number(v))
      .option("--price-max <cents>", "Maximum price in cents", (v) => Number(v))
      .option("--rating <rating>", "Minimum rating", (v) => Number(v))
      .option("--sort <sort>", "Sort by: popular, newest, rating, price_asc, price_desc", "popular")
      .action(async (query: string, opts: TemplateSearchOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const params = new URLSearchParams({ q: query });
          if (opts.category) params.set("category", opts.category);
          if (opts.priceMin !== undefined) params.set("priceMin", String(opts.priceMin));
          if (opts.priceMax !== undefined) params.set("priceMax", String(opts.priceMax));
          if (opts.rating !== undefined) params.set("rating", String(opts.rating));
          if (opts.sort) params.set("sort", opts.sort);

          const companyId = opts.companyId || "marketplace";
          const url = `/api/companies/${companyId}/templates/search?${params.toString()}`;
          const result = await ctx.api.get<{ templates: CompanyTemplate[]; total: number }>(url);

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (!result?.templates?.length) {
            console.log(pc.dim(`No templates found for "${query}".`));
            return;
          }

          console.log(pc.bold(`\nSearch results for "${query}" (${result.total} found):\n`));
          for (const t of result.templates) {
            const price = t.priceCents === 0 ? pc.green("Free") : pc.yellow(`$${(t.priceCents / 100).toFixed(2)}`);
            console.log(`${pc.bold(t.name)} ${pc.dim(`(${t.slug})`)} ${price}`);
            console.log(`  ${pc.dim("ID:")} ${t.id} ${pc.dim("| Installs:")} ${t.installCount}`);
            if (t.description) {
              console.log(`  ${t.description.slice(0, 80)}${t.description.length > 80 ? "..." : ""}`);
            }
            console.log();
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Get template details
  addCommonClientOptions(
    template
      .command("get")
      .description("Get template details")
      .argument("<templateId>", "Template ID or slug")
      .option("-C, --company-id <id>", "Source company ID (default: public marketplace)")
      .option("--lineage", "Show lineage information")
      .action(async (templateId: string, opts: BaseClientOptions & { companyId?: string; lineage?: boolean }) => {
        try {
          const ctx = resolveCommandContext(opts);
          const companyId = opts.companyId || "marketplace";
          const params = new URLSearchParams();
          if (opts.lineage) params.set("includeLineage", "true");

          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}?${params.toString()}`;
          const result = await ctx.api.get<TemplateDetail>(url);

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (!result) {
            console.log(pc.red(`Template not found: ${templateId}`));
            return;
          }

          const price = result.priceCents === 0 ? pc.green("Free") : pc.yellow(`$${(result.priceCents / 100).toFixed(2)}`);
          console.log(pc.bold(`\n${result.name}\n`));
          console.log(`${pc.dim("ID:")} ${result.id}`);
          console.log(`${pc.dim("Slug:")} ${result.slug}`);
          console.log(`${pc.dim("Version:")} ${result.version}`);
          console.log(`${pc.dim("Price:")} ${price}`);
          console.log(`${pc.dim("Installs:")} ${result.installCount}`);
          console.log(`${pc.dim("Rating:")} ${result.rating?.toFixed(1) ?? "-"}`);
          console.log(`${pc.dim("Category:")} ${result.category ?? "-"}`);
          console.log(`${pc.dim("Author:")} ${result.authorName ?? "-"}`);
          console.log(`${pc.dim("Updated:")} ${new Date(result.updatedAt).toLocaleString()}`);
          console.log(`${pc.dim("Created:")} ${new Date(result.createdAt).toLocaleString()}`);

          if (result.description) {
            console.log(`\n${pc.bold("Description:")}`);
            console.log(result.description);
          }

          if (result.lineage && opts.lineage) {
            console.log(`\n${pc.bold("Lineage:")}`);
            if (result.lineage.forkedFrom) {
              console.log(`  ${pc.dim("Forked from:")} ${result.lineage.forkedFromName} (${result.lineage.forkedFrom})`);
            }
            if (result.lineage.ancestorChain?.length) {
              console.log(`  ${pc.dim("Ancestor chain:")}`);
              for (const ancestor of result.lineage.ancestorChain) {
                console.log(`    ${"  ".repeat(ancestor.level)}└─ ${ancestor.name}`);
              }
            }
            if (result.lineage.forks?.length) {
              console.log(`  ${pc.dim("Forks:")} ${result.lineage.forks.length}`);
            }
          }

          if (result.versions?.length) {
            console.log(`\n${pc.bold("Versions:")}`);
            for (const v of result.versions.slice(0, 5)) {
              console.log(`  ${v.version} ${pc.dim("-" + new Date(v.createdAt).toLocaleDateString())}`);
              if (v.changeLog) console.log(`    ${v.changeLog.slice(0, 60)}${v.changeLog.length > 60 ? "..." : ""}`);
            }
            if (result.versions.length > 5) {
              console.log(pc.dim(`  ... and ${result.versions.length - 5} more`));
            }
          }

          console.log();
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Preview template
  addCommonClientOptions(
    template
      .command("preview")
      .description("Preview template content before installation")
      .argument("<templateId>", "Template ID or slug")
      .option("-C, --company-id <id>", "Source company ID")
      .action(async (templateId: string, opts: BaseClientOptions & { companyId?: string }) => {
        try {
          const ctx = resolveCommandContext(opts);
          const companyId = opts.companyId || "marketplace";
          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}/preview`;
          const result = await ctx.api.get<{ manifest: object; customizationPreview: object }>(url);

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          console.log(pc.bold("\nTemplate Preview\n"));
          console.log(pc.bold("Manifest:"));
          console.log(JSON.stringify(result.manifest, null, 2));
          console.log();
          console.log(pc.bold("Customization Layer Preview:"));
          console.log(JSON.stringify(result.customizationPreview, null, 2));
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Install template
  addCommonClientOptions(
    template
      .command("install")
      .description("Install a template to your company")
      .argument("<templateId>", "Template ID or slug to install")
      .requiredOption("-T, --target-company-id <id>", "Target company ID to install into")
      .option("-C, --company-id <id>", "Source company ID (default: public marketplace)")
      .option("--customize", "Open customization editor after installation")
      .action(async (templateId: string, opts: TemplateInstallOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const sourceCompanyId = opts.companyId || "marketplace";
          const targetCompanyId = opts.targetCompanyId;

          if (!targetCompanyId) {
            throw new Error("Target company ID is required. Use -T, --target-company-id");
          }

          console.log(pc.blue(`Installing template ${templateId}...`));

          const url = `/api/companies/${sourceCompanyId}/templates/${encodeURIComponent(templateId)}/install`;
          const result = await ctx.api.post<InstallResult>(url, {
            targetCompanyId,
            customize: opts.customize ?? false,
          });

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (result.success) {
            console.log(pc.green(`✓ Template installed successfully!`));
            console.log(`  ${pc.dim("Template ID:")} ${result.templateId}`);
            console.log(`  ${pc.dim("Version:")} ${result.version}`);
            console.log(`  ${pc.dim("Installed to company:")} ${result.installedCompanyId}`);
          } else {
            console.log(pc.red(`✗ Installation failed: ${result.message}`));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Purchase template
  addCommonClientOptions(
    template
      .command("purchase")
      .description("Purchase a template")
      .argument("<templateId>", "Template ID or slug to purchase")
      .requiredOption("-C, --company-id <id>", "Company ID for purchase")
      .option("--method <method>", "Payment method: balance, stripe, alipay, wechat", "balance")
      .action(async (templateId: string, opts: BaseClientOptions & { companyId: string; method?: string }) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const companyId = opts.companyId!;

          console.log(pc.blue(`Purchasing template ${templateId}...`));

          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}/purchase`;
          const result = await ctx.api.post<PurchaseResult>(url, {
            paymentMethod: opts.method || "balance",
          });

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (result.success) {
            console.log(pc.green(`✓ Purchase successful!`));
            console.log(`  ${pc.dim("Transaction ID:")} ${result.transactionId}`);
            console.log(`  ${pc.dim("Amount:")} $${(result.amountCents / 100).toFixed(2)}`);
            console.log(`  ${pc.dim("Status:")} ${result.status}`);
          } else {
            console.log(pc.red(`✗ Purchase failed`));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Fork template
  addCommonClientOptions(
    template
      .command("fork")
      .description("Fork a template to create your own version")
      .argument("<templateId>", "Template ID or slug to fork")
      .requiredOption("-C, --company-id <id>", "Your company ID")
      .option("--name <name>", "New template name")
      .option("--description <description>", "New template description")
      .option("--price <cents>", "New price in cents", (v) => Number(v))
      .option("--public", "Make the forked template public")
      .action(async (templateId: string, opts: TemplateForkOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const companyId = opts.companyId!;

          console.log(pc.blue(`Forking template ${templateId}...`));

          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}/fork`;
          const result = await ctx.api.post<CompanyTemplate>(url, {
            name: opts.name,
            description: opts.description,
            priceCents: opts.price,
            isPublic: opts.isPublic ?? false,
          });

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          console.log(pc.green(`✓ Template forked successfully!`));
          console.log(`  ${pc.dim("New ID:")} ${result.id}`);
          console.log(`  ${pc.dim("Name:")} ${result.name}`);
          console.log(`  ${pc.dim("Slug:")} ${result.slug}`);
          console.log(`  ${pc.dim("Version:")} ${result.version}`);
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // List installed templates
  addCommonClientOptions(
    template
      .command("installed")
      .description("List templates installed in your company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .action(async (opts: BaseClientOptions & { companyId?: string }) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const companyId = opts.companyId!;

          const url = `/api/companies/${companyId}/templates/installed`;
          const result = await ctx.api.get<{ templates: CompanyTemplate[] }>(url);

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (!result?.templates?.length) {
            console.log(pc.dim("No templates installed in this company."));
            return;
          }

          console.log(pc.bold(`\nInstalled Templates (${result.templates.length}):\n`));
          for (const t of result.templates) {
            console.log(formatInlineRecord({
              id: t.id,
              name: t.name,
              version: t.version,
              category: t.category,
              updatedAt: new Date(t.updatedAt).toLocaleDateString(),
            }));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Uninstall template
  addCommonClientOptions(
    template
      .command("uninstall")
      .description("Uninstall a template from your company")
      .argument("<templateId>", "Installed template ID")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .option("--force", "Force uninstall even if in use")
      .action(async (templateId: string, opts: BaseClientOptions & { companyId?: string; force?: boolean }) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const companyId = opts.companyId!;

          console.log(pc.blue(`Uninstalling template ${templateId}...`));

          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}/uninstall`;
          await ctx.api.post(url, { force: opts.force ?? false });

          if (ctx.json) {
            printOutput({ success: true, templateId }, { json: true });
            return;
          }

          console.log(pc.green(`✓ Template uninstalled successfully`));
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Upgrade template
  addCommonClientOptions(
    template
      .command("upgrade")
      .description("Upgrade an installed template to latest version")
      .argument("<templateId>", "Installed template ID")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .option("--version <version>", "Specific version to upgrade to (default: latest)")
      .action(async (templateId: string, opts: BaseClientOptions & { companyId?: string; version?: string }) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const companyId = opts.companyId!;

          console.log(pc.blue(`Upgrading template ${templateId}...`));

          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}/upgrade`;
          const result = await ctx.api.post<InstallResult>(url, {
            targetVersion: opts.version,
          });

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          if (result.success) {
            console.log(pc.green(`✓ Template upgraded successfully!`));
            console.log(`  ${pc.dim("New version:")} ${result.version}`);
          } else {
            console.log(pc.yellow(`Template is already at the latest version`));
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  // Publish template
  addCommonClientOptions(
    template
      .command("publish")
      .description("Publish a template to the marketplace")
      .argument("<templateId>", "Template ID to publish")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .option("--public", "Make publicly visible")
      .action(async (templateId: string, opts: BaseClientOptions & { companyId?: string; public?: boolean }) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const companyId = opts.companyId!;

          console.log(pc.blue(`Publishing template ${templateId}...`));

          const url = `/api/companies/${companyId}/templates/${encodeURIComponent(templateId)}/publish`;
          const result = await ctx.api.post<CompanyTemplate>(url, {
            isPublic: opts.public ?? true,
          });

          if (ctx.json) {
            printOutput(result, { json: true });
            return;
          }

          console.log(pc.green(`✓ Template published successfully!`));
          console.log(`  ${pc.dim("Public:")} ${result.isPublic ? "Yes" : "No"}`);
          console.log(`  ${pc.dim("Price:")} $${(result.priceCents / 100).toFixed(2)}`);
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
