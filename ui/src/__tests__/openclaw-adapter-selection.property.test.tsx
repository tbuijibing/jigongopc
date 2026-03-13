// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Source file readers ────────────────────────────────────────────────────

const UI_SRC = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(UI_SRC, relPath), "utf-8");
}

// ─── Helpers: extract adapter config from source ────────────────────────────

/**
 * Parse the OnboardingWizard adapter options array from source.
 * Returns a map of adapterType → { comingSoon, disabledLabel } for each option.
 */
function parseOnboardingAdapterOptions(source: string) {
  const options: Record<string, { comingSoon: boolean; disabledLabel?: string }> = {};

  // Match each adapter option block: { value: "xxx" as const, ... }
  const optionBlockRegex = /\{\s*value:\s*"(\w+)"\s*as\s*const[\s\S]*?\}/g;
  let match: RegExpExecArray | null;

  while ((match = optionBlockRegex.exec(source)) !== null) {
    const block = match[0];
    const adapterType = match[1];
    const comingSoon = /comingSoon:\s*true/.test(block);
    const disabledLabelMatch = block.match(/disabledLabel:\s*"([^"]+)"/);

    options[adapterType] = {
      comingSoon,
      disabledLabel: disabledLabelMatch?.[1],
    };
  }

  return options;
}

/**
 * Parse the ENABLED_INVITE_ADAPTERS set from InviteLanding source.
 * Returns the set of enabled adapter type strings.
 */
function parseEnabledInviteAdapters(source: string): Set<string> {
  const match = source.match(
    /ENABLED_INVITE_ADAPTERS\s*=\s*new\s+Set\(\[([^\]]+)\]\)/,
  );
  if (!match) return new Set();

  const items = match[1].match(/"(\w+)"/g) ?? [];
  return new Set(items.map((s) => s.replace(/"/g, "")));
}

// ─── Generators ─────────────────────────────────────────────────────────────

/** Generator for the scoped bug condition inputs. */
const bugConditionInputArb = fc.record({
  component: fc.constantFrom("OnboardingWizard", "InviteLanding") as fc.Arbitrary<
    "OnboardingWizard" | "InviteLanding"
  >,
  adapterType: fc.constant("openclaw_gateway"),
});

// ─── Property 1: Bug Condition – OpenClaw Gateway 适配器可选择 ──────────────
// **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
//
// For the input { component: "OnboardingWizard" | "InviteLanding", adapterType: "openclaw_gateway" },
// the adapter option SHALL be enabled and selectable.
//
// On UNFIXED code this test is EXPECTED TO FAIL — failure confirms the bug exists.

describe("Property 1: Bug Condition – OpenClaw Gateway adapter SHALL be selectable", () => {
  const onboardingSource = readSource("components/OnboardingWizard.tsx");
  const inviteLandingSource = readSource("pages/InviteLanding.tsx");

  const onboardingOptions = parseOnboardingAdapterOptions(onboardingSource);
  const enabledInviteAdapters = parseEnabledInviteAdapters(inviteLandingSource);

  it("openclaw_gateway SHALL NOT have comingSoon:true in OnboardingWizard and SHALL be in ENABLED_INVITE_ADAPTERS in InviteLanding", () => {
    fc.assert(
      fc.property(bugConditionInputArb, ({ component, adapterType }) => {
        if (component === "OnboardingWizard") {
          // The openclaw_gateway option must exist in the adapter options
          expect(onboardingOptions).toHaveProperty(adapterType);

          const opt = onboardingOptions[adapterType];

          // Bug condition: comingSoon must NOT be true (adapter should be enabled)
          expect(opt.comingSoon).toBe(false);

          // Bug condition: disabledLabel must NOT be set
          expect(opt.disabledLabel).toBeUndefined();
        }

        if (component === "InviteLanding") {
          // Bug condition: openclaw_gateway must be in ENABLED_INVITE_ADAPTERS
          expect(enabledInviteAdapters.has(adapterType)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("OnboardingWizard: openclaw_gateway button is NOT disabled (comingSoon is false)", () => {
    const opt = onboardingOptions["openclaw_gateway"];
    expect(opt).toBeDefined();
    // This will FAIL on unfixed code: comingSoon is true → button disabled
    expect(opt.comingSoon).toBe(false);
  });

  it("InviteLanding: openclaw_gateway is in ENABLED_INVITE_ADAPTERS (option is NOT disabled)", () => {
    // This will FAIL on unfixed code: openclaw_gateway is not in the set
    expect(enabledInviteAdapters.has("openclaw_gateway")).toBe(true);
  });
});
