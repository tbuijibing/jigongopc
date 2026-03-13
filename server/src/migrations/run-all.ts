#!/usr/bin/env tsx
/**
 * Run all data migrations for existing agents.
 *
 * This script migrates legacy agent data from old formats to the new six-dimension model:
 * - Heartbeat configs from runtimeConfig.heartbeat → agent_heartbeat_configs
 * - Soul data from adapterConfig.promptTemplate → agent_souls
 * - Skills from instructionsFilePath → skill_registry + agent_skills
 * - Capabilities from agents.capabilities → structured format
 *
 * Usage:
 *   DATABASE_URL=<your-db-url> tsx server/src/migrations/run-all.ts
 *   or run the dev server first to initialize embedded postgres, then:
 *   tsx server/src/migrations/run-all.ts
 */

import { createDb } from "@jigongai/db";
import { migrateHeartbeats } from "./migrate-heartbeats.js";
import { migrateSouls } from "./migrate-souls.js";
import { migrateSkills } from "./migrate-skills.js";
import { migrateCapabilities } from "./migrate-capabilities.js";

async function main() {
  console.log("[run-all] Starting data migrations...\n");

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("[run-all] ERROR: DATABASE_URL environment variable is required.");
    console.error("Please set DATABASE_URL or start the dev server first to initialize embedded postgres.");
    console.error("Example: DATABASE_URL=postgresql://user:pass@localhost:5432/jigong tsx server/src/migrations/run-all.ts");
    process.exit(1);
  }

  console.log(`[run-all] Using database: ${databaseUrl.split('@')[1] || 'configured'}`);
  const db = createDb(databaseUrl);

  // Run migrations in sequence
  console.log("[run-all] 1/4 Migrating heartbeat configs...");
  const heartbeatStats = await migrateHeartbeats(db);
  console.log(`  ✓ Heartbeats: ${heartbeatStats.migrated} migrated, ${heartbeatStats.skipped} skipped\n`);

  console.log("[run-all] 2/4 Migrating souls...");
  const soulStats = await migrateSouls(db);
  console.log(`  ✓ Souls: ${soulStats.migrated} migrated, ${soulStats.skipped} skipped\n`);

  console.log("[run-all] 3/4 Migrating skills...");
  const skillStats = await migrateSkills(db);
  console.log(`  ✓ Skills: ${skillStats.migrated} migrated, ${skillStats.skipped} skipped, ${skillStats.fileErrors} file errors\n`);

  console.log("[run-all] 4/4 Migrating capabilities...");
  const capStats = await migrateCapabilities(db);
  console.log(`  ✓ Capabilities: ${capStats.migrated} migrated, ${capStats.skipped} skipped\n`);

  console.log("[run-all] ✅ All migrations complete!");
  console.log(`
Summary:
  Heartbeats:    ${heartbeatStats.migrated} migrated, ${heartbeatStats.skipped} skipped
  Souls:         ${soulStats.migrated} migrated, ${soulStats.skipped} skipped
  Skills:        ${skillStats.migrated} migrated, ${skillStats.skipped} skipped
  Capabilities:  ${capStats.migrated} migrated, ${capStats.skipped} skipped
`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[run-all] Migration failed:", err);
  process.exit(1);
});
