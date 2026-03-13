/**
 * Core Invariant Verification Tests
 *
 * Static analysis tests that verify the Global Collaboration module
 * preserves core control-plane invariants:
 *
 * - Single-assignee model (Req 15.1)
 * - Atomic checkout semantics (Req 15.2)
 * - Approval gates (Req 15.3)
 * - Budget hard-stop (Req 15.4)
 * - Read-only core access via api.core.* (Req 13.3)
 * - Module schema namespace isolation (Req 13.1)
 *
 * Validates: Requirements 13.3, 15.1, 15.2, 15.3, 15.4
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Helpers ────────────────────────────────────────────────────────────────

const MODULE_SRC = path.resolve(__dirname, "..");

/** Recursively collect all .ts source files (excluding tests and node_modules). */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      results.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

/** Read file content as string. */
function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

const sourceFiles = collectSourceFiles(MODULE_SRC);

// ─── Schema Namespace Isolation (Req 13.1) ──────────────────────────────────

describe("Schema namespace isolation", () => {
  it("all exported tables use mod_global_collab_ prefix", () => {
    // Import the schema module and check all pgTable definitions
    const schemaSource = read(path.join(MODULE_SRC, "schema.ts"));

    // Extract all table name strings from pgTable() calls
    const tableNamePattern = /pgTable\(\s*["']([^"']+)["']/g;
    const tableNames: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = tableNamePattern.exec(schemaSource)) !== null) {
      tableNames.push(match[1]);
    }

    expect(tableNames.length).toBeGreaterThan(0);
    for (const name of tableNames) {
      expect(name).toMatch(/^mod_global_collab_/);
    }
  });

  it("module does not import core schema tables directly", () => {
    for (const file of sourceFiles) {
      const content = read(file);
      const rel = path.relative(MODULE_SRC, file);

      // Should not import from @Jigongai/db schema
      expect(content, `${rel} imports @Jigongai/db schema`).not.toMatch(
        /from\s+["']@Jigongai\/db\/src\/schema/,
      );
      expect(content, `${rel} imports @Jigongai/db`).not.toMatch(
        /from\s+["']@Jigongai\/db["']/,
      );

      // Should not import from packages/db directly via relative path
      expect(content, `${rel} imports packages/db`).not.toMatch(
        /from\s+["'].*packages\/db/,
      );
    }
  });
});

// ─── Read-Only Core Access (Req 13.3) ───────────────────────────────────────

describe("Read-only core access", () => {
  it("module only writes to mod_global_collab_* tables", () => {
    // Match DB write operations: db.insert(table), db.update(table), db.delete(table)
    // or this.db.insert(table) — these are Drizzle ORM patterns.
    // We look for .insert/.update/.delete followed by a parenthesised identifier
    // that starts with "modGlobalCollab" (our module tables).
    // We skip Map/Set .delete() calls by requiring the argument to start with
    // "modGlobalCollab" only when the line also contains "db" or "await".
    const writePattern = /(?:db|await)\s*[\s\S]*?\.(?:insert|update|delete)\(\s*(\w+)/g;

    for (const file of sourceFiles) {
      const content = read(file);
      const rel = path.relative(MODULE_SRC, file);

      // Process line-by-line to avoid cross-line false positives
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Only check lines that look like Drizzle DB operations
        if (!line.includes(".insert(") && !line.includes(".update(") && !line.includes(".delete(")) continue;
        // Must reference db to be a DB operation
        const contextLines = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
        if (!contextLines.includes("db")) continue;

        const opMatch = /\.(?:insert|update|delete)\(\s*(\w+)/.exec(line);
        if (opMatch) {
          const tableName = opMatch[1];
          expect(
            tableName,
            `${rel}:${i + 1} writes to non-module table: ${tableName}`,
          ).toMatch(/^modGlobalCollab/);
        }
      }
    }
  });

  it("hooks only read core data from payload, never write to core tables", () => {
    const hooksSource = read(path.join(MODULE_SRC, "hooks.ts"));

    // Hooks should not contain any direct DB writes to core tables
    const writePattern = /\.(?:insert|update|delete)\(\s*(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = writePattern.exec(hooksSource)) !== null) {
      expect(m[1], `hooks.ts writes to non-module table: ${m[1]}`).toMatch(
        /^modGlobalCollab/,
      );
    }

    // Hooks should not import core schema symbols
    expect(hooksSource).not.toMatch(/from\s+["']@Jigongai\/db/);
  });
});

// ─── Single-Assignee Model Invariant (Req 15.1) ────────────────────────────

describe("Single-assignee model preservation", () => {
  it("module never writes to assigneeAgentId or assigneeUserId", () => {
    for (const file of sourceFiles) {
      const content = read(file);
      const rel = path.relative(MODULE_SRC, file);

      // The module may READ these fields (e.g. from hook payloads),
      // but should never SET/WRITE them via assignment in a DB operation
      // Look for set/update patterns that target these fields
      expect(content, `${rel} sets assigneeAgentId`).not.toMatch(
        /assigneeAgentId\s*:/,
      );
      expect(content, `${rel} sets assigneeUserId`).not.toMatch(
        /assigneeUserId\s*:/,
      );
    }
  });
});

// ─── Atomic Checkout Semantics (Req 15.2) ──────────────────────────────────

describe("Atomic checkout semantics preservation", () => {
  it("module never references checkout state fields", () => {
    for (const file of sourceFiles) {
      const content = read(file);
      const rel = path.relative(MODULE_SRC, file);

      // Module should not reference checkedOutBy or checkout-related fields
      expect(content, `${rel} references checkedOutBy`).not.toMatch(
        /checkedOutBy/,
      );
      expect(content, `${rel} references checkoutAt`).not.toMatch(
        /checkoutAt/,
      );
    }
  });
});

// ─── Approval Gates Invariant (Req 15.3) ───────────────────────────────────

describe("Approval gates preservation", () => {
  it("module notifications do not bypass approval flow", () => {
    const hooksSource = read(path.join(MODULE_SRC, "hooks.ts"));
    const notifSource = read(
      path.join(MODULE_SRC, "services", "notification.ts"),
    );

    // Module should not import or reference approval tables/services
    for (const source of [hooksSource, notifSource]) {
      expect(source).not.toMatch(/approvals\s*\./);
      expect(source).not.toMatch(/\.approve\(/);
      expect(source).not.toMatch(/\.reject\(/);
    }
  });
});

// ─── Budget Hard-Stop Invariant (Req 15.4) ─────────────────────────────────

describe("Budget hard-stop preservation", () => {
  it("module does not reference budget control logic", () => {
    for (const file of sourceFiles) {
      const content = read(file);
      const rel = path.relative(MODULE_SRC, file);

      // Module should not interact with budget fields or services
      expect(content, `${rel} references budgetUsed`).not.toMatch(
        /budgetUsed/,
      );
      expect(content, `${rel} references budgetLimit`).not.toMatch(
        /budgetLimit/,
      );
      expect(content, `${rel} references pauseBudget`).not.toMatch(
        /pauseBudget/,
      );
    }
  });
});

// ─── Module Disable Behavior (Req 1.3, 1.4) ────────────────────────────────

describe("Module disable behavior", () => {
  it("register() checks enabled config and skips registration when disabled", () => {
    const indexSource = read(path.join(MODULE_SRC, "index.ts"));

    // The register function should check api.config.enabled === false
    expect(indexSource).toMatch(/api\.config\.enabled\s*===\s*false/);
  });

  it("register() does not delete module data on disable", () => {
    const indexSource = read(path.join(MODULE_SRC, "index.ts"));

    // The early-return path (disabled) should not contain any DROP TABLE or
    // DELETE operations — data preservation is guaranteed
    const disableBlock = indexSource.split("api.config.enabled === false")[1]?.split("return;")[0] ?? "";
    expect(disableBlock).not.toMatch(/DROP\s+TABLE/i);
    expect(disableBlock).not.toMatch(/\.delete\(/);
    expect(disableBlock).not.toMatch(/\.drop\(/);
  });
});
