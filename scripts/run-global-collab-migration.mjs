#!/usr/bin/env node
// One-off script to apply the global-collab module migration SQL
// against the embedded Postgres instance.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Use the postgres package from packages/db
const require = createRequire(resolve(root, "packages/db/package.json"));
const postgres = require("postgres");

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://Jigong:Jigong@127.0.0.1:54329/Jigong";

const sqlFile = resolve(
  root,
  "modules/global-collab/src/migrations/0001_initial.sql",
);
const migrationSQL = readFileSync(sqlFile, "utf8");

const sql = postgres(connectionString, { max: 1 });

try {
  // Check current state
  const before = await sql`
    SELECT count(*)::int AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'mod_global_collab_%'
  `;
  console.log(
    `Global-collab tables before migration: ${before[0]?.cnt ?? 0}`,
  );

  // Run the migration
  await sql.unsafe(migrationSQL);
  console.log("Migration SQL executed successfully.");

  // Verify
  const after = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'mod_global_collab_%'
    ORDER BY table_name
  `;
  console.log(`Global-collab tables after migration (${after.length}):`);
  for (const row of after) {
    console.log(`  - ${row.table_name}`);
  }
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
