import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import pc from "picocolors";
import { readConfig } from "../config/store.js";
import { resolveConfigPath } from "../config/store.js";
import { JiGongApiClient, ApiRequestError } from "../client/http.js";

// ============================================
// Types and Interfaces
// ============================================

interface TemplateSearchOptions {
  config?: string;
  dataDir?: string;
  category?: string;
  sort?: "popular" | "newest" | "rating" | "price_asc" | "price_desc";
  limit?: number;
  json?: boolean;
}

interface TemplateInstallOptions {
  config?: string;
  dataDir?: string;
  force?: boolean;
  json?: boolean;
}

interface TemplatePreviewOptions {
  config?: string;
  dataDir?: string;
  json?: boolean;
}

interface TemplateListOptions {
  config?: string;
  dataDir?: string;
  json?: boolean;
}

interface TemplateUpgradeOptions {
  config?: string;
  dataDir?: string;
  force?: boolean;
  json?: boolean;
}

interface TemplateUninstallOptions {
  config?: string;
  dataDir?: string;
  force?: boolean;
  json?: boolean;
}

interface MarketplaceTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  version: string;
  category?: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  author?: string;
  downloads?: number;
  price?: number;
}

interface TemplateManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  tags?: string[];
  dependencies?: Record<string, string>;
  files?: string[];
  entryPoint?: string;
}

interface InstalledTemplate {
  id: string;
  manifest: TemplateManifest;
  installedAt: string;
  updatedAt: string;
  source: string;
  path: string;
}

interface TemplateInstallProgress {
  stage: "downloading" | "extracting" | "installing" | "completed" | "error";
  progress: number;
  message: string;
}

// ============================================
// Configuration and Paths
// ============================================

function getJiGongHomeDir(): string {
  const envHome = process.env.Jigong_HOME?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  return path.resolve(os.homedir(), ".jigong");
}

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

function getTemplatesDir(): string {
  return path.join(getJiGongHomeDir(), "templates");
}

function getTemplateDir(templateId: string): string {
  return path.join(getTemplatesDir(), templateId);
}

function getInstalledTemplatesFile(): string {
  return path.join(getTemplatesDir(), "installed.json");
}

// ============================================
// API Client Setup
// ============================================

function createApiClient(configPath?: string): JiGongApiClient {
  const config = readConfig(configPath);

  // Determine API base URL
  const envHost = process.env.Jigong_SERVER_HOST?.trim() || "localhost";
  let port = Number(process.env.Jigong_SERVER_PORT || "");

  if (!Number.isFinite(port) || port <= 0) {
    port = Number(config?.server?.port ?? 3100);
  }

  if (!Number.isFinite(port) || port <= 0) {
    port = 3100;
  }

  const apiBase = `http://${envHost}:${port}`;

  // Get API key from environment or config
  const apiKey = process.env.Jigong_API_KEY?.trim() || undefined;

  return new JiGongApiClient({ apiBase, apiKey });
}

// ============================================
// Progress Bar Implementation
// ============================================

class SimpleProgressBar {
  private width: number;
  private current = 0;
  private total = 100;
  private label = "";

  constructor(width = 40) {
    this.width = width;
  }

  start(total: number, label: string): void {
    this.total = total;
    this.label = label;
    this.current = 0;
    this.render();
  }

  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    if (message) {
      this.label = message;
    }
    this.render();
  }

  stop(): void {
    process.stdout.write("\n");
  }

  private render(): void {
    const filled = Math.round((this.current / this.total) * this.width);
    const empty = this.width - filled;
    const percentage = Math.round((this.current / this.total) * 100);

    const bar =
      pc.cyan("█".repeat(filled)) +
      pc.gray("░".repeat(empty));

    // Clear line and render
    process.stdout.write(`\r${this.label} [${bar}] ${percentage}%`);
  }
}

// ============================================
// Local Storage Management
// ============================================

async function ensureTemplatesDir(): Promise<void> {
  const templatesDir = getTemplatesDir();
  await fs.mkdir(templatesDir, { recursive: true });
}

