import { eq, and } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { skillRegistry, skillSources } from "@jigongai/db";
import { SKILL_CATEGORIES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

// External source types
const SOURCE_TYPES = ["skillsh", "skillhub", "github", "builtin"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

function validateSourceType(source: string): SourceType {
  if (!(SOURCE_TYPES as readonly string[]).includes(source)) {
    throw unprocessable(
      `Invalid source '${source}'. Must be one of: ${SOURCE_TYPES.join(", ")}`,
    );
  }
  return source as SourceType;
}

function validateCategory(category: string): void {
  if (!(SKILL_CATEGORIES as readonly string[]).includes(category)) {
    throw unprocessable(
      `Invalid category '${category}'. Must be one of: ${SKILL_CATEGORIES.join(", ")}`,
    );
  }
}

/**
 * Parse GitHub repository identifier
 * Format: "owner/repo" or "owner/repo/path/to/skill"
 */
function parseGitHubIdentifier(identifier: string): {
  owner: string;
  repo: string;
  path: string;
  branch: string;
} {
  const parts = identifier.split("/");
  if (parts.length < 2) {
    throw unprocessable(
      "Invalid GitHub identifier. Format: 'owner/repo' or 'owner/repo/path/to/skill'",
    );
  }

  const [owner, repo, ...pathParts] = parts;
  const path = pathParts.join("/");

  // Extract branch if specified (e.g., owner/repo:branch or owner/repo/path:branch)
  let branch = "main";
  const branchMatch = identifier.match(/:([^/]+)$/);
  if (branchMatch) {
    branch = branchMatch[1];
  }

  return { owner, repo, path: path.replace(/:[^/]+$/, ""), branch };
}

/**
 * Build GitHub raw content URL
 */
function buildGitHubRawUrl(
  owner: string,
  repo: string,
  path: string,
  branch: string,
): string {
  const cleanPath = path ? `${path}/SKILL.md` : "SKILL.md";
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`;
}

/**
 * Build GitHub repository URL
 */
function buildGitHubRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Parse SKILL.md frontmatter
 * Simple parser for YAML frontmatter in markdown files
 */
function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
} {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) {
    // Try to extract from content without frontmatter
    const nameMatch = content.match(/^#\s*(.+)/m);
    return {
      name: nameMatch?.[1]?.trim() ?? "Unnamed Skill",
      description: "",
      category: "custom",
      version: "1.0.0",
      author: "",
    };
  }

  const frontmatter = frontmatterMatch[1];
  const result = {
    name: "",
    description: "",
    category: "custom",
    version: "1.0.0",
    author: "",
  };

  // Parse simple key: value pairs
  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (key === "name") result.name = value.trim();
      if (key === "description") result.description = value.trim();
      if (key === "category") result.category = value.trim();
      if (key === "version") result.version = value.trim();
      if (key === "author") result.author = value.trim();
    }
  }

  // Extract name from first heading if not in frontmatter
  if (!result.name) {
    const nameMatch = content.match(/^#\s*(.+)/m);
    result.name = nameMatch?.[1]?.trim() ?? "Unnamed Skill";
  }

  return result;
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function skillInstallerService(db: Db) {
  /**
   * Fetch content from URL
   */
  async function fetchContent(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw unprocessable(`Failed to fetch from ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if skill already exists from this source
   */
  async function findExistingSource(
    companyId: string,
    sourceType: SourceType,
    externalId: string,
  ) {
    return db
      .select()
      .from(skillSources)
      .where(
        and(
          eq(skillSources.companyId, companyId),
          eq(skillSources.sourceType, sourceType),
          eq(skillSources.externalId, externalId),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  return {
    /**
     * Install skill from GitHub
     * @param companyId Company ID
     * @param identifier Format: "owner/repo" or "owner/repo/path/to/skill"
     * @returns Created skill registry entry
     */
    installFromGitHub: async (companyId: string, identifier: string) => {
      const { owner, repo, path, branch } = parseGitHubIdentifier(identifier);
      const externalId = `${owner}/${repo}${path ? `/${path}` : ""}`;

      // Check for existing
      const existing = await findExistingSource(companyId, "github", externalId);
      if (existing) {
        throw unprocessable(`Skill from ${externalId} is already installed`);
      }

      // Fetch SKILL.md from GitHub
      const rawUrl = buildGitHubRawUrl(owner, repo, path, branch);
      const content = await fetchContent(rawUrl);

      // Parse metadata
      const metadata = parseSkillFrontmatter(content);
      if (!metadata.name) {
        metadata.name = repo;
      }

      // Validate category
      validateCategory(metadata.category);

      const slug = generateSlug(metadata.name);
      const repoUrl = buildGitHubRepoUrl(owner, repo);

      // Create skill registry entry
      const skill = await db
        .insert(skillRegistry)
        .values({
          companyId,
          name: metadata.name,
          slug,
          description: metadata.description,
          content,
          category: metadata.category,
          version: metadata.version,
          author: metadata.author || `${owner}/${repo}`,
          isBuiltin: false,
          sourceType: "github",
          sourceUrl: repoUrl,
          externalId,
          lastSyncedAt: new Date(),
          metadata: {
            githubOwner: owner,
            githubRepo: repo,
            githubPath: path,
            githubBranch: branch,
          },
        })
        .returning()
        .then((rows) => rows[0]);

      // Create source tracking entry
      await db.insert(skillSources).values({
        companyId,
        skillRegistryId: skill.id,
        sourceType: "github",
        sourceUrl: repoUrl,
        externalId,
        name: metadata.name,
        slug,
        description: metadata.description,
        version: metadata.version,
        externalVersion: metadata.version,
        githubOwner: owner,
        githubRepo: repo,
        githubPath: path,
        githubBranch: branch,
        author: metadata.author || `${owner}/${repo}`,
        category: metadata.category,
        lastSyncedAt: new Date(),
        syncStatus: "synced",
      });

      return skill;
    },

    /**
     * Install skill from skill.sh
     * @param companyId Company ID
     * @param skillSlug Skill slug on skill.sh
     * @returns Created skill registry entry
     */
    installFromSkillSh: async (companyId: string, skillSlug: string) => {
      const externalId = skillSlug.toLowerCase().trim();

      // Check for existing
      const existing = await findExistingSource(companyId, "skillsh", externalId);
      if (existing) {
        throw unprocessable(`Skill ${externalId} is already installed from skill.sh`);
      }

      // Fetch from skill.sh API
      // Note: This is a placeholder for the actual skill.sh API
      const apiUrl = `https://skill.sh/api/skills/${externalId}`;
      const rawUrl = `https://skill.sh/skills/${externalId}/SKILL.md`;

      let skillData;
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        skillData = await response.json();
      } catch {
        // Fallback: fetch raw markdown directly
        const content = await fetchContent(rawUrl);
        const metadata = parseSkillFrontmatter(content);

        skillData = {
          name: metadata.name || externalId,
          description: metadata.description,
          category: metadata.category,
          version: metadata.version,
          author: metadata.author,
          content,
        };
      }

      validateCategory(skillData.category || "custom");

      const slug = generateSlug(skillData.name);
      const sourceUrl = `https://skill.sh/skills/${externalId}`;

      // Create skill registry entry
      const skill = await db
        .insert(skillRegistry)
        .values({
          companyId,
          name: skillData.name,
          slug,
          description: skillData.description || null,
          content: skillData.content,
          category: skillData.category || "custom",
          version: skillData.version || "1.0.0",
          author: skillData.author || "skill.sh",
          isBuiltin: false,
          sourceType: "skillsh",
          sourceUrl,
          externalId,
          lastSyncedAt: new Date(),
          metadata: { skillShSlug: externalId },
        })
        .returning()
        .then((rows) => rows[0]);

      // Create source tracking entry
      await db.insert(skillSources).values({
        companyId,
        skillRegistryId: skill.id,
        sourceType: "skillsh",
        sourceUrl,
        externalId,
        name: skillData.name,
        slug,
        description: skillData.description || null,
        version: skillData.version || "1.0.0",
        externalVersion: skillData.version || "1.0.0",
        author: skillData.author || "skill.sh",
        category: skillData.category || "custom",
        lastSyncedAt: new Date(),
        syncStatus: "synced",
      });

      return skill;
    },

    /**
     * Install skill from SkillHub
     * @param companyId Company ID
     * @param skillId Skill ID on SkillHub
     * @returns Created skill registry entry
     */
    installFromSkillHub: async (companyId: string, skillId: string) => {
      const externalId = skillId.trim();

      // Check for existing
      const existing = await findExistingSource(companyId, "skillhub", externalId);
      if (existing) {
        throw unprocessable(`Skill ${externalId} is already installed from SkillHub`);
      }

      // Fetch from SkillHub API
      // Note: This is a placeholder for the actual SkillHub API
      const apiUrl = `https://api.skillhub.dev/v1/skills/${externalId}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw unprocessable(`Failed to fetch skill from SkillHub: HTTP ${response.status}`);
      }

      const skillData = await response.json();

      validateCategory(skillData.category || "custom");

      const slug = generateSlug(skillData.name);
      const sourceUrl = `https://skillhub.dev/skills/${externalId}`;

      // Create skill registry entry
      const skill = await db
        .insert(skillRegistry)
        .values({
          companyId,
          name: skillData.name,
          slug,
          description: skillData.description || null,
          content: skillData.content,
          category: skillData.category || "custom",
          version: skillData.version || "1.0.0",
          author: skillData.author || "SkillHub",
          isBuiltin: false,
          sourceType: "skillhub",
          sourceUrl,
          externalId,
          lastSyncedAt: new Date(),
          metadata: { skillHubId: externalId },
        })
        .returning()
        .then((rows) => rows[0]);

      // Create source tracking entry
      await db.insert(skillSources).values({
        companyId,
        skillRegistryId: skill.id,
        sourceType: "skillhub",
        sourceUrl,
        externalId,
        name: skillData.name,
        slug,
        description: skillData.description || null,
        version: skillData.version || "1.0.0",
        externalVersion: skillData.version || "1.0.0",
        author: skillData.author || "SkillHub",
        category: skillData.category || "custom",
        lastSyncedAt: new Date(),
        syncStatus: "synced",
      });

      return skill;
    },

    /**
     * Sync/update an external skill to latest version
     * @param companyId Company ID
     * @param skillId Skill registry ID
     * @returns Updated skill
     */
    syncExternalSkill: async (companyId: string, skillId: string) => {
      // Get skill and source info
      const skill = await db
        .select()
        .from(skillRegistry)
        .where(and(eq(skillRegistry.id, skillId), eq(skillRegistry.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!skill) {
        throw notFound("Skill not found");
      }

      if (!skill.sourceType || !skill.externalId) {
        throw unprocessable("Skill was not installed from an external source");
      }

      // Get source details
      const source = await db
        .select()
        .from(skillSources)
        .where(
          and(
            eq(skillSources.skillRegistryId, skillId),
            eq(skillSources.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      let newContent: string;
      let newVersion: string | undefined;

      try {
        switch (skill.sourceType) {
          case "github": {
            const metadata = skill.metadata as Record<string, string> | null;
            const owner = metadata?.githubOwner ?? "";
            const repo = metadata?.githubRepo ?? "";
            const path = metadata?.githubPath ?? "";
            const branch = metadata?.githubBranch ?? "main";
            const rawUrl = buildGitHubRawUrl(owner, repo, path, branch);
            newContent = await fetchContent(rawUrl);
            const parsed = parseSkillFrontmatter(newContent);
            newVersion = parsed.version;
            break;
          }
          case "skillsh": {
            const slug = (skill.metadata as Record<string, string>)?.skillShSlug ?? skill.externalId;
            const rawUrl = `https://skill.sh/skills/${slug}/SKILL.md`;
            newContent = await fetchContent(rawUrl);
            const parsed = parseSkillFrontmatter(newContent);
            newVersion = parsed.version;
            break;
          }
          case "skillhub": {
            const apiUrl = `https://api.skillhub.dev/v1/skills/${skill.externalId}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            newContent = data.content;
            newVersion = data.version;
            break;
          }
          default:
            throw unprocessable(`Unsupported source type: ${skill.sourceType}`);
        }
      } catch (error) {
        // Update source with error status
        if (source) {
          await db
            .update(skillSources)
            .set({
              syncStatus: "error",
              syncError: error instanceof Error ? error.message : String(error),
              updatedAt: new Date(),
            })
            .where(eq(skillSources.id, source.id));
        }
        throw error;
      }

      // Update skill registry
      const updatedSkill = await db
        .update(skillRegistry)
        .set({
          content: newContent,
          version: newVersion ?? skill.version,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(skillRegistry.id, skillId))
        .returning()
        .then((rows) => rows[0]);

      // Update source tracking
      if (source) {
        await db
          .update(skillSources)
          .set({
            externalVersion: newVersion ?? source.externalVersion,
            lastSyncedAt: new Date(),
            syncStatus: "synced",
            syncError: null,
            updatedAt: new Date(),
          })
          .where(eq(skillSources.id, source.id));
      }

      return updatedSkill;
    },

    /**
     * List all external skill sources for a company
     * @param companyId Company ID
     * @returns List of skill sources
     */
    listExternalSources: async (companyId: string) => {
      return db
        .select()
        .from(skillSources)
        .where(eq(skillSources.companyId, companyId))
        .orderBy(skillSources.createdAt);
    },

    /**
     * Search skills on external registries
     * @param companyId Company ID
     * @param source Source type
     * @param query Search query
     * @returns Search results
     */
    searchExternalSkills: async (
      companyId: string,
      source: SourceType,
      query: string,
    ): Promise<Array<{
      name: string;
      slug: string;
      description: string;
      version: string;
      author: string;
      category: string;
      sourceUrl: string;
    }>> => {
      // Validate source type
      validateSourceType(source);

      // Search on external source
      switch (source) {
        case "github": {
          // GitHub search via API
          // https://docs.github.com/en/rest/search
          const searchUrl = `https://api.github.com/search/code?q=${encodeURIComponent(
            query + " filename:SKILL.md"
          )}`;

          try {
            const response = await fetch(searchUrl, {
              headers: { Accept: "application/vnd.github.v3+json" },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data.items?.map((item: {
              repository: { full_name: string };
              path: string;
              html_url: string;
            }) => ({
              name: item.repository.full_name.split("/")[1],
              slug: generateSlug(item.repository.full_name),
              description: `GitHub: ${item.repository.full_name}`,
              version: "unknown",
              author: item.repository.full_name.split("/")[0],
              category: "custom",
              sourceUrl: item.html_url,
            })) ?? [];
          } catch {
            return [];
          }
        }
        case "skillsh": {
          // Placeholder for skill.sh search
          // const searchUrl = `https://skill.sh/api/skills/search?q=${encodeURIComponent(query)}`;
          return [];
        }
        case "skillhub": {
          // Placeholder for SkillHub search
          // const searchUrl = `https://api.skillhub.dev/v1/skills/search?q=${encodeURIComponent(query)}`;
          return [];
        }
        default:
          return [];
      }
    },
  };
}
