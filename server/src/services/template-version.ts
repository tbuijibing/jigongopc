import type { Db } from "@jigongai/db";
import { eq, and, desc, asc } from "drizzle-orm";
import {
  companyTemplates,
  templateLineages,
} from "@jigongai/db";

// Semver types and interfaces
export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: string;
  semver: SemverParts;
  createdAt: Date;
  createdBy: string;
  changelog?: string;
  isLatest: boolean;
}

export interface VersionDiff {
  fromVersion: string;
  toVersion: string;
  changeType: "major" | "minor" | "patch" | "prerelease" | "none";
  breaking: boolean;
  changes: {
    workflows: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    roles: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    variables: {
      added: string[];
      removed: string[];
      modified: string[];
    };
    integrations: {
      added: string[];
      removed: string[];
      modified: string[];
    };
  };
  summary: string;
}

export interface UpgradeInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  latestVersionId: string | null;
  changeType: "major" | "minor" | "patch" | "prerelease" | "none";
  breaking: boolean;
  upgradePath: string[];
  releaseNotes?: string;
}

export interface MergedTemplate {
  id: string;
  name: string;
  version: string;
  baseVersion: string;
  customVersion: string;
  mergedAt: Date;
  conflicts: Array<{
    path: string;
    baseValue: unknown;
    customValue: unknown;
    newValue: unknown;
    resolved: boolean;
    resolution?: "base" | "custom" | "new" | "merged";
  }>;
  templatePackage: unknown;
}

// Semver regex pattern (simplified but comprehensive)
const SEMVER_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Validate semver format
 * Supports: 1.2.3, 2.0.0-beta.1, 1.0.0+build.123, 1.0.0-alpha+exp.sha.5114f85
 */
export function validateSemver(version: string): boolean {
  if (!version || typeof version !== "string") {
    return false;
  }
  return SEMVER_REGEX.test(version);
}

/**
 * Parse semver string into parts
 */
