// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Source file reader ─────────────────────────────────────────────────────

const UI_SRC = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(UI_SRC, relPath), "utf-8");
}

// ─── Read sources once ──────────────────────────────────────────────────────

const settingsSource = readSource("pages/CompanySettings.tsx");
const inviteLandingSource = readSource("pages/InviteLanding.tsx");

// ─── Generators ─────────────────────────────────────────────────────────────

const openClawInteractionArb = fc.constantFrom(
  "generate_prompt",
  "copy_snippet",
  "view_snippet",
);

const snippetDisplayScenarioArb = fc.constantFrom(
  "textarea_visible",
  "copy_button_visible",
  "snippet_readonly",
);

const requestTypeArb = fc.constantFrom("human", "agent");

const settingsSectionArb = fc.constantFrom(
  "General",
  "Appearance",
  "Hiring",
  "Danger Zone",
);

// ─── Property 2: Preservation — OpenClaw 邀请流程及现有行为不变
// **Validates: Requirements 3.1, 3.2, 3.3**

describe("Property 2: Preservation – OpenClaw invite flow and existing behavior unchanged", () => {
  it("createOpenClawInvitePrompt call remains present for all OpenClaw interactions", () => {
    fc.assert(
      fc.property(openClawInteractionArb, (_interaction) => {
        // The source must still call createOpenClawInvitePrompt
        const hasCreateOpenClawCall = settingsSource.includes(
          "createOpenClawInvitePrompt",
        );
        expect(hasCreateOpenClawCall).toBe(true);

        // The "Generate OpenClaw Invite Prompt" button text must remain
        const hasOpenClawButton = settingsSource.includes(
          "Generate OpenClaw Invite Prompt",
        );
        expect(hasOpenClawButton).toBe(true);

        // The inviteMutation that calls the OpenClaw endpoint must remain
        const hasInviteMutation = settingsSource.includes("inviteMutation");
        expect(hasInviteMutation).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("textarea and Copy snippet button rendering logic remains present for all snippet display scenarios", () => {
    fc.assert(
      fc.property(snippetDisplayScenarioArb, (_scenario) => {
        // The textarea element for displaying the snippet must remain
        const hasTextarea = settingsSource.includes("<textarea");
        expect(hasTextarea).toBe(true);

        // The "Copy snippet" button text must remain
        const hasCopySnippet = settingsSource.includes("Copy snippet");
        expect(hasCopySnippet).toBe(true);

        // The inviteSnippet state that drives the display must remain
        const hasInviteSnippetState =
          settingsSource.includes("inviteSnippet");
        expect(hasInviteSnippetState).toBe(true);

        // The clipboard write call for copying must remain
        const hasClipboardWrite = settingsSource.includes(
          "navigator.clipboard.writeText",
        );
        expect(hasClipboardWrite).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('InviteLanding preserves requestType "human" and "agent" handling logic', () => {
    fc.assert(
      fc.property(requestTypeArb, (requestType) => {
        // The source must contain requestType handling for both human and agent
        const hasRequestType = inviteLandingSource.includes(
          `requestType: "${requestType}"`,
        );
        expect(hasRequestType).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("InviteLanding preserves join type toggle UI for human and agent", () => {
    fc.assert(
      fc.property(requestTypeArb, (joinType) => {
        // The JoinType type definition must include both human and agent
        const hasJoinTypeDefinition =
          inviteLandingSource.includes('"human" | "agent"');
        expect(hasJoinTypeDefinition).toBe(true);

        // The "Join as" button text pattern must remain
        const hasJoinAsText = inviteLandingSource.includes("Join as");
        expect(hasJoinAsText).toBe(true);

        // The acceptMutation that handles join requests must remain
        const hasAcceptMutation =
          inviteLandingSource.includes("acceptMutation");
        expect(hasAcceptMutation).toBe(true);

        // The acceptInvite API call must remain
        const hasAcceptInvite =
          inviteLandingSource.includes("accessApi.acceptInvite");
        expect(hasAcceptInvite).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Settings page sections (General, Appearance, Hiring, Danger Zone) structure remains unchanged", () => {
    fc.assert(
      fc.property(settingsSectionArb, (section) => {
        // Each section heading must remain present in the source
        const hasSectionHeading = settingsSource.includes(section);
        expect(hasSectionHeading).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Settings page preserves Invites section with bordered container structure", () => {
    fc.assert(
      fc.property(settingsSectionArb, (_section) => {
        // The Invites section must remain present
        const hasInvitesSection = settingsSource.includes("Invites");
        expect(hasInvitesSection).toBe(true);

        // The overall page layout with bordered containers must remain
        const hasBorderedContainers =
          settingsSource.includes("rounded-md border border-border");
        expect(hasBorderedContainers).toBe(true);

        // The Company Settings heading must remain
        const hasSettingsHeading =
          settingsSource.includes("Company Settings");
        expect(hasSettingsHeading).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
