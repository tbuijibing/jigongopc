#!/usr/bin/env node

import { inspectMigrations, reconcilePendingMigrationHistory } from '../packages/db/dist/client.js';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

console.log('Inspecting migration state...\n');

const before = await inspectMigrations(url);

console.log('Current state:', before.status);
console.log('Table count:', before.tableCount);
console.log('Applied migrations:', before.appliedMigrations.length);
console.log('Available migrations:', before.availableMigrations.length);

if (before.status === 'needsMigrations') {
  console.log('\nPending migrations:', before.pendingMigrations);
  console.log('Reason:', before.reason);
  
  if (before.reason === 'pending-migrations') {
    console.log('\nAttempting to reconcile migration history...');
    const result = await reconcilePendingMigrationHistory(url);
    
    console.log('\nReconciliation result:');
    console.log('Repaired migrations:', result.repairedMigrations);
    console.log('Remaining migrations:', result.remainingMigrations);
    
    if (result.repairedMigrations.length > 0) {
      console.log('\n✅ Successfully repaired migration history!');
      console.log('The following migrations were marked as applied:');
      result.repairedMigrations.forEach(m => console.log(`  - ${m}`));
    }
    
    if (result.remainingMigrations.length > 0) {
      console.log('\n⚠️  Some migrations still need to be applied:');
      result.remainingMigrations.forEach(m => console.log(`  - ${m}`));
    } else if (result.repairedMigrations.length > 0) {
      console.log('\n✅ All migrations are now up to date!');
    }
  }
} else {
  console.log('\n✅ Database is up to date!');
}
