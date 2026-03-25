import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: 'postgres://jigong:jigong@localhost:5432/jigong' });

try {
  await pool.query(`
    INSERT INTO agent_api_keys (id, agent_id, company_id, name, key_hash, created_at)
    VALUES (gen_random_uuid(), '7471d6e8-5864-46f9-9aec-777e9d2e0503', 'ae8a6f0b-fb45-4a17-8f33-b273cc348730', 'CEO CLI Key', '4c9da6f1fb5ded2e540a0a7906e8637a031f8a7d6b8602533ffe191c6ba4acf3', NOW())
    ON CONFLICT DO NOTHING
  `);
  console.log('API key inserted successfully');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