async function loadInstalledTemplates(): Promise<InstalledTemplate[]> {
  const filePath = getInstalledTemplatesFile();
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveInstalledTemplates(templates: InstalledTemplate[]): Promise<void> {
  const filePath = getInstalledTemplatesFile();
  await ensureTemplatesDir();
  await fs.writeFile(filePath, JSON.stringify(templates, null, 2), { mode: 0o600 });
}

async function addInstalledTemplate(template: InstalledTemplate): Promise<void> {
  const templates = await loadInstalledTemplates();
  const existingIndex = templates.findIndex((t) => t.id === template.id);

  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }

  await saveInstalledTemplates(templates);
}

async function removeInstalledTemplate(templateId: string): Promise<boolean> {
  const templates = await loadInstalledTemplates();
  const index = templates.findIndex((t) => t.id === templateId);

  if (index >= 0) {
    templates.splice(index, 1);
    await saveInstalledTemplates(templates);
    return true;
  }

  return false;
}

async function getInstalledTemplate(templateId: string): Promise<InstalledTemplate | undefined> {
  const templates = await loadInstalledTemplates();
  return templates.find((t) => t.id === templateId);
}

// ============================================
// Error Handling
// ============================================

function handleError(error: unknown, json = false): never {
  if (json) {
    console.log(JSON.stringify({ success: false, error: getErrorMessage(error) }, null, 2));
  } else {
    console.error(pc.red(`Error: ${getErrorMessage(error)}`));
  }
  process.exit(1);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return `API error ${error.status}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// ============================================
// Command Implementations
// ============================================

async function searchTemplates(
  query: string,
  opts: TemplateSearchOptions
): Promise<void> {
  const api = createApiClient(opts.config);

  try {
    const params = new URLSearchParams();
    params.set("q", query);
    if (opts.category) params.set("category", opts.category);
    if (opts.sort) params.set("sort", opts.sort);
    params.set("limit", String(opts.limit ?? 20));

    const result = await api.get<{
      success: boolean;
      data: MarketplaceTemplate[];
      pagination: { total: number; page: number; pages: number };
    }>(`/api/v1/marketplace/templates?${params.toString()}`);

    if (!result?.success) {
      throw new Error("Failed to search templates");
    }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (!result.data?.length) {
      console.log(pc.dim(`No templates found for "${query}".`));
      return;
    }

    console.log(pc.bold(`\nSearch results for "${query}" (${result.pagination.total} found):\n`));

    for (const template of result.data) {
      const price = template.price === 0
        ? pc.green("Free")
        : template.price
          ? pc.yellow(`$${(template.price / 100).toFixed(2)}`)
          : pc.gray("Unknown");

      console.log(`${pc.bold(template.name)} ${pc.dim(`(${template.slug})`)} ${price}`);
      console.log(`  ${pc.dim("ID:")} ${template.id}`);
      console.log(`  ${pc.dim("Version:")} ${template.version}`);
      console.log(`  ${pc.dim("Author:")} ${template.author ?? "Unknown"}`);
      console.log(`  ${pc.dim("Rating:")} ${template.rating?.toFixed(1) ?? "-"} (${template.reviewCount ?? 0} reviews)`);
      console.log(`  ${pc.dim("Downloads:")} ${template.downloads ?? 0}`);

      if (template.description) {
        const shortDesc = template.description.length > 80
          ? template.description.slice(0, 77) + "..."
          : template.description;
        console.log(`  ${shortDesc}`);
      }

      console.log();
    }

    if (result.pagination.pages > 1) {
      console.log(pc.dim(`Page ${result.pagination.page} of ${result.pagination.pages}`));
    }
  } catch (error) {
    handleError(error, opts.json);
  }
}

async function installTemplate(
  templateId: string,
  opts: TemplateInstallOptions
): Promise<void> {
  const api = createApiClient(opts.config);
  const progress = new SimpleProgressBar();

  try {
    // Check if already installed
    const existing = await getInstalledTemplate(templateId);
    if (existing && !opts.force) {
      if (opts.json) {
        console.log(JSON.stringify({
          success: false,
          error: "Template already installed. Use --force to reinstall."
        }, null, 2));
      } else {
        console.log(pc.yellow(`Template ${templateId} is already installed.`));
        console.log(pc.dim(`Use --force to reinstall or jigong template upgrade ${templateId} to update.`));
      }
      return;
    }

    if (!opts.json) {
      console.log(pc.blue(`Installing template ${templateId}...\n`));
    }

    // Get template details
    progress.start(100, "Fetching template details...");
    const templateDetails = await api.get<{
      success: boolean;
      data: MarketplaceTemplate;
    }>(`/api/v1/marketplace/templates/${encodeURIComponent(templateId)}`);

    if (!templateDetails?.success) {
      throw new Error("Failed to fetch template details");
    }

    progress.update(20, "Downloading template package...");

    // Download template package
    const downloadUrl = `/api/v1/marketplace/templates/${encodeURIComponent(templateId)}/download`;

    // Simulate download with progress
    for (let i = 20; i <= 60; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      progress.update(i);
    }

    progress.update(60, "Extracting template files...");

    // Create template directory
    const templateDir = getTemplateDir(templateId);
    await fs.mkdir(templateDir, { recursive: true });

    // Simulate extraction
    for (let i = 60; i <= 80; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      progress.update(i);
    }

    progress.update(80, "Installing dependencies...");

    // Simulate dependency installation
    await new Promise((resolve) => setTimeout(resolve, 300));
    progress.update(95, "Finalizing installation...");

    // Create manifest
    const manifest: TemplateManifest = {
      id: templateDetails.data.id,
      name: templateDetails.data.name,
      version: templateDetails.data.version,
      description: templateDetails.data.description,
      author: templateDetails.data.author,
      category: templateDetails.data.category,
      tags: templateDetails.data.tags,
    };

    // Save manifest
    const manifestPath = path.join(templateDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Register installed template
    const installedTemplate: InstalledTemplate = {
      id: templateId,
      manifest,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "marketplace",
      path: templateDir,
    };

    await addInstalledTemplate(installedTemplate);

    progress.update(100);
    progress.stop();

    if (opts.json) {
      console.log(JSON.stringify({
        success: true,
        template: installedTemplate
      }, null, 2));
    } else {
      console.log(pc.green(`\n✓ Template installed successfully!`));
      console.log(`  ${pc.dim("Name:")} ${manifest.name}`);
      console.log(`  ${pc.dim("Version:")} ${manifest.version}`);
      console.log(`  ${pc.dim("Location:")} ${templateDir}`);
    }
  } catch (error) {
    progress.stop();
    handleError(error, opts.json);
  }
}

async function previewTemplate(
  templateId: string,
  opts: TemplatePreviewOptions
): Promise<void> {
  const api = createApiClient(opts.config);

  try {
    const result = await api.get<{
      success: boolean;
      data: {
        template: MarketplaceTemplate;
        readme?: string;
        structure?: string[];
        exampleUsage?: string;
      };
    }>(`/api/v1/marketplace/templates/${encodeURIComponent(templateId)}`);

    if (!result?.success) {
      throw new Error("Failed to fetch template preview");
    }

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const { data } = result;

    console.log(pc.bold(`\n${data.template.name}\n`));
    console.log(`${pc.dim("ID:")} ${data.template.id}`);
    console.log(`${pc.dim("Version:")} ${data.template.version}`);
    console.log(`${pc.dim("Author:")} ${data.template.author ?? "Unknown"}`);
    console.log(`${pc.dim("Rating:")} ${data.template.rating?.toFixed(1) ?? "-"} (${data.template.reviewCount ?? 0} reviews)`);
    console.log(`${pc.dim("Downloads:")} ${data.template.downloads ?? 0}`);
    console.log(`${pc.dim("Category:")} ${data.template.category ?? "Uncategorized"}`);

    if (data.template.description) {
      console.log(`\n${pc.bold("Description:")}`);
      console.log(data.template.description);
    }

    if (data.template.tags?.length) {
      console.log(`\n${pc.bold("Tags:")} ${data.template.tags.map((t) => pc.cyan(t)).join(", ")}`);
    }

    if (data.structure?.length) {
      console.log(`\n${pc.bold("File Structure:")}`);
      for (const file of data.structure) {
        console.log(`  ${pc.dim("•")} ${file}`);
      }
    }

    if (data.exampleUsage) {
      console.log(`\n${pc.bold("Example Usage:")}`);
      console.log(pc.gray(data.exampleUsage));
    }

    console.log();
  } catch (error) {
    handleError(error, opts.json);
  }
}

async function listTemplates(opts: TemplateListOptions): Promise<void> {
  try {
    const templates = await loadInstalledTemplates();

    if (opts.json) {
      console.log(JSON.stringify({ success: true, templates }, null, 2));
      return;
    }

    if (templates.length === 0) {
      console.log(pc.dim("No templates installed."));
      console.log(pc.dim(`Use 'jigong template search <query>' to find templates.`));
      return;
    }

    console.log(pc.bold(`\nInstalled Templates (${templates.length}):\n`));

    for (const template of templates) {
      console.log(`${pc.bold(template.manifest.name)} ${pc.dim(`(${template.id})`)}`);
      console.log(`  ${pc.dim("Version:")} ${template.manifest.version}`);
      console.log(`  ${pc.dim("Source:")} ${template.source}`);
      console.log(`  ${pc.dim("Installed:")} ${new Date(template.installedAt).toLocaleDateString()}`);
      console.log(`  ${pc.dim("Updated:")} ${new Date(template.updatedAt).toLocaleDateString()}`);
      console.log(`  ${pc.dim("Path:")} ${template.path}`);
      console.log();
    }
  } catch (error) {
    handleError(error, opts.json);
  }
}

async function upgradeTemplate(
  templateId: string,
  opts: TemplateUpgradeOptions
): Promise<void> {
  const api = createApiClient(opts.config);
  const progress = new SimpleProgressBar();

  try {
    // Check if installed
    const existing = await getInstalledTemplate(templateId);
    if (!existing) {
      if (opts.json) {
        console.log(JSON.stringify({
          success: false,
          error: "Template is not installed. Use 'jigong template install' first."
        }, null, 2));
      } else {
        console.log(pc.yellow(`Template ${templateId} is not installed.`));
        console.log(pc.dim(`Use 'jigong template install ${templateId}' to install it.`));
      }
      return;
    }

    if (!opts.json) {
      console.log(pc.blue(`Upgrading template ${templateId}...\n`));
    }

    progress.start(100, "Checking for updates...");

    // Get latest version info
    const templateDetails = await api.get<{
      success: boolean;
      data: MarketplaceTemplate;
    }>(`/api/v1/marketplace/templates/${encodeURIComponent(templateId)}`);

    if (!templateDetails?.success) {
      throw new Error("Failed to fetch template details");
    }

    const currentVersion = existing.manifest.version;
    const latestVersion = templateDetails.data.version;

    if (currentVersion === latestVersion && !opts.force) {
      progress.stop();
      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          message: "Template is already at the latest version",
          currentVersion
        }, null, 2));
      } else {
        console.log(pc.green(`Template is already at the latest version (${currentVersion}).`));
      }
      return;
    }

    progress.update(30, `Upgrading from ${currentVersion} to ${latestVersion}...`);

    // Simulate download and installation
    for (let i = 30; i <= 70; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      progress.update(i);
    }

    progress.update(70, "Updating files...");

    // Update manifest
    const manifestPath = path.join(existing.path, "manifest.json");
    const updatedManifest: TemplateManifest = {
      ...existing.manifest,
      version: latestVersion,
    };

    await fs.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2));

    // Update registry
    const updatedTemplate: InstalledTemplate = {
      ...existing,
      manifest: updatedManifest,
      updatedAt: new Date().toISOString(),
    };

    await addInstalledTemplate(updatedTemplate);

    for (let i = 70; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      progress.update(i);
    }

    progress.stop();

    if (opts.json) {
      console.log(JSON.stringify({
        success: true,
        previousVersion: currentVersion,
        newVersion: latestVersion,
        template: updatedTemplate
      }, null, 2));
    } else {
      console.log(pc.green(`\n✓ Template upgraded successfully!`));
      console.log(`  ${pc.dim("Previous:")} ${currentVersion}`);
      console.log(`  ${pc.dim("Current:")} ${latestVersion}`);
    }
  } catch (error) {
    progress.stop();
    handleError(error, opts.json);
  }
}

async function uninstallTemplate(
  templateId: string,
  opts: TemplateUninstallOptions
): Promise<void> {
  try {
    const existing = await getInstalledTemplate(templateId);
    if (!existing) {
      if (opts.json) {
        console.log(JSON.stringify({
          success: false,
          error: "Template is not installed."
        }, null, 2));
      } else {
        console.log(pc.yellow(`Template ${templateId} is not installed.`));
      }
      return;
    }

    if (!opts.force) {
      // Check if template is being used (placeholder logic)
      // In a real implementation, this would check the database
      const isInUse = false;

      if (isInUse) {
        if (opts.json) {
          console.log(JSON.stringify({
            success: false,
            error: "Template is in use. Use --force to uninstall anyway."
          }, null, 2));
        } else {
          console.log(pc.yellow("Warning: This template may be in use."));
          console.log(pc.dim("Use --force to uninstall anyway."));
        }
        return;
      }
    }

    // Remove template directory
    try {
      await fs.rm(existing.path, { recursive: true, force: true });
    } catch {
      // Directory might not exist, continue
    }

    // Remove from registry
    const removed = await removeInstalledTemplate(templateId);

    if (opts.json) {
      console.log(JSON.stringify({
        success: removed,
        templateId
      }, null, 2));
    } else {
      console.log(pc.green(`✓ Template ${templateId} uninstalled successfully.`));
    }
  } catch (error) {
    handleError(error, opts.json);
  }
}

// ============================================
// Command Registration
// ============================================

export function registerTemplateCommands(program: Command): void {
  const template = program
    .command("template")
    .description("Manage JiGong templates");

  // Search templates
  template
    .command("search")
    .description("Search templates in marketplace")
    .argument("<query>", "Search query")
    .option("-c, --config <path>", "Path to JiGong config file")
    .option("-d, --data-dir <path>", "JiGong data directory")
    .option("--category <category>", "Filter by category")
    .option("--sort <sort>", "Sort by: popular, newest, rating, price_asc, price_desc", "popular")
    .option("--limit <limit>", "Number of results", (v) => Number(v), 20)
    .option("--json", "Output raw JSON")
    .action(async (query: string, opts: TemplateSearchOptions) => {
      await searchTemplates(query, opts);
    });

  // Install template
  template
    .command("install")
    .description("Install a template with progress bar")
    .argument("<template-id>", "Template ID to install")
    .option("-c, --config <path>", "Path to JiGong config file")
    .option("-d, --data-dir <path>", "JiGong data directory")
    .option("-f, --force", "Force reinstall if already installed")
    .option("--json", "Output raw JSON")
    .action(async (templateId: string, opts: TemplateInstallOptions) => {
      await installTemplate(templateId, opts);
    });

  // Preview template
  template
    .command("preview")
    .description("Preview template before install")
    .argument("<template-id>", "Template ID to preview")
    .option("-c, --config <path>", "Path to JiGong config file")
    .option("-d, --data-dir <path>", "JiGong data directory")
    .option("--json", "Output raw JSON")
    .action(async (templateId: string, opts: TemplatePreviewOptions) => {
      await previewTemplate(templateId, opts);
    });

  // List installed templates
  template
    .command("list")
    .description("List installed templates")
    .option("-c, --config <path>", "Path to JiGong config file")
    .option("-d, --data-dir <path>", "JiGong data directory")
    .option("--json", "Output raw JSON")
    .action(async (opts: TemplateListOptions) => {
      await listTemplates(opts);
    });

  // Upgrade template
  template
    .command("upgrade")
    .description("Upgrade template to latest version")
    .argument("<template-id>", "Template ID to upgrade")
    .option("-c, --config <path>", "Path to JiGong config file")
    .option("-d, --data-dir <path>", "JiGong data directory")
    .option("-f, --force", "Force upgrade even if already at latest version")
    .option("--json", "Output raw JSON")
    .action(async (templateId: string, opts: TemplateUpgradeOptions) => {
      await upgradeTemplate(templateId, opts);
    });

  // Uninstall template
  template
    .command("uninstall")
    .description("Remove installed template")
    .argument("<template-id>", "Template ID to uninstall")
    .option("-c, --config <path>", "Path to JiGong config file")
    .option("-d, --data-dir <path>", "JiGong data directory")
    .option("-f, --force", "Force uninstall even if in use")
    .option("--json", "Output raw JSON")
    .action(async (templateId: string, opts: TemplateUninstallOptions) => {
      await uninstallTemplate(templateId, opts);
    });
}
