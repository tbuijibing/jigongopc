/**
 * Seed Agent Configurations
 * 
 * This module provides functions to seed agent configurations into the database
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const { agents, agentSouls, agentTools, agentSkills, agentMemories, skillRegistry } = schema;

interface SoulConfig {
  systemPrompt: string;
  personality?: string;
  constraints?: string;
  language?: string;
}

interface ToolConfig {
  name: string;
  description: string;
  toolType?: string;
  config?: Record<string, any>;
}

interface SkillConfig {
  name: string;
  description: string;
  proficiencyLevel?: string;
}

interface MemoryConfig {
  memoryLayer: string;
  scopeId?: string;
  key: string;
  value: string;
  memoryType?: string;
  importance?: number;
}

interface AgentConfig {
  name: string;
  soul?: SoulConfig;
  tools?: ToolConfig[];
  skills?: SkillConfig[];
  memory?: MemoryConfig[];
}

export async function seedAgentConfigs(configs: AgentConfig[], databaseUrl?: string) {
  const url = databaseUrl || process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error("DATABASE_URL is required. Please set it in your environment or pass it as a parameter.");
  }

  const sql = postgres(url);
  const db = drizzle(sql, { schema });

  try {
    console.log("🐘 Connecting to database...\n");

    console.log("\n🚀 Starting agent configuration seed...\n");

    // Get all agents
    const allAgents = await db.select().from(agents);
    console.log(`📋 Found ${allAgents.length} agents in database\n`);

    if (allAgents.length === 0) {
      console.log("⚠️  No agents found. Please create agents first.");
      return;
    }

    // Process each configuration
    for (const config of configs) {
      const agent = allAgents.find((a: any) => a.name === config.name);
      
      if (!agent) {
        console.log(`⚠️  Agent "${config.name}" not found, skipping...`);
        continue;
      }

      console.log(`📝 Updating ${config.name} (${agent.id})...`);

      // Update Soul
      if (config.soul) {
        await upsertSoul(db, agent, config.soul);
      }

      // Add Tools
      if (config.tools && config.tools.length > 0) {
        for (const tool of config.tools) {
          await addTool(db, agent, tool);
        }
      }

      // Add Skills
      if (config.skills && config.skills.length > 0) {
        for (const skill of config.skills) {
          await addSkill(db, agent, skill);
        }
      }

      // Add Memory
      if (config.memory && config.memory.length > 0) {
        for (const mem of config.memory) {
          await addMemory(db, agent, mem);
        }
      }

      console.log(`✅ ${config.name} completed\n`);
    }

    console.log("✨ All agents configured successfully!");

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

async function upsertSoul(db: any, agent: any, soulConfig: SoulConfig) {
  try {
    const existing = await db.select().from(agentSouls)
      .where(and(
        eq(agentSouls.companyId, agent.companyId),
        eq(agentSouls.agentId, agent.id)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(agentSouls)
        .set({
          systemPrompt: soulConfig.systemPrompt,
          personality: soulConfig.personality || null,
          constraints: soulConfig.constraints || null,
          language: soulConfig.language || 'zh',
          version: existing[0].version + 1,
          updatedAt: new Date()
        })
        .where(eq(agentSouls.id, existing[0].id));
      console.log("  ✓ Soul updated");
    } else {
      await db.insert(agentSouls).values({
        companyId: agent.companyId,
        agentId: agent.id,
        systemPrompt: soulConfig.systemPrompt,
        personality: soulConfig.personality || null,
        constraints: soulConfig.constraints || null,
        language: soulConfig.language || 'zh',
        version: 1
      });
      console.log("  ✓ Soul created");
    }
  } catch (err: any) {
    console.error(`  ✗ Soul failed: ${err.message}`);
  }
}

async function addTool(db: any, agent: any, toolConfig: ToolConfig) {
  try {
    await db.insert(agentTools).values({
      companyId: agent.companyId,
      agentId: agent.id,
      name: toolConfig.name,
      description: toolConfig.description,
      toolType: toolConfig.toolType || 'function',
      config: toolConfig.config || {}
    }).onConflictDoNothing();
    console.log(`  ✓ Tool "${toolConfig.name}" added`);
  } catch (err: any) {
    console.error(`  ✗ Tool "${toolConfig.name}" failed: ${err.message}`);
  }
}

async function addSkill(db: any, agent: any, skillConfig: SkillConfig) {
  try {
    // Generate slug from skill name
    const slug = skillConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // First, find or create the skill in skill_registry
    const existingSkill = await db.select().from(skillRegistry)
      .where(and(
        eq(skillRegistry.companyId, agent.companyId),
        eq(skillRegistry.slug, slug)
      ))
      .limit(1);

    let skillId: string;
    
    if (existingSkill.length > 0) {
      skillId = existingSkill[0].id;
    } else {
      // Create new skill in registry
      const newSkill = await db.insert(skillRegistry).values({
        companyId: agent.companyId,
        name: skillConfig.name,
        slug: slug,
        description: skillConfig.description,
        content: skillConfig.description, // Use description as content
        category: 'general',
        version: '1.0.0',
        isBuiltin: false,
        metadata: { proficiencyLevel: skillConfig.proficiencyLevel || 'intermediate' }
      }).returning({ id: skillRegistry.id });
      
      skillId = newSkill[0].id;
    }

    // Now add the skill to agent_skills
    await db.insert(agentSkills).values({
      companyId: agent.companyId,
      agentId: agent.id,
      skillId: skillId,
      installType: 'manual',
      installedBy: 'seed-script',
      config: { proficiencyLevel: skillConfig.proficiencyLevel || 'intermediate' },
      enabled: true
    }).onConflictDoNothing();
    
    console.log(`  ✓ Skill "${skillConfig.name}" added`);
  } catch (err: any) {
    console.error(`  ✗ Skill "${skillConfig.name}" failed: ${err.message}`);
  }
}

async function addMemory(db: any, agent: any, memConfig: MemoryConfig) {
  try {
    await db.insert(agentMemories).values({
      companyId: agent.companyId,
      agentId: agent.id,
      memoryLayer: memConfig.memoryLayer,
      scopeId: memConfig.scopeId || null,
      key: memConfig.key,
      value: memConfig.value,
      memoryType: memConfig.memoryType || 'context',
      importance: memConfig.importance || 5
    }).onConflictDoNothing();
    console.log(`  ✓ Memory "${memConfig.key}" added`);
  } catch (err: any) {
    console.error(`  ✗ Memory "${memConfig.key}" failed: ${err.message}`);
  }
}
