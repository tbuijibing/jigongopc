import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { agentApiKeys } from "@jigongai/db";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  try {
    await db.insert(agentApiKeys).values({
      agentId: "7471d6e8-5864-46f9-9aec-777e9d2e0503",
      companyId: "ae8a6f0b-fb45-4a17-8f33-b273cc348730",
      name: "CEO CLI Key",
      keyHash: "4c9da6f1fb5ded2e540a0a7906e8637a031f8a7d6b8602533ffe191c6ba4acf3",
    });
    console.log("API key inserted successfully");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
