/**
 * MentionService — parses @human, @agent, and @username mentions from comment body text.
 *
 * Validates: Requirements 9.1, 9.4
 */

import type { CoreServices } from "../types.js";

export interface MentionParseResult {
  agentIds: string[];
  userIds: string[];
  hasHumanMention: boolean;
}

/**
 * Regex to match @mentions in text. Supports alphanumeric chars and hyphens.
 * Examples: @human, @john, @agent-1, @my-agent
 */
const MENTION_PATTERN = /@([\w-]+)/g;

/**
 * Parse all @mentions from a comment body.
 *
 * - `@human` (case-insensitive) sets hasHumanMention = true
 * - Other mentions are matched against known agents (by name/slug) for the company
 * - Mentions that don't match any agent are treated as user references
 * - Returns deduplicated agentIds and userIds with no intersection
 */
export async function parseMentions(
  companyId: string,
  body: string,
  core: CoreServices,
): Promise<MentionParseResult> {
  const result: MentionParseResult = {
    agentIds: [],
    userIds: [],
    hasHumanMention: false,
  };

  if (!body) return result;

  // Extract all unique mention tokens
  const mentions = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset lastIndex since we reuse the global regex
  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(body)) !== null) {
    mentions.add(match[1]);
  }

  if (mentions.size === 0) return result;

  // Check for @human (case-insensitive) and remove from further processing
  const nonHumanMentions: string[] = [];
  for (const mention of mentions) {
    if (mention.toLowerCase() === "human") {
      result.hasHumanMention = true;
    } else {
      nonHumanMentions.push(mention);
    }
  }

  if (nonHumanMentions.length === 0) return result;

  // Fetch agents for this company to match against
  let agents: Array<{ id: string; name: string; slug: string }> = [];
  try {
    agents = await core.agents.findByCompany(companyId);
  } catch {
    // If agent lookup fails, treat all mentions as user references
    agents = [];
  }

  // Build lookup maps for agent matching (case-insensitive)
  const agentByName = new Map<string, string>();
  const agentBySlug = new Map<string, string>();
  for (const agent of agents) {
    if (agent.name) agentByName.set(agent.name.toLowerCase(), agent.id);
    if (agent.slug) agentBySlug.set(agent.slug.toLowerCase(), agent.id);
  }

  const agentIdSet = new Set<string>();
  const userIdSet = new Set<string>();

  for (const mention of nonHumanMentions) {
    const lower = mention.toLowerCase();
    // Try to match as agent by name or slug
    const agentId = agentByName.get(lower) ?? agentBySlug.get(lower);
    if (agentId) {
      agentIdSet.add(agentId);
    } else {
      // Not an agent — treat as user reference (the mention text itself is the userId/username)
      userIdSet.add(mention);
    }
  }

  // Ensure no intersection: if an ID somehow appears in both, keep it only in agentIds
  for (const id of agentIdSet) {
    userIdSet.delete(id);
  }

  result.agentIds = [...agentIdSet];
  result.userIds = [...userIdSet];

  return result;
}
