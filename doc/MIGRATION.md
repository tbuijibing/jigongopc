# Data Migration Guide

This document describes how to migrate existing agent data to the new six-dimension model.

## Overview

The six-dimension model organizes agent configuration into separate, focused tables:
- **Heartbeat configs** (`agent_heartbeat_configs`) - Wake-up and scheduling settings
- **Souls** (`agent_souls`) - System prompts and personality
- **Tools** (`agent_tools`) - Tool registrations and configurations
- **Skills** (`skill_registry` + `agent_skills`) - Reusable instruction sets
- **Memories** (`agent_memories`) - Agent memory storage
- **Capabilities** (structured JSON in `agents.capabilities`) - Searchable capability tags

## When to Run Migrations

Run migrations after upgrading to a version that includes the six-dimension model if you have existing agents created before this change. This is especially important for:

- **OpenClaw agents** - These agents may not have legacy config data, so the migration creates default records
- **Agents with legacy configs** - Migrates data from old `adapterConfig` and `runtimeConfig` fields

## Running the Migration

### Prerequisites

1. Ensure your database is accessible via `DATABASE_URL` environment variable
2. Back up your database before running migrations (recommended)

### Steps

1. **Set DATABASE_URL** (if not already set in `.env`):
   ```bash
   export DATABASE_URL=postgres://user:password@localhost:5432/Jigong
   ```

2. **Run the migration script**:
   ```bash
   node cli/node_modules/tsx/dist/cli.mjs server/src/migrations/run-all.ts
   ```

   Or if you have tsx installed globally:
   ```bash
   tsx server/src/migrations/run-all.ts
   ```

### What Gets Migrated

The migration script runs four migrations in sequence:

1. **Heartbeat configs** - Creates default heartbeat configs for all agents
   - Agents with `runtimeConfig.heartbeat` → migrates those settings
   - Agents without → creates default config (enabled, 5min interval, etc.)

2. **Souls** - Creates soul records for all agents
   - Agents with `adapterConfig.promptTemplate` → uses that as systemPrompt
   - Agents without → creates empty soul record

3. **Skills** - Migrates file-based skills to skill registry
   - Agents with `instructionsFilePath` → reads file and creates skill entry
   - Creates `agent_skills` link for each migrated skill

4. **Capabilities** - Restructures capability data
   - Converts flat capability arrays to structured format with categories

### Migration Output

The script outputs progress for each migration:

```
[run-all] Starting data migrations...

[run-all] Using database: localhost:5432/Jigong
[run-all] 1/4 Migrating heartbeat configs...
  ✓ Heartbeats: 27 migrated, 0 skipped

[run-all] 2/4 Migrating souls...
  ✓ Souls: 27 migrated, 0 skipped

[run-all] 3/4 Migrating skills...
  ✓ Skills: 8 migrated, 0 skipped, 3 file errors

[run-all] 4/4 Migrating capabilities...
  ✓ Capabilities: 11 migrated, 0 skipped

[run-all] ✅ All migrations complete!
```

### Idempotency

The migration is idempotent - it's safe to run multiple times:
- Skips agents that already have migrated records
- Does not delete or modify original config fields (kept for fallback)

## Troubleshooting

### File Errors During Skill Migration

If you see file errors like:
```
[migrate-skills] Could not read "/path/to/skill" for agent xxx: EISDIR: illegal operation on a directory
```

This is expected for agents with invalid `instructionsFilePath` values. The migration continues and creates records for valid skill files.

### Database Connection Issues

If you see:
```
[run-all] ERROR: DATABASE_URL environment variable is required.
```

Make sure `DATABASE_URL` is set in your environment or `.env` file.

### Verifying Migration Success

After migration, you can verify the data was migrated by checking the new tables:

```sql
-- Check heartbeat configs
SELECT COUNT(*) FROM agent_heartbeat_configs;

-- Check souls
SELECT COUNT(*) FROM agent_souls;

-- Check skills
SELECT COUNT(*) FROM skill_registry;
SELECT COUNT(*) FROM agent_skills;

-- Check capabilities structure
SELECT id, capabilities FROM agents WHERE capabilities IS NOT NULL LIMIT 5;
```

## Post-Migration

After successful migration:

1. **Test the UI** - Open agent detail pages and verify the new tabs load correctly:
   - Heartbeat tab shows wake-up settings
   - Soul tab shows system prompt
   - Tools, Skills, Memory tabs display correctly

2. **Verify API endpoints** - Test the new six-dimension API endpoints work as expected

3. **Monitor logs** - Watch for any errors related to missing data

## Rollback

If you need to rollback:

1. The original config fields (`adapterConfig`, `runtimeConfig`) are preserved
2. Delete migrated records from the new tables:
   ```sql
   DELETE FROM agent_heartbeat_configs;
   DELETE FROM agent_souls;
   DELETE FROM agent_skills;
   DELETE FROM skill_registry;
   -- Reset capabilities to original format if needed
   ```

3. The system will fall back to reading from the original config fields
