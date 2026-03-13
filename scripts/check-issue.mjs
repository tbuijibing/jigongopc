#!/usr/bin/env node

import { createDb } from '../packages/db/dist/client.js';
import { issues } from '../packages/db/dist/schema/index.js';
import { eq } from 'drizzle-orm';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const identifier = process.argv[2] || 'FSD-13';

console.log(`Checking for issue: ${identifier}\n`);

const db = createDb(url);

try {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.identifier, identifier),
    with: {
      company: true,
    },
  });

  if (issue) {
    console.log('✅ Issue found:');
    console.log('  ID:', issue.id);
    console.log('  Identifier:', issue.identifier);
    console.log('  Title:', issue.title);
    console.log('  Status:', issue.status);
    console.log('  Company:', issue.company?.name, `(${issue.company?.issuePrefix})`);
    console.log('  Created:', issue.createdAt);
  } else {
    console.log('❌ Issue not found in database');
    
    // Check if there are any issues with similar identifiers
    const allIssues = await db.query.issues.findMany({
      columns: {
        identifier: true,
        title: true,
      },
      limit: 10,
    });
    
    if (allIssues.length > 0) {
      console.log('\nSample issues in database:');
      allIssues.forEach(i => console.log(`  - ${i.identifier}: ${i.title}`));
    } else {
      console.log('\nNo issues found in database at all.');
    }
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

process.exit(0);
