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

// ─── Read CompanySettings source once ───────────────────────────────────────

const settingsSource = readSource("pages/CompanySettings.tsx");

// ─── Generator ──────────────────────────────────────────────────────────────

const allowedJoinTypesArb = fc.constantFrom("human", "agent", "both");

// ─── Property 1: Bug Condition — Settings Invites 区域缺少通用邀请链接创建按钮
// **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4**
//
// For all allowedJoinTypes values, CompanySettings.tsx source SHALL contain:
// 1. "Create Invite Link" button rendering logic
// 2. Calls to accessApi.createCompanyInvite or createCompanyInvite
// 3. Join type selector (human / agent / both options)
//
// On UNFIXED code this test is EXPECTED TO FAIL — failure confirms the bug exists.

describe("Property 1: Bug Condition – Invites section missing general invite link creation", () => {
  it("CompanySettings SHALL contain 'Create Invite Link' button for all allowedJoinTypes", () => {
    fc.assert(
      fc.property(allowedJoinTypesArb, (_allowedJoinType) => {
        // The source must contain a "Create Invite Link" button
        const hasCreateInviteLinkButton =
          settingsSource.includes("Create Invite Link");

        expect(hasCreateInviteLinkButton).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("CompanySettings SHALL call createCompanyInvite to create general invites", () => {
    fc.assert(
      fc.property(allowedJoinTypesArb, (_allowedJoinType) => {
        // The source must call accessApi.createCompanyInvite or createCompanyInvite
        const callsCreateCompanyInvite =
          settingsSource.includes("createCompanyInvite");

        expect(callsCreateCompanyInvite).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("CompanySettings SHALL contain join type selector with human/agent/both options", () => {
    fc.assert(
      fc.property(allowedJoinTypesArb, (allowedJoinType) => {
        // The source must reference the specific join type value
        // This checks that the UI provides a way to select each join type
        const hasJoinTypeReference = settingsSource.includes(
          `"${allowedJoinType}"`,
        );

        expect(hasJoinTypeReference).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
