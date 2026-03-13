#!/usr/bin/env node
/**
 * List all agents in the database
 */

const dbModule = await import("./packages/db/dist/client.js");
const schemaModule = await import("./packages/db/dist/schema/index.js");

const { createDb } = dbModule;
const { agents } = schemaModule;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

try {
  const allAgents = await db.select().from(agents);
  
  console.log(`\n📋 Found ${allAgents.length} agents:\n`);
  
  for (const agent of allAgents) {
    console.log(`  ${agent.id} | ${agent.name} | ${agent.role || '(no role)'}`);
  }
  
  console.log();
} catch (err) {
  console.error("❌ Error:", err);
  process.exit(1);
}
