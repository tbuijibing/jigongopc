import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@jigongai/db/schema";

const pool = new Pool({ connectionString: "postgres://jigong:jigong@localhost:54329/jigong" });
const db = drizzle(pool, { schema });

async function main() {
  try {
    // Generate a key with known format
    const keyValue = "geeker-ceo-local-key-" + Date.now();
    const crypto = await import("crypto");
    const keyHash = crypto.createHash("sha256").update(keyValue).digest("hex");
    
    await db.insert(schema.agentApiKeys).values({
      agentId: "7471d6e8-5864-46f9-9aec-777e9d2e0503",
      companyId: "ae8a6f0b-fb45-4a17-8f33-b273cc348730",
      name: "CEO Local Key " + new Date().toISOString().slice(0, 10),
      keyHash: keyHash,
    });
    console.log("API key inserted successfully");
    console.log("Key value:", keyValue);
    console.log("Key hash:", keyHash);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
