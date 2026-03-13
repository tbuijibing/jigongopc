/**
 * Prompt Assembly Service
 *
 * Assembles Agent six-dimension context in order: Soul → Skills → Memory → Tools.
 * Memory uses task → project → agent priority.
 * Passes assembled data to the appropriate Adapter injection methods.
 * On failure of any dimension, logs a warning and uses a noop result.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

import type { Db } from "@jigongai/db";
import type { InjectionResult } from "../adapters/types.js";
import { soulService } from "./soul.js";
import { agentSkillService } from "./agent-skills.js";
import { agentMemoryService } from "./agent-memories.js";
import { agentToolService } from "./agent-tools.js";
import { createLocalAdapterInjection, isLocalAdapter } from "../adapters/local-injection.js";
import { createRemoteAdapterInjection, isRemoteAdapter } from "../adapters/remote-injection.js";

export function promptAssemblyService(db: Db) {
  const souls = soulService(db);
  const skills = agentSkillService(db);
  const memories = agentMemoryService(db);
  const tools = agentToolService(db);

  async function assembleContext(
    companyId: string,
    agentId: string,
    adapterType: string,
    options?: { issueId?: string; projectId?: string },
  ): Promise<InjectionResult[]> {
    // Resolve adapter injection implementation
    let injection;
    if (isLocalAdapter(adapterType)) {
      injection = createLocalAdapterInjection(adapterType);
    } else if (isRemoteAdapter(adapterType)) {
      injection = createRemoteAdapterInjection(adapterType);
    } else {
      console.warn(`[prompt-assembly] Unknown adapter type '${adapterType}', skipping injection`);
      return [];
    }

    const results: InjectionResult[] = [];

    // 1. Soul
    try {
      const soulResult = await souls.getSoul(companyId, agentId);
      results.push(await injection.prepareSoul(soulResult.data));
    } catch (err) {
      console.warn("[prompt-assembly] Failed to read Soul, using noop:", err);
      results.push({ type: "noop", reason: "soul read failed" });
    }

    // 2. Skills
    try {
      const skillResult = await skills.getAgentSkills(companyId, agentId);
      const skillRows = skillResult.skills ?? [];
      results.push(await injection.prepareSkills(skillRows));
    } catch (err) {
      console.warn("[prompt-assembly] Failed to read Skills, using noop:", err);
      results.push({ type: "noop", reason: "skills read failed" });
    }

    // 3. Memory (task → project → agent priority)
    try {
      const memoryRows = await memories.readMemories(companyId, agentId, {
        taskScopeId: options?.issueId,
        projectScopeId: options?.projectId,
      });
      results.push(await injection.prepareMemories(memoryRows));
    } catch (err) {
      console.warn("[prompt-assembly] Failed to read Memory, using noop:", err);
      results.push({ type: "noop", reason: "memory read failed" });
    }

    // 4. Tools
    try {
      const toolRows = await tools.listTools(companyId, agentId);
      results.push(await injection.prepareTools(toolRows));
    } catch (err) {
      console.warn("[prompt-assembly] Failed to read Tools, using noop:", err);
      results.push({ type: "noop", reason: "tools read failed" });
    }

    return results;
  }

  return { assembleContext };
}
