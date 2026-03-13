#!/usr/bin/env node
/**
 * Query specific agents by ID
 */

const dbModule = await import("./packages/db/dist/client.js");
const schemaModule = await import("./packages/db/dist/schema/index.js");

const { createDb } = dbModule;
const { agents } = schemaModule;

const DATABASE_URL = process.env.DATABASE_URL || "postgres://Jigong:Jigong@localhost:5432/Jigong";

const db = createDb(DATABASE_URL);

const targetIds = [
  '121', '127', '123', '125', '122', '126', '119', '128', '124'
];

try {
  const allAgents = await db.select().from(agents);
  
  console.log(`\n📋 Found ${allAgents.length} agents total\n`);
  console.log("Target agents:\n");
  
  for (const id of targetIds) {
    const agent = allAgents.find(a => a.id === id);
    if (agent) {
      console.log(`  ${agent.id} | "${agent.name}" | ${agent.role || '(no role)'}`);
    } else {
      console.log(`  ${id} | NOT FOUND`);
    }
  }
  
  console.log("\n所有 agents:\n");
  for (const agent of allAgents) {
    console.log(`  ${agent.id} | "${agent.name}" | ${agent.role || '(no role)'}`);
  }
  
  console.log();
} catch (err) {
  console.error("❌ Error:", err);
  process.exit(1);
}
