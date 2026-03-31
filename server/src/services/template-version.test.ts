import { describe, it, expect, beforeEach } from "vitest";
import {
  validateSemver,
  parseSemver,
  compareVersions,
  templateVersionService,
  type SemverParts,
  type VersionDiff,
} from "./template-version.js";
import type { Db } from "@jigongai/db";
import * as schema from "@jigongai/db/schema";

describe("Template Version Service", () => {
  describe("Version Validation", () => {
    describe("validateSemver", () => {
      it("should validate simple versions", () => {
        expect(validateSemver("1.0.0")).toBe(true);
        expect(validateSemver("0.0.0")).toBe(true);
        expect(validateSemver("10.20.30")).toBe(true);
      });

      it("should validate versions with prerelease", () => {
        expect(validateSemver("1.0.0-alpha")).toBe(true);
        expect(validateSemver("1.0.0-alpha.1")).toBe(true);
        expect(validateSemver("1.0.0-0.3.7")).toBe(true);
        expect(validateSemver("1.0.0-x.7.z.92")).toBe(true);
        expect(validateSemver("1.0.0-beta.11")).toBe(true);
      });

      it("should validate versions with build metadata", () => {
        expect(validateSemver("1.0.0+build")).toBe(true);
        expect(validateSemver("1.0.0+build.1")).toBe(true);
        expect(validateSemver("1.0.0+20130313144700")).toBe(true);
        expect(validateSemver("1.0.0+exp.sha.5114f85")).toBe(true);
      });

      it("should validate versions with both prerelease and build", () => {
        expect(validateSemver("1.0.0-alpha+001")).toBe(true);
        expect(validateSemver("1.0.0-beta.1+exp.sha.5114f85")).toBe(true);
      });

      it("should reject invalid versions", () => {
        expect(validateSemver("")).toBe(false);
        expect(validateSemver("1")).toBe(false);
        expect(validateSemver("1.0")).toBe(false);
        expect(validateSemver("1.0.0.0")).toBe(false);
        expect(validateSemver("01.0.0")).toBe(false);
        expect(validateSemver("1.01.0")).toBe(false);
        expect(validateSemver("1.0.01")).toBe(false);
        expect(validateSemver("a.b.c")).toBe(false);
        expect(validateSemver("v1.0.0")).toBe(false);
        expect(validateSemver("1.0.0-")).toBe(false);
        expect(validateSemver("1.0.0+")).toBe(false);
      });

      it("should reject null and undefined", () => {
        expect(validateSemver(null as unknown as string)).toBe(false);
        expect(validateSemver(undefined as unknown as string)).toBe(false);
      });

      it("should reject non-string values", () => {
        expect(validateSemver(123 as unknown as string)).toBe(false);
        expect(validateSemver({} as unknown as string)).toBe(false);
        expect(validateSemver([] as unknown as string)).toBe(false);
      });
    });

    describe("parseSemver", () => {
      it("should parse simple versions", () => {
        const result = parseSemver("1.2.3");
        expect(result).toEqual({
          major: 1,
          minor: 2,
          patch: 3,
          prerelease: [],
          build: [],
        });
      });

      it("should parse versions with prerelease", () => {
        const result = parseSemver("1.0.0-alpha.1");
        expect(result).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: ["alpha", "1"],
          build: [],
        });
      });

      it("should parse versions with build metadata", () => {
        const result = parseSemver("1.0.0+build.123");
        expect(result).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: [],
          build: ["build", "123"],
        });
      });

      it("should parse versions with prerelease and build", () => {
        const result = parseSemver("1.0.0-beta.2+exp.sha.5114f85");
        expect(result).toEqual({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: ["beta", "2"],
          build: ["exp", "sha", "5114f85"],
        });
      });

      it("should throw for invalid versions", () => {
        expect(() => parseSemver("invalid")).toThrow("Invalid semver version");
        expect(() => parseSemver("")).toThrow("Invalid semver version");
        expect(() => parseSemver("1.0")).toThrow("Invalid semver version");
      });
    });
  });

  describe("Version Comparison", () => {
    describe("compareVersions", () => {
      it("should compare major versions", () => {
        expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
        expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
        expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
      });

      it("should compare minor versions", () => {
        expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
        expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
        expect(compareVersions("1.1.0", "1.1.0")).toBe(0);
      });

      it("should compare patch versions", () => {
        expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
        expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
        expect(compareVersions("1.0.1", "1.0.1")).toBe(0);
      });

      it("should compare mixed versions", () => {
        expect(compareVersions("1.0.0", "1.2.3")).toBe(-1);
        expect(compareVersions("1.2.0", "1.2.3")).toBe(-1);
        expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
      });

      it("should handle prerelease precedence", () => {
        // A version without prerelease has higher precedence
        expect(compareVersions("1.0.0", "1.0.0-alpha")).toBe(1);
        expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(-1);

        // Compare prerelease identifiers
        expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
        expect(compareVersions("1.0.0-beta", "1.0.0-alpha")).toBe(1);

        // Numeric identifiers have lower precedence than alphanumeric
        expect(compareVersions("1.0.0-1", "1.0.0-alpha")).toBe(-1);

        // Compare numeric prerelease identifiers
        expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.2")).toBe(-1);
        expect(compareVersions("1.0.0-alpha.2", "1.0.0-alpha.1")).toBe(1);
      });

      it("should handle prerelease with different lengths", () => {
        // Shorter prerelease with same prefix has lower precedence
        expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
        expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha")).toBe(1);
      });

      it("should ignore build metadata in comparison", () => {
        expect(compareVersions("1.0.0+build1", "1.0.0+build2")).toBe(0);
        expect(compareVersions("1.0.0-alpha+build1", "1.0.0-alpha+build2")).toBe(0);
      });

      it("should throw for invalid versions", () => {
        expect(() => compareVersions("invalid", "1.0.0")).toThrow();
        expect(() => compareVersions("1.0.0", "invalid")).toThrow();
      });
    });
  });

  describe("Template Version Service with Database", () => {
    let db: Db;
    let service: ReturnType<typeof templateVersionService>;
    let companyId: string;
    let templateId: string;
    let userId: string;

    beforeEach(async () => {
      // Use in-memory PGlite for testing
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const dbInstance = new PGlite();
      await dbInstance.waitReady;
      db = drizzle(dbInstance, { schema });
      service = templateVersionService(db);
      userId = "user-1";

      // Create test company
      const [company] = await db
        .insert(db.schema.companies)
        .values({
          name: "Test Company",
          slug: "test-company",
        })
        .returning();
      companyId = company.id;

      // Create test template
      const [template] = await db
        .insert(db.schema.companyTemplates)
        .values({
          companyId,
          name: "Test Template",
          slug: "test-template",
          description: "A test template",
          version: "1.0.0",
          sourceType: "imported",
          templatePackage: {
            manifest: { name: "Test", version: "1.0.0" },
            customization: { variables: {} },
          },
          createdBy: userId,
          updatedBy: userId,
          isActive: true,
        })
        .returning();
      templateId = template.id;
    });

    describe("getVersionHistory", () => {
      it("should return current template as single version when no lineage exists", async () => {
        const history = await service.getVersionHistory(templateId);

        expect(history).toHaveLength(1);
        expect(history[0].version).toBe("1.0.0");
        expect(history[0].isLatest).toBe(true);
      });

      it("should return empty array for non-existent template", async () => {
        const history = await service.getVersionHistory("non-existent-id");
        expect(history).toEqual([]);
      });

      it("should return all versions from lineage", async () => {
        // Add lineage entries
        await db.insert(db.schema.templateLineages).values([
          {
            templateId,
            version: "1.0.0",
            createdBy: userId,
            changeNotes: "Initial version",
          },
          {
            templateId,
            version: "1.1.0",
            createdBy: userId,
            changeNotes: "Added features",
          },
          {
            templateId,
            version: "2.0.0",
            createdBy: userId,
            changeNotes: "Breaking changes",
          },
        ]);

        const history = await service.getVersionHistory(templateId);

        expect(history).toHaveLength(3);
        expect(history[0].version).toBe("2.0.0"); // Latest first
        expect(history[0].isLatest).toBe(true);
        expect(history[1].version).toBe("1.1.0");
        expect(history[2].version).toBe("1.0.0");
      });

      it("should include changelogs from lineage", async () => {
        await db.insert(db.schema.templateLineages).values({
          templateId,
          version: "1.0.0",
          createdBy: userId,
          changeNotes: "Initial release with core features",
        });

        const history = await service.getVersionHistory(templateId);

        expect(history[0].changelog).toBe("Initial release with core features");
      });
    });

    describe("getLatestVersion", () => {
      it("should return current template version when no lineage exists", async () => {
        const latest = await service.getLatestVersion(templateId);

        expect(latest).not.toBeNull();
        expect(latest?.version).toBe("1.0.0");
        expect(latest?.isLatest).toBe(true);
      });

      it("should return latest from lineage when entries exist", async () => {
        await db.insert(db.schema.templateLineages).values([
          {
            templateId,
            version: "1.0.0",
            createdBy: userId,
          },
          {
            templateId,
            version: "1.1.0",
            createdBy: userId,
          },
        ]);

        const latest = await service.getLatestVersion(templateId);

        expect(latest?.version).toBe("1.1.0");
      });

      it("should return null for non-existent template", async () => {
        const latest = await service.getLatestVersion("non-existent");
        expect(latest).toBeNull();
      });
    });

    describe("getVersionAt", () => {
      it("should get specific version from template", async () => {
        const version = await service.getVersionAt(templateId, "1.0.0");

        expect(version).not.toBeNull();
        expect(version?.version).toBe("1.0.0");
        expect(version?.templateId).toBe(templateId);
      });

      it("should get specific version from lineage", async () => {
        await db.insert(db.schema.templateLineages).values({
          templateId,
          version: "1.5.0",
          createdBy: userId,
          changeNotes: "Special version",
        });

        const version = await service.getVersionAt(templateId, "1.5.0");

        expect(version?.version).toBe("1.5.0");
        expect(version?.changelog).toBe("Special version");
      });

      it("should throw for invalid version format", async () => {
        await expect(service.getVersionAt(templateId, "invalid")).rejects.toThrow(
          "Invalid version format"
        );
      });

      it("should return null for non-existent version", async () => {
        const version = await service.getVersionAt(templateId, "9.9.9");
        expect(version).toBeNull();
      });
    });

    describe("compareVersionsDetailed", () => {
      it("should detect major changes", async () => {
        const diff = await service.compareVersionsDetailed("1.0.0", "2.0.0");

        expect(diff.changeType).toBe("major");
        expect(diff.breaking).toBe(true);
        expect(diff.fromVersion).toBe("1.0.0");
        expect(diff.toVersion).toBe("2.0.0");
      });

      it("should detect minor changes", async () => {
        const diff = await service.compareVersionsDetailed("1.0.0", "1.1.0");

        expect(diff.changeType).toBe("minor");
        expect(diff.breaking).toBe(false);
      });

      it("should detect patch changes", async () => {
        const diff = await service.compareVersionsDetailed("1.0.0", "1.0.1");

        expect(diff.changeType).toBe("patch");
        expect(diff.breaking).toBe(false);
      });

      it("should detect prerelease changes", async () => {
        const diff = await service.compareVersionsDetailed("1.0.0", "1.0.0-beta");

        expect(diff.changeType).toBe("prerelease");
      });

      it("should detect no changes", async () => {
        const diff = await service.compareVersionsDetailed("1.0.0", "1.0.0");

        expect(diff.changeType).toBe("none");
        expect(diff.breaking).toBe(false);
      });

      it("should include summary", async () => {
        const diff = await service.compareVersionsDetailed("1.0.0", "2.0.0");

        expect(diff.summary).toContain("Breaking change");
        expect(diff.summary).toContain("Major version bump");
      });
    });

    describe("generateChangelog", () => {
      it("should generate changelog with summary", async () => {
        const changelog = await service.generateChangelog(templateId, "1.0.0", "1.1.0");

        expect(changelog).toContain("# Changelog:");
        expect(changelog).toContain("## Summary");
      });

      it("should include breaking change warning", async () => {
        const changelog = await service.generateChangelog(templateId, "1.0.0", "2.0.0");

        expect(changelog).toContain("BREAKING CHANGES");
        expect(changelog).toContain("⚠️");
      });

      it("should include lineage changes", async () => {
        await db.insert(db.schema.templateLineages).values([
          {
            templateId,
            version: "1.0.1",
            createdBy: userId,
            changeNotes: "Fixed bug in workflow",
          },
          {
            templateId,
            version: "1.1.0",
            createdBy: userId,
            changeNotes: "Added new features",
          },
        ]);

        const changelog = await service.generateChangelog(templateId, "1.0.0", "1.1.0");

        expect(changelog).toContain("Fixed bug in workflow");
        expect(changelog).toContain("Added new features");
      });
    });

    describe("checkUpgradeAvailable", () => {
      it("should detect available upgrade", async () => {
        // Add newer version to lineage
        await db.insert(db.schema.templateLineages).values({
          templateId,
          version: "1.1.0",
          createdBy: userId,
        });

        const info = await service.checkUpgradeAvailable(templateId, "1.0.0");

        expect(info.available).toBe(true);
        expect(info.currentVersion).toBe("1.0.0");
        expect(info.latestVersion).toBe("1.1.0");
        expect(info.changeType).toBe("minor");
      });

      it("should return not available when on latest version", async () => {
        const info = await service.checkUpgradeAvailable(templateId, "1.0.0");

        expect(info.available).toBe(false);
        expect(info.currentVersion).toBe("1.0.0");
      });

      it("should detect breaking changes", async () => {
        await db.insert(db.schema.templateLineages).values({
          templateId,
          version: "2.0.0",
          createdBy: userId,
        });

        const info = await service.checkUpgradeAvailable(templateId, "1.0.0");

        expect(info.available).toBe(true);
        expect(info.breaking).toBe(true);
        expect(info.changeType).toBe("major");
      });

      it("should throw for non-existent current version", async () => {
        await expect(
          service.checkUpgradeAvailable(templateId, "9.9.9")
        ).rejects.toThrow("Current version 9.9.9 not found");
      });
    });

    describe("calculateUpgradePath", () => {
      it("should return empty array for same version", async () => {
        const path = await service.calculateUpgradePath("1.0.0", "1.0.0");
        expect(path).toEqual([]);
      });

      it("should return empty array when going backward", async () => {
        const path = await service.calculateUpgradePath("2.0.0", "1.0.0");
        expect(path).toEqual([]);
      });

      it("should calculate patch upgrade path", async () => {
        const path = await service.calculateUpgradePath("1.0.0", "1.0.5");

        expect(path).toEqual([
          "1.0.1",
          "1.0.2",
          "1.0.3",
          "1.0.4",
          "1.0.5",
        ]);
      });

      it("should calculate minor upgrade path", async () => {
        const path = await service.calculateUpgradePath("1.0.0", "1.3.0");

        expect(path).toContain("1.1.0");
        expect(path).toContain("1.2.0");
        expect(path).toContain("1.3.0");
      });

      it("should calculate major upgrade path", async () => {
        const path = await service.calculateUpgradePath("1.0.0", "3.0.0");

        expect(path).toContain("2.0.0");
        expect(path).toContain("3.0.0");
      });

      it("should calculate complex upgrade path", async () => {
        const path = await service.calculateUpgradePath("1.0.0", "2.1.0");

        expect(path).toContain("2.0.0");
        expect(path).toContain("2.1.0");
      });

      it("should handle prerelease upgrades", async () => {
        const path = await service.calculateUpgradePath("1.0.0-alpha", "1.0.0-alpha.2");

        expect(path).toEqual(["1.0.0-alpha.2"]);
      });
    });

    describe("preserveCustomizations", () => {
      it("should preserve user customizations", async () => {
        const oldTemplate = {
          id: "tpl-1",
          manifest: { name: "Test", version: "1.0.0" },
          customization: {
            variables: {
              color: "blue",
              size: "large",
            },
          },
        };

        const newTemplate = {
          id: "tpl-2",
          manifest: { name: "Test", version: "2.0.0" },
          customization: {
            variables: {
              color: "red", // Changed by template author
              size: "large",
              newVar: "value",
            },
          },
        };

        const result = await service.preserveCustomizations(oldTemplate, newTemplate);

        const mergedVars = (result.templatePackage as Record<string, unknown>).customization as Record<string, unknown>;
        expect((mergedVars.variables as Record<string, unknown>).color).toBe("blue"); // User's customization preserved
        expect((mergedVars.variables as Record<string, unknown>).newVar).toBe("value"); // New var added
      });

      it("should detect conflicts", async () => {
        const oldTemplate = {
          manifest: { version: "1.0.0" },
          customization: {
            variables: {
              theme: "dark",
            },
          },
        };

        const newTemplate = {
          manifest: { version: "2.0.0" },
          customization: {
            variables: {
              theme: "light", // Changed in both
            },
          },
        };

        const result = await service.preserveCustomizations(oldTemplate, newTemplate);

        expect(result.conflicts.length).toBeGreaterThan(0);
        expect(result.conflicts[0].path).toContain("theme");
      });

      it("should handle nested customizations", async () => {
        const oldTemplate = {
          manifest: { version: "1.0.0" },
          customization: {
            variables: {
              nested: {
                deep: {
                  value: "user-custom",
                },
              },
            },
          },
        };

        const newTemplate = {
          manifest: { version: "2.0.0" },
          customization: {
            variables: {
              nested: {
                deep: {
                  value: "template-default",
                },
              },
            },
          },
        };

        const result = await service.preserveCustomizations(oldTemplate, newTemplate);

        const mergedVars = (result.templatePackage as Record<string, unknown>).customization as Record<string, unknown>;
        expect(((mergedVars.variables as Record<string, unknown>).nested as Record<string, unknown>).deep).toEqual({
          value: "user-custom",
        });
      });

      it("should handle removed keys", async () => {
        const oldTemplate = {
          manifest: { version: "1.0.0" },
          customization: {
            variables: {
              keepThis: "value1",
              removeThis: "customized-value",
            },
          },
        };

        const newTemplate = {
          manifest: { version: "2.0.0" },
          customization: {
            variables: {
              keepThis: "value1",
              // removeThis is removed
            },
          },
        };

        const result = await service.preserveCustomizations(oldTemplate, newTemplate);

        // Should detect conflict for removed key that was customized
        const conflict = result.conflicts.find((c) => c.path.includes("removeThis"));
        expect(conflict).toBeDefined();
      });
    });

    describe("satisfiesRange", () => {
      it("should handle exact version match", () => {
        expect(service.satisfiesRange("1.0.0", "1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.0.0", "2.0.0")).toBe(false);
      });

      it("should handle ^ (caret) ranges", () => {
        expect(service.satisfiesRange("1.0.0", "^1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.1.0", "^1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.1.5", "^1.0.0")).toBe(true);
        expect(service.satisfiesRange("2.0.0", "^1.0.0")).toBe(false);
        expect(service.satisfiesRange("0.1.0", "^0.0.1")).toBe(false);
      });

      it("should handle ~ (tilde) ranges", () => {
        expect(service.satisfiesRange("1.0.0", "~1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.0.5", "~1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.1.0", "~1.0.0")).toBe(false);
      });

      it("should handle >= ranges", () => {
        expect(service.satisfiesRange("1.0.0", ">=1.0.0")).toBe(true);
        expect(service.satisfiesRange("2.0.0", ">=1.0.0")).toBe(true);
        expect(service.satisfiesRange("0.9.0", ">=1.0.0")).toBe(false);
      });

      it("should handle > ranges", () => {
        expect(service.satisfiesRange("1.0.1", ">1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.0.0", ">1.0.0")).toBe(false);
      });

      it("should handle <= ranges", () => {
        expect(service.satisfiesRange("1.0.0", "<=1.0.0")).toBe(true);
        expect(service.satisfiesRange("0.9.0", "<=1.0.0")).toBe(true);
        expect(service.satisfiesRange("2.0.0", "<=1.0.0")).toBe(false);
      });

      it("should handle < ranges", () => {
        expect(service.satisfiesRange("0.9.0", "<1.0.0")).toBe(true);
        expect(service.satisfiesRange("1.0.0", "<1.0.0")).toBe(false);
      });

      it("should handle wildcard ranges", () => {
        expect(service.satisfiesRange("1.0.0", "*")).toBe(true);
        expect(service.satisfiesRange("1.0.0", "1.x")).toBe(true);
        expect(service.satisfiesRange("1.5.0", "1.x")).toBe(true);
        expect(service.satisfiesRange("2.0.0", "1.x")).toBe(false);
        expect(service.satisfiesRange("1.0.5", "1.0.x")).toBe(true);
        expect(service.satisfiesRange("1.1.0", "1.0.x")).toBe(false);
      });
    });

    describe("bumpVersion", () => {
      it("should bump major version", () => {
        expect(service.bumpVersion("1.2.3", "major")).toBe("2.0.0");
        expect(service.bumpVersion("0.5.0", "major")).toBe("1.0.0");
      });

      it("should bump minor version", () => {
        expect(service.bumpVersion("1.2.3", "minor")).toBe("1.3.0");
        expect(service.bumpVersion("1.9.9", "minor")).toBe("1.10.0");
      });

      it("should bump patch version", () => {
        expect(service.bumpVersion("1.2.3", "patch")).toBe("1.2.4");
        expect(service.bumpVersion("1.2.9", "patch")).toBe("1.2.10");
      });

      it("should bump prerelease version", () => {
        expect(service.bumpVersion("1.0.0", "prerelease", "alpha")).toBe("1.0.0-alpha.0");
        expect(service.bumpVersion("1.0.0-alpha.0", "prerelease")).toBe("1.0.0-alpha.1");
        expect(service.bumpVersion("1.0.0-beta.5", "prerelease")).toBe("1.0.0-beta.6");
      });
    });

    describe("suggestNextVersion", () => {
      it("should suggest major bump for breaking changes", () => {
        expect(service.suggestNextVersion("1.0.0", { breaking: true })).toBe("2.0.0");
      });

      it("should suggest minor bump for features", () => {
        expect(service.suggestNextVersion("1.0.0", { features: true })).toBe("1.1.0");
      });

      it("should suggest patch bump for fixes", () => {
        expect(service.suggestNextVersion("1.0.0", { fixes: true })).toBe("1.0.1");
      });

      it("should prioritize breaking over features", () => {
        expect(service.suggestNextVersion("1.0.0", { breaking: true, features: true })).toBe("2.0.0");
      });

      it("should return same version if no changes", () => {
        expect(service.suggestNextVersion("1.0.0", {})).toBe("1.0.0");
      });
    });

    describe("notifyUpgradeAvailable", () => {
      it("should not throw for valid template", async () => {
        // No newer version available, should return without throwing
        await expect(
          service.notifyUpgradeAvailable(userId, templateId)
        ).resolves.not.toThrow();
      });

      it("should throw for non-existent template", async () => {
        await expect(
          service.notifyUpgradeAvailable(userId, "non-existent")
        ).rejects.toThrow("Template not found");
      });
    });

    describe("subscribeToUpdates", () => {
      it("should not throw", async () => {
        await expect(
          service.subscribeToUpdates(userId, templateId)
        ).resolves.not.toThrow();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero versions", () => {
      expect(validateSemver("0.0.0")).toBe(true);
      const parsed = parseSemver("0.0.0");
      expect(parsed.major).toBe(0);
      expect(parsed.minor).toBe(0);
      expect(parsed.patch).toBe(0);
    });

    it("should handle very large version numbers", () => {
      expect(validateSemver("999.999.999")).toBe(true);
      const parsed = parseSemver("999.999.999");
      expect(parsed.major).toBe(999);
      expect(parsed.minor).toBe(999);
      expect(parsed.patch).toBe(999);
    });

    it("should handle complex prerelease identifiers", () => {
      const parsed = parseSemver("1.0.0-alpha.beta.1.2.gamma");
      expect(parsed.prerelease).toEqual(["alpha", "beta", "1", "2", "gamma"]);
    });

    it("should handle complex build metadata", () => {
      const parsed = parseSemver("1.0.0+build.20130313144700.sha.5114f85");
      expect(parsed.build).toEqual(["build", "20130313144700", "sha", "5114f85"]);
    });

    it("should handle prerelease with numeric identifiers only", () => {
      const parsed = parseSemver("1.0.0-0.3.7");
      expect(parsed.prerelease).toEqual(["0", "3", "7"]);
    });

    it("should correctly compare versions with leading zeros in prerelease", () => {
      // Numeric identifiers should be compared as numbers
      expect(compareVersions("1.0.0-1", "1.0.0-2")).toBe(-1);
      expect(compareVersions("1.0.0-10", "1.0.0-2")).toBe(1); // 10 > 2 numerically
    });

    it("should handle empty templates in preserveCustomizations", async () => {
      const service = templateVersionService(createTestDb());
      const result = await service.preserveCustomizations({}, {});

      expect(result.conflicts).toEqual([]);
      expect(result.templatePackage).toBeDefined();
    });

    it("should handle deeply nested objects in preserveCustomizations", async () => {
      const service = templateVersionService(createTestDb());
      const oldTemplate = {
        customization: {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: "deep-custom",
                },
              },
            },
          },
        },
      };

      const newTemplate = {
        customization: {
          level1: {
            level2: {
              level3: {
                level4: {
                  value: "deep-default",
                },
              },
            },
          },
        },
      };

      const result = await service.preserveCustomizations(oldTemplate, newTemplate);
      const merged = result.templatePackage as Record<string, unknown>;
      const customization = merged.customization as Record<string, unknown>;
      const level1 = customization.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;
      const level4 = level3.level4 as Record<string, unknown>;

      expect(level4.value).toBe("deep-custom");
    });
  });
});
