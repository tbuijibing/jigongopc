import { describe, it, expect } from "vitest";
import { parseMentions, type MentionParseResult } from "./mention.js";
import type { CoreServices } from "../types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockCore(agents: Array<{ id: string; name: string; slug: string }> = []): CoreServices {
  return {
    agents: {
      findByCompany: async (_companyId: string) => agents,
    },
    issues: {},
    projects: {},
    goals: {},
    activity: {},
  } as CoreServices;
}

const COMPANY_ID = "company-1";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("parseMentions", () => {
  it("returns empty result when body has no mentions", async () => {
    const core = createMockCore();
    const result = await parseMentions(COMPANY_ID, "Just a regular comment", core);

    expect(result.agentIds).toEqual([]);
    expect(result.userIds).toEqual([]);
    expect(result.hasHumanMention).toBe(false);
  });

  it("returns empty result for empty body", async () => {
    const core = createMockCore();
    const result = await parseMentions(COMPANY_ID, "", core);

    expect(result.agentIds).toEqual([]);
    expect(result.userIds).toEqual([]);
    expect(result.hasHumanMention).toBe(false);
  });

  it("detects @human mention (case-insensitive)", async () => {
    const core = createMockCore();

    const r1 = await parseMentions(COMPANY_ID, "Hey @human please review", core);
    expect(r1.hasHumanMention).toBe(true);
    expect(r1.agentIds).toEqual([]);
    expect(r1.userIds).toEqual([]);

    const r2 = await parseMentions(COMPANY_ID, "Hey @Human please review", core);
    expect(r2.hasHumanMention).toBe(true);

    const r3 = await parseMentions(COMPANY_ID, "Hey @HUMAN please review", core);
    expect(r3.hasHumanMention).toBe(true);
  });

  it("matches agent mentions by name", async () => {
    const agents = [
      { id: "agent-1", name: "cto", slug: "cto-agent" },
      { id: "agent-2", name: "designer", slug: "designer-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(COMPANY_ID, "Hey @cto can you check this?", core);

    expect(result.agentIds).toEqual(["agent-1"]);
    expect(result.userIds).toEqual([]);
    expect(result.hasHumanMention).toBe(false);
  });

  it("matches agent mentions by slug", async () => {
    const agents = [
      { id: "agent-1", name: "CTO Agent", slug: "cto-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(COMPANY_ID, "Hey @cto-agent review this", core);

    expect(result.agentIds).toEqual(["agent-1"]);
    expect(result.userIds).toEqual([]);
  });

  it("treats unmatched mentions as user references", async () => {
    const agents = [
      { id: "agent-1", name: "cto", slug: "cto-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(COMPANY_ID, "Hey @john please look at this", core);

    expect(result.agentIds).toEqual([]);
    expect(result.userIds).toEqual(["john"]);
  });

  it("handles mixed mentions: @human, @agent, @user", async () => {
    const agents = [
      { id: "agent-1", name: "cto", slug: "cto-agent" },
      { id: "agent-2", name: "designer", slug: "designer-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(
      COMPANY_ID,
      "@human @cto @john @designer this needs review",
      core,
    );

    expect(result.hasHumanMention).toBe(true);
    expect(result.agentIds).toContain("agent-1");
    expect(result.agentIds).toContain("agent-2");
    expect(result.agentIds).toHaveLength(2);
    expect(result.userIds).toEqual(["john"]);
  });

  it("deduplicates mentions when same mention appears multiple times", async () => {
    const agents = [
      { id: "agent-1", name: "cto", slug: "cto-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(
      COMPANY_ID,
      "@cto please review @cto and @john @john",
      core,
    );

    expect(result.agentIds).toEqual(["agent-1"]);
    expect(result.userIds).toEqual(["john"]);
  });

  it("agent matching is case-insensitive", async () => {
    const agents = [
      { id: "agent-1", name: "CTO", slug: "cto-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(COMPANY_ID, "Hey @cto check this", core);
    expect(result.agentIds).toEqual(["agent-1"]);
  });

  it("ensures no intersection between agentIds and userIds", async () => {
    const agents = [
      { id: "agent-1", name: "cto", slug: "cto-agent" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(
      COMPANY_ID,
      "@cto @john @designer-agent",
      core,
    );

    const intersection = result.agentIds.filter((id) => result.userIds.includes(id));
    expect(intersection).toEqual([]);
  });

  it("handles agent lookup failure gracefully — treats all as users", async () => {
    const core: CoreServices = {
      agents: {
        findByCompany: async () => { throw new Error("DB error"); },
      },
      issues: {},
      projects: {},
      goals: {},
      activity: {},
    } as CoreServices;

    const result = await parseMentions(COMPANY_ID, "@cto @john", core);

    expect(result.agentIds).toEqual([]);
    expect(result.userIds).toContain("cto");
    expect(result.userIds).toContain("john");
  });

  it("handles mentions with hyphens", async () => {
    const agents = [
      { id: "agent-1", name: "my-agent", slug: "my-agent-slug" },
    ];
    const core = createMockCore(agents);

    const result = await parseMentions(COMPANY_ID, "Hey @my-agent check this", core);
    expect(result.agentIds).toEqual(["agent-1"]);
  });

  it("does not treat @human as a user or agent", async () => {
    const agents = [
      { id: "agent-human", name: "human", slug: "human-agent" },
    ];
    const core = createMockCore(agents);

    // @human is always the special wildcard, even if an agent named "human" exists
    const result = await parseMentions(COMPANY_ID, "@human review this", core);
    expect(result.hasHumanMention).toBe(true);
    expect(result.agentIds).toEqual([]);
    expect(result.userIds).toEqual([]);
  });
});