export function parseSemver(version: string): SemverParts {
  if (!validateSemver(version)) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const match = version.match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Failed to parse semver version: ${version}`);
  }

  const [, major, minor, patch, prereleaseStr, buildStr] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prereleaseStr ? prereleaseStr.split(".") : [],
    build: buildStr ? buildStr.split(".") : [],
  };
}

/**
 * Compare two prerelease identifiers
 * Returns: negative if a < b, positive if a > b, 0 if equal
 */
function comparePrerelease(a: string, b: string): number {
  const aNum = parseInt(a, 10);
  const bNum = parseInt(b, 10);

  const aIsNum = !isNaN(aNum);
  const bIsNum = !isNaN(bNum);

  if (aIsNum && bIsNum) {
    return aNum - bNum;
  }

  if (aIsNum && !bIsNum) {
    return -1;
  }

  if (!aIsNum && bIsNum) {
    return 1;
  }

  return a.localeCompare(b);
}

/**
 * Compare two versions
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const s1 = parseSemver(v1);
  const s2 = parseSemver(v2);

  // Compare major, minor, patch
  if (s1.major !== s2.major) {
    return s1.major > s2.major ? 1 : -1;
  }

  if (s1.minor !== s2.minor) {
    return s1.minor > s2.minor ? 1 : -1;
  }

  if (s1.patch !== s2.patch) {
    return s1.patch > s2.patch ? 1 : -1;
  }

  // Handle prerelease comparison
  // A version without prerelease has higher precedence than one with prerelease
  if (s1.prerelease.length === 0 && s2.prerelease.length > 0) {
    return 1;
  }

  if (s1.prerelease.length > 0 && s2.prerelease.length === 0) {
    return -1;
  }

  // Compare prerelease identifiers
  const maxLength = Math.max(s1.prerelease.length, s2.prerelease.length);
  for (let i = 0; i < maxLength; i++) {
    const p1 = s1.prerelease[i];
    const p2 = s2.prerelease[i];

    if (p1 === undefined && p2 !== undefined) {
      return -1;
    }

    if (p1 !== undefined && p2 === undefined) {
      return 1;
    }

    const cmp = comparePrerelease(p1, p2);
    if (cmp !== 0) {
      return cmp;
    }
  }

  return 0;
}

/**
 * Determine change type between two versions
 */
function getChangeType(from: SemverParts, to: SemverParts): "major" | "minor" | "patch" | "prerelease" | "none" {
  if (from.major !== to.major) {
    return "major";
  }

  if (from.minor !== to.minor) {
    return "minor";
  }

  if (from.patch !== to.patch) {
    return "patch";
  }

  // Check prerelease changes
  const fromPre = from.prerelease.join(".");
  const toPre = to.prerelease.join(".");
  if (fromPre !== toPre) {
    return "prerelease";
  }

  return "none";
}

/**
 * Check if a change is breaking
 * Major version changes are always breaking
 * Prerelease changes may be breaking depending on context
 */
function isBreakingChange(from: SemverParts, to: SemverParts): boolean {
  const changeType = getChangeType(from, to);

  if (changeType === "major") {
    return true;
  }

  // Minor or patch changes within same major are typically non-breaking
  if (changeType === "minor" || changeType === "patch") {
    return false;
  }

  // Prerelease changes could be breaking
  if (changeType === "prerelease") {
    // If going from stable to prerelease, consider it potentially breaking
    if (from.prerelease.length === 0 && to.prerelease.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Template Version Management Service
 */
export function templateVersionService(db: Db) {
  return {
    // ========== Version Validation ==========

    /**
     * Validate semver format
     */
    validateSemver(version: string): boolean {
      return validateSemver(version);
    },

    /**
     * Parse semver into parts
     */
    parseSemver(version: string): SemverParts {
      return parseSemver(version);
    },

    /**
     * Compare two versions
     */
    compareVersions(v1: string, v2: string): number {
      return compareVersions(v1, v2);
    },

    // ========== Version History ==========

    /**
     * Get all versions of a template
     */
    async getVersionHistory(templateId: string): Promise<TemplateVersion[]> {
      const lineage = await db.query.templateLineages.findMany({
        where: eq(templateLineages.templateId, templateId),
        orderBy: [desc(templateLineages.createdAt)],
      });

      if (lineage.length === 0) {
        // Check if template exists and return it as single version
        const template = await db.query.companyTemplates.findFirst({
          where: eq(companyTemplates.id, templateId),
        });

        if (!template) {
          return [];
        }

        return [{
          id: template.id,
          templateId: template.id,
          version: template.version,
          semver: parseSemver(template.version),
          createdAt: template.createdAt,
          createdBy: template.createdBy,
          isLatest: true,
        }];
      }

      // Get latest version info
      const latestVersion = await this.getLatestVersion(templateId);

      return lineage.map((entry) => ({
        id: entry.id,
        templateId: entry.templateId,
        version: entry.version,
        semver: parseSemver(entry.version),
        createdAt: entry.createdAt,
        createdBy: entry.createdBy,
        changelog: entry.changeNotes || undefined,
        isLatest: entry.version === latestVersion?.version,
      }));
    },

    /**
     * Get the latest version of a template
     */
    async getLatestVersion(templateId: string): Promise<TemplateVersion | null> {
      // First check template lineage
      const [latestLineage] = await db
        .select()
        .from(templateLineages)
        .where(eq(templateLineages.templateId, templateId))
        .orderBy(desc(templateLineages.createdAt))
        .limit(1);

      if (latestLineage) {
        return {
          id: latestLineage.id,
          templateId: latestLineage.templateId,
          version: latestLineage.version,
          semver: parseSemver(latestLineage.version),
          createdAt: latestLineage.createdAt,
          createdBy: latestLineage.createdBy,
          changelog: latestLineage.changeNotes || undefined,
          isLatest: true,
        };
      }

      // Fallback to template itself
      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, templateId),
      });

      if (!template) {
        return null;
      }

      return {
        id: template.id,
        templateId: template.id,
        version: template.version,
        semver: parseSemver(template.version),
        createdAt: template.createdAt,
        createdBy: template.createdBy,
        isLatest: true,
      };
    },

    /**
     * Get a specific version of a template
     */
    async getVersionAt(templateId: string, version: string): Promise<TemplateVersion | null> {
      if (!validateSemver(version)) {
        throw new Error(`Invalid version format: ${version}`);
      }

      // Check lineage first
      const [lineageEntry] = await db
        .select()
        .from(templateLineages)
        .where(
          and(
            eq(templateLineages.templateId, templateId),
            eq(templateLineages.version, version)
          )
        )
        .limit(1);

      if (lineageEntry) {
        const latestVersion = await this.getLatestVersion(templateId);

        return {
          id: lineageEntry.id,
          templateId: lineageEntry.templateId,
          version: lineageEntry.version,
          semver: parseSemver(lineageEntry.version),
          createdAt: lineageEntry.createdAt,
          createdBy: lineageEntry.createdBy,
          changelog: lineageEntry.changeNotes || undefined,
          isLatest: version === latestVersion?.version,
        };
      }

      // Check if current template matches
      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, templateId),
      });

      if (template && template.version === version) {
        const latestVersion = await this.getLatestVersion(templateId);

        return {
          id: template.id,
          templateId: template.id,
          version: template.version,
          semver: parseSemver(template.version),
          createdAt: template.createdAt,
          createdBy: template.createdBy,
          isLatest: version === latestVersion?.version,
        };
      }

      return null;
    },

    // ========== Version Comparison ==========

    /**
     * Compare two versions in detail
     */
    async compareVersionsDetailed(
      fromVersion: string,
      toVersion: string
    ): Promise<VersionDiff> {
      const from = parseSemver(fromVersion);
      const to = parseSemver(toVersion);

      const changeType = getChangeType(from, to);
      const breaking = isBreakingChange(from, to);

      // For detailed comparison, we'd need the actual template data
      // This is a placeholder implementation
      const changes: VersionDiff["changes"] = {
        workflows: { added: [], removed: [], modified: [] },
        roles: { added: [], removed: [], modified: [] },
        variables: { added: [], removed: [], modified: [] },
        integrations: { added: [], removed: [], modified: [] },
      };

      // Generate summary based on change type
      let summary = "";
      switch (changeType) {
        case "major":
          summary = `Breaking change: Major version bump from ${fromVersion} to ${toVersion}. This may require manual intervention.`;
          break;
        case "minor":
          summary = `New features: Minor version bump from ${fromVersion} to ${toVersion}. Backward compatible additions.`;
          break;
        case "patch":
          summary = `Bug fixes: Patch version bump from ${fromVersion} to ${toVersion}. Backward compatible fixes.`;
          break;
        case "prerelease":
          summary = `Prerelease update from ${fromVersion} to ${toVersion}. May contain unstable changes.`;
          break;
        default:
          summary = `No changes between ${fromVersion} and ${toVersion}.`;
      }

      return {
        fromVersion,
        toVersion,
        changeType,
        breaking,
        changes,
        summary,
      };
    },

    /**
     * Generate a changelog between two versions
     */
    async generateChangelog(
      templateId: string,
      fromVersion: string,
      toVersion: string
    ): Promise<string> {
      const diff = await this.compareVersionsDetailed(fromVersion, toVersion);

      // Get lineage entries for changelog
      const lineage = await db.query.templateLineages.findMany({
        where: eq(templateLineages.templateId, templateId),
        orderBy: [asc(templateLineages.createdAt)],
      });

      const relevantVersions = lineage.filter((entry) => {
        const cmpFrom = compareVersions(entry.version, fromVersion);
        const cmpTo = compareVersions(entry.version, toVersion);
        return cmpFrom > 0 && cmpTo <= 0;
      });

      let changelog = `# Changelog: ${fromVersion} -> ${toVersion}\n\n`;
      changelog += `## Summary\n${diff.summary}\n\n`;

      if (diff.breaking) {
        changelog += `⚠️ **BREAKING CHANGES** ⚠️\n\n`;
        changelog += `This upgrade contains breaking changes. Please review carefully before upgrading.\n\n`;
      }

      if (relevantVersions.length > 0) {
        changelog += `## Changes\n\n`;
        for (const version of relevantVersions) {
          changelog += `### ${version.version}\n`;
          if (version.changeNotes) {
            changelog += `${version.changeNotes}\n`;
          } else {
            changelog += `_No notes provided_\n`;
          }
          changelog += `\n`;
        }
      }

      // Add changes breakdown
      changelog += `## Detailed Changes\n\n`;

      if (diff.changes.workflows.added.length || diff.changes.workflows.removed.length || diff.changes.workflows.modified.length) {
        changelog += `### Workflows\n`;
        for (const item of diff.changes.workflows.added) {
          changelog += `- Added: ${item}\n`;
        }
        for (const item of diff.changes.workflows.removed) {
          changelog += `- Removed: ${item}\n`;
        }
        for (const item of diff.changes.workflows.modified) {
          changelog += `- Modified: ${item}\n`;
        }
        changelog += `\n`;
      }

      if (diff.changes.roles.added.length || diff.changes.roles.removed.length || diff.changes.roles.modified.length) {
        changelog += `### Roles\n`;
        for (const item of diff.changes.roles.added) {
          changelog += `- Added: ${item}\n`;
        }
        for (const item of diff.changes.roles.removed) {
          changelog += `- Removed: ${item}\n`;
        }
        for (const item of diff.changes.roles.modified) {
          changelog += `- Modified: ${item}\n`;
        }
        changelog += `\n`;
      }

      if (diff.changes.variables.added.length || diff.changes.variables.removed.length || diff.changes.variables.modified.length) {
        changelog += `### Variables\n`;
        for (const item of diff.changes.variables.added) {
          changelog += `- Added: ${item}\n`;
        }
        for (const item of diff.changes.variables.removed) {
          changelog += `- Removed: ${item}\n`;
        }
        for (const item of diff.changes.variables.modified) {
          changelog += `- Modified: ${item}\n`;
        }
        changelog += `\n`;
      }

      return changelog;
    },

    // ========== Upgrade Management ==========

    /**
     * Check if an upgrade is available
     */
    async checkUpgradeAvailable(
      templateId: string,
      currentVersion: string
    ): Promise<UpgradeInfo> {
      const current = await this.getVersionAt(templateId, currentVersion);
      const latest = await this.getLatestVersion(templateId);

      if (!current) {
        throw new Error(`Current version ${currentVersion} not found for template ${templateId}`);
      }

      if (!latest) {
        return {
          available: false,
          currentVersion,
          latestVersion: currentVersion,
          latestVersionId: null,
          changeType: "none",
          breaking: false,
          upgradePath: [],
        };
      }

      const cmp = compareVersions(currentVersion, latest.version);

      if (cmp >= 0) {
        return {
          available: false,
          currentVersion,
          latestVersion: latest.version,
          latestVersionId: latest.id,
          changeType: "none",
          breaking: false,
          upgradePath: [],
        };
      }

      const diff = await this.compareVersionsDetailed(currentVersion, latest.version);
      const upgradePath = await this.calculateUpgradePath(currentVersion, latest.version);

      return {
        available: true,
        currentVersion,
        latestVersion: latest.version,
        latestVersionId: latest.id,
        changeType: diff.changeType,
        breaking: diff.breaking,
        upgradePath,
        releaseNotes: latest.changelog,
      };
    },

    /**
     * Calculate upgrade path between versions
     */
    async calculateUpgradePath(
      fromVersion: string,
      toVersion: string
    ): Promise<string[]> {
      const from = parseSemver(fromVersion);
      const to = parseSemver(toVersion);

      // If same version, no path needed
      if (compareVersions(fromVersion, toVersion) === 0) {
        return [];
      }

      // If going backward, return empty
      if (compareVersions(fromVersion, toVersion) > 0) {
        return [];
      }

      const path: string[] = [];

      // For major version changes, we need to go through each major version
      if (from.major < to.major) {
        // First go to next major.0.0
        path.push(`${from.major + 1}.0.0`);

        // Then fill in intermediate majors
        for (let major = from.major + 1; major < to.major; major++) {
          path.push(`${major + 1}.0.0`);
        }

        // Finally, if target is not x.0.0, add the target
        if (to.minor > 0 || to.patch > 0 || to.prerelease.length > 0) {
          path.push(toVersion);
        }
      } else if (from.minor < to.minor) {
        // Same major, different minor
        // Go through each minor version
        for (let minor = from.minor + 1; minor <= to.minor; minor++) {
          if (minor === to.minor && to.patch === 0 && to.prerelease.length === 0) {
            path.push(`${to.major}.${minor}.0`);
          } else if (minor < to.minor) {
            path.push(`${to.major}.${minor}.0`);
          }
        }

        if (to.patch > 0 || to.prerelease.length > 0) {
          path.push(toVersion);
        }
      } else if (from.patch < to.patch) {
        // Same major and minor, different patch
        // Go through each patch version
        for (let patch = from.patch + 1; patch <= to.patch; patch++) {
          path.push(`${to.major}.${to.minor}.${patch}`);
        }
      } else if (from.prerelease.length > 0 || to.prerelease.length > 0) {
        // Handle prerelease transitions
        path.push(toVersion);
      }

      return path;
    },

    /**
     * Preserve user customizations during upgrade
     */
    async preserveCustomizations(
      oldTemplate: unknown,
      newTemplate: unknown
    ): Promise<MergedTemplate> {
      const old = oldTemplate as Record<string, unknown>;
      const new_ = newTemplate as Record<string, unknown>;

      const conflicts: MergedTemplate["conflicts"] = [];
      const mergedTemplate = { ...new_ };

      // Deep merge function
      const deepMerge = (
        target: Record<string, unknown>,
        source: Record<string, unknown>,
        base: Record<string, unknown>,
        path: string
      ) => {
        for (const key of Object.keys(source)) {
          const currentPath = path ? `${path}.${key}` : key;

          if (key in target) {
            const targetVal = target[key];
            const sourceVal = source[key];
            const baseVal = base[key];

            if (
              typeof targetVal === "object" &&
              targetVal !== null &&
              typeof sourceVal === "object" &&
              sourceVal !== null &&
              !Array.isArray(sourceVal)
            ) {
              // Recurse into nested objects
              deepMerge(
                targetVal as Record<string, unknown>,
                sourceVal as Record<string, unknown>,
                (baseVal as Record<string, unknown>) || {},
                currentPath
              );
            } else if (JSON.stringify(targetVal) !== JSON.stringify(sourceVal)) {
              // Conflict detected
              if (JSON.stringify(baseVal) !== JSON.stringify(sourceVal)) {
                // User has customized this value
                conflicts.push({
                  path: currentPath,
                  baseValue: baseVal,
                  customValue: sourceVal,
                  newValue: targetVal,
                  resolved: false,
                });

                // Keep user's customization by default
                target[key] = sourceVal;
              }
            }
          } else {
            // New key in source, keep it
            target[key] = sourceVal;
          }
        }

        // Check for keys that exist in target but not in source (removed in new version)
        for (const key of Object.keys(target)) {
          const currentPath = path ? `${path}.${key}` : key;
          if (!(key in source)) {
            const targetVal = target[key];
            const baseVal = base[key];

            if (JSON.stringify(targetVal) !== JSON.stringify(baseVal)) {
              // User has customized a removed key
              conflicts.push({
                path: currentPath,
                baseValue: baseVal,
                customValue: targetVal,
                newValue: undefined,
                resolved: false,
              });
            }
          }
        }
      };

      // Get customization sections
      const oldCustomization = (old.customization as Record<string, unknown>) || {};
      const newCustomization = (new_.customization as Record<string, unknown>) || {};
      const oldVariables = (oldCustomization.variables as Record<string, unknown>) || {};
      const newVariables = (newCustomization.variables as Record<string, unknown>) || {};

      // Merge variables
      const mergedVariables = { ...newVariables };
      deepMerge(mergedVariables, oldVariables, {}, "customization.variables");

      // Apply merged variables
      mergedTemplate.customization = {
        ...newCustomization,
        variables: mergedVariables,
      };

      const oldManifest = (old.manifest as Record<string, unknown>) || {};
      const newManifest = (new_.manifest as Record<string, unknown>) || {};

      return {
        id: (new_.id as string) || "",
        name: (newManifest.name as string) || "",
        version: (newManifest.version as string) || "",
        baseVersion: (oldManifest.version as string) || "",
        customVersion: (oldManifest.version as string) || "",
        mergedAt: new Date(),
        conflicts,
        templatePackage: mergedTemplate,
      };
    },

    // ========== Notifications ==========

    /**
     * Send upgrade notification to user
     * This is a placeholder - actual implementation would integrate with notification system
     */
    async notifyUpgradeAvailable(
      userId: string,
      templateId: string
    ): Promise<void> {
      // Get template info
      const template = await db.query.companyTemplates.findFirst({
        where: eq(companyTemplates.id, templateId),
      });

      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Check for available upgrade
      const upgradeInfo = await this.checkUpgradeAvailable(templateId, template.version);

      if (!upgradeInfo.available) {
        return;
      }

      // TODO: Integrate with notification service
      // For now, log the notification
      console.log(`[NOTIFICATION] User ${userId}: Template "${template.name}" has an upgrade available (${upgradeInfo.currentVersion} -> ${upgradeInfo.latestVersion})`);

      // In a real implementation, this would:
      // 1. Create a notification record in the database
      // 2. Send email if user has email notifications enabled
      // 3. Send in-app notification
      // 4. Potentially send webhook if configured
    },

    /**
     * Subscribe user to template updates
     * This is a placeholder - actual implementation would integrate with subscription system
     */
    async subscribeToUpdates(
      userId: string,
      templateId: string
    ): Promise<void> {
      // TODO: Implement subscription logic
      // This would typically:
      // 1. Create/update a subscription record
      // 2. Set notification preferences
      // 3. Track which templates the user cares about

      console.log(`[SUBSCRIPTION] User ${userId} subscribed to template ${templateId} updates`);
    },

    // ========== Utility Functions ==========

    /**
     * Check if a version satisfies a semver range
     * Supports basic range formats: ^1.0.0, ~1.0.0, >=1.0.0, 1.x, etc.
     */
    satisfiesRange(version: string, range: string): boolean {
      const v = parseSemver(version);

      // Handle exact version
      if (validateSemver(range)) {
        return compareVersions(version, range) === 0;
      }

      // Handle ^ (caret) - compatible with version
      if (range.startsWith("^")) {
        const rangeVersion = range.slice(1);
        const r = parseSemver(rangeVersion);

        if (v.major !== r.major) {
          return false;
        }

        if (v.major === 0) {
          // ^0.x.y is equivalent to ~0.x.y
          return v.minor === r.minor && v.patch >= r.patch;
        }

        return (v.minor > r.minor) || (v.minor === r.minor && v.patch >= r.patch);
      }

      // Handle ~ (tilde) - approximately equivalent to version
      if (range.startsWith("~")) {
        const rangeVersion = range.slice(1);
        const r = parseSemver(rangeVersion);

        return v.major === r.major && v.minor === r.minor && v.patch >= r.patch;
      }

      // Handle >= (greater than or equal)
      if (range.startsWith(">=")) {
        const rangeVersion = range.slice(2);
        return compareVersions(version, rangeVersion) >= 0;
      }

      // Handle > (greater than)
      if (range.startsWith(">")) {
        const rangeVersion = range.slice(1);
        return compareVersions(version, rangeVersion) > 0;
      }

      // Handle <= (less than or equal)
      if (range.startsWith("<=")) {
        const rangeVersion = range.slice(2);
        return compareVersions(version, rangeVersion) <= 0;
      }

      // Handle < (less than)
      if (range.startsWith("<")) {
        const rangeVersion = range.slice(1);
        return compareVersions(version, rangeVersion) < 0;
      }

      // Handle x/X/* wildcards
      if (range.includes("x") || range.includes("X") || range.includes("*")) {
        const parts = range.split(".");
        if (parts[0] === "x" || parts[0] === "X" || parts[0] === "*") {
          return true;
        }
        if (parts[1] === "x" || parts[1] === "X" || parts[1] === "*") {
          return v.major === parseInt(parts[0], 10);
        }
        if (parts[2] === "x" || parts[2] === "X" || parts[2] === "*") {
          return v.major === parseInt(parts[0], 10) && v.minor === parseInt(parts[1], 10);
        }
      }

      return false;
    },

    /**
     * Bump version based on change type
     */
    bumpVersion(version: string, bumpType: "major" | "minor" | "patch" | "prerelease", prereleaseId?: string): string {
      const v = parseSemver(version);

      switch (bumpType) {
        case "major":
          return `${v.major + 1}.0.0`;
        case "minor":
          return `${v.major}.${v.minor + 1}.0`;
        case "patch":
          return `${v.major}.${v.minor}.${v.patch + 1}`;
        case "prerelease":
          if (v.prerelease.length > 0) {
            // Increment last prerelease identifier if it's numeric
            const lastId = v.prerelease[v.prerelease.length - 1];
            const lastNum = parseInt(lastId, 10);
            if (!isNaN(lastNum)) {
              v.prerelease[v.prerelease.length - 1] = String(lastNum + 1);
            } else {
              v.prerelease.push("0");
            }
          } else {
            v.prerelease.push(prereleaseId || "alpha", "0");
          }
          return `${v.major}.${v.minor}.${v.patch}-${v.prerelease.join(".")}`;
        default:
          return version;
      }
    },

    /**
     * Get next suggested version based on changes
     */
    suggestNextVersion(currentVersion: string, changes: {
      breaking?: boolean;
      features?: boolean;
      fixes?: boolean;
    }): string {
      if (changes.breaking) {
        return this.bumpVersion(currentVersion, "major");
      }

      if (changes.features) {
        return this.bumpVersion(currentVersion, "minor");
      }

      if (changes.fixes) {
        return this.bumpVersion(currentVersion, "patch");
      }

      return currentVersion;
    },
  };
}

export type TemplateVersionService = ReturnType<typeof templateVersionService>;
