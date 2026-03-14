// Simple script to make user admin using raw SQL
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'jigong',
  user: 'jigong',
  password: 'jigong',
});

await client.connect();

const userId = 'mL0Ks8THRc4k5WU6YtHzR9ZiKcRO5X3k';

// Check if user is already admin
const checkResult = await client.query(
  'SELECT * FROM instance_user_roles WHERE user_id = $1',
  [userId]
);

if (checkResult.rows.length === 0) {
  await client.query(
    'INSERT INTO instance_user_roles (user_id, role) VALUES ($1, $2)',
    [userId, 'instance_admin']
  );
  console.log('✓ User is now instance admin');
} else {
  console.log('User already has role:', checkResult.rows[0].role);
}

// Add user to company as owner
const companiesResult = await client.query('SELECT id, name FROM companies');
for (const company of companiesResult.rows) {
  const memberCheck = await client.query(
    'SELECT * FROM company_memberships WHERE company_id = $1',
    [company.id]
  );
  if (memberCheck.rows.length === 0) {
    await client.query(
      'INSERT INTO company_memberships (company_id, principal_type, principal_id, status, membership_role) VALUES ($1, $2, $3, $4, $5)',
      [company.id, 'user', userId, 'active', 'owner']
    );
    console.log(`✓ Added as owner to company: ${company.name}`);
  }
}

await client.end();
console.log('Done!');
