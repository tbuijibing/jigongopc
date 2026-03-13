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
 * Returns a map of adapterType → { comingSoon, label, desc, disabledLabel }.
 */
function parseOnboardingAdapterOptions(source: string) {
  const options: Record<
    string,
    { comingSoon: boolean; label: string; desc: string; disabledLabel?: string }
  > = {};

  // Match each adapter option block: { value: "xxx" as const, ... }
  const optionBlockRegex = /\{\s*value:\s*"(\w+)"\s*as\s*const[\s\S]*?\}/g;
  let match: RegExpExecArray | null;

  while ((match = optionBlockRegex.exec(source)) !== null) {
    const block = match[0];
    const adapterType = match[1];
    const comingSoon = /comingSoon:\s*true/.test(block);
    const labelMatch = block.match(/label:\s*"([^"]+)"/);
    const descMatch = block.match(/desc:\s*"([^"]+)"/);
    const disabledLabelMatch = block.match(/disabledLabel:\s*"([^"]+)"/);

    options[adapterType] = {
      comingSoon,
      label: labelMatch?.[1] ?? "",
      desc: descMatch?.[1] ?? "",
      disabledLabel: disabledLabelMatch?.[1],
    };
  }

  return options;
}

/**
 * Parse the ENABLED_INVITE_ADAPTERS set from InviteLanding source.
 */
function parseEnabledInviteAdapters(source: string): Set<string> {
  const match = source.match(
    /ENABLED_INVITE_ADAPTERS\s*=\s*new\s+Set\(\[([^\]]+)\]\)/,
  );
  if (!match) return new Set();
  const items = match[1].match(/"(\w+)"/g) ?? [];
  return new Set(items.map((s) => s.replace(/"/g, "")));
}

/**
 * Parse the adapterLabels record from InviteLanding source.
 */
function parseAdapterLabels(source: string): Record<string, string> {
  const match = source.match(
    /const\s+adapterLabels[^=]*=\s*\{([\s\S]*?)\};/,
  );
  if (!match) return {};
  const labels: Record<string, string> = {};
  const entryRegex = /(\w+):\s*"([^"]+)"/g;
  let entry: RegExpExecArray | null;
  while ((entry = entryRegex.exec(match[1])) !== null) {
    labels[entry[1]] = entry[2];
  }
  return labels;
}

// ─── Read sources once ──────────────────────────────────────────────────────

const onboardingSource = readSource("components/OnboardingWizard.tsx");
const inviteLandingSource = readSource("pages/InviteLanding.tsx");

const onboardingOptions = parseOnboardingAdapterOptions(onboardingSource);
const enabledInviteAdapters = parseEnabledInviteAdapters(inviteLandingSource);
const inviteAdapterLabels = parseAdapterLabels(inviteLandingSource);

// ─── Expected baseline values (observed on UNFIXED code) ────────────────────

const ONBOARDING_ENABLED_ADAPTERS = [
  "claude_local",
  "codex_local",
  "opencode_local",
  "pi_local",
  "cursor",
] as const;

const INVITE_ENABLED_ADAPTERS = [
  "claude_local",
  "codex_local",
  "opencode_local",
  "cursor",
] as const;

/** Adapters that exist in AGENT_ADAPTER_TYPES but are NOT in ENABLED_INVITE_ADAPTERS
 *  (excluding openclaw_gateway which is the bug target). */
const INVITE_DISABLED_ADAPTERS = ["process", "http"] as const;

const EXPECTED_ONBOARDING_LABELS: Record<string, { label: string; desc: string }> = {
  claude_local: { label: "Claude Code", desc: "Local Claude agent" },
  codex_local: { label: "Codex", desc: "Local Codex agent" },
  opencode_local: { label: "OpenCode", desc: "Local multi-provider agent" },
  pi_local: { label: "Pi", desc: "Local Pi agent" },
  cursor: { label: "Cursor", desc: "Local Cursor agent" },
};

const EXPECTED_INVITE_LABELS: Record<string, string> = {
  claude_local: "Claude (local)",
  codex_local: "Codex (local)",
  opencode_local: "OpenCode (local)",
  cursor: "Cursor (local)",
  process: "Process",
  http: "HTTP",
};

// ─── Generators ─────────────────────────────────────────────────────────────

const onboardingEnabledArb = fc.constantFrom(...ONBOARDING_ENABLED_ADAPTERS);
const inviteEnabledArb = fc.constantFrom(...INVITE_ENABLED_ADAPTERS);
const inviteDisabledArb = fc.constantFrom(...INVITE_DISABLED_ADAPTERS);

// ─── Property 2: Preservation – 其他适配器选择行为不变 ──────────────────────
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

describe("Property 2: Preservation – other adapter selection behavior unchanged", () => {
  it("OnboardingWizard: enabled adapters do NOT have comingSoon and are selectable", () => {
    fc.assert(
      fc.property(onboardingEnabledArb, (adapterType) => {
        expect(onboardingOptions).toHaveProperty(adapterType);
        const opt = onboardingOptions[adapterType];
        expect(opt.comingSoon).toBe(false);
        expect(opt.disabledLabel).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it("InviteLanding: enabled adapters are in ENABLED_INVITE_ADAPTERS", () => {
    fc.assert(
      fc.property(inviteEnabledArb, (adapterType) => {
        expect(enabledInviteAdapters.has(adapterType)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("InviteLanding: non-enabled adapters (excluding openclaw_gateway) remain disabled", () => {
    fc.assert(
      fc.property(inviteDisabledArb, (adapterType) => {
        expect(enabledInviteAdapters.has(adapterType)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("OnboardingWizard: adapter labels and descriptions are unchanged for non-openclaw adapters", () => {
    fc.assert(
      fc.property(onboardingEnabledArb, (adapterType) => {
        const opt = onboardingOptions[adapterType];
        const expected = EXPECTED_ONBOARDING_LABELS[adapterType];
        expect(opt.label).toBe(expected.label);
        expect(opt.desc).toBe(expected.desc);
      }),
      { numRuns: 100 },
    );
  });

  it("InviteLanding: adapter labels are unchanged for non-openclaw adapters", () => {
    const nonOpenclawAdapters = fc.constantFrom(
      ...Object.keys(EXPECTED_INVITE_LABELS),
    );
    fc.assert(
      fc.property(nonOpenclawAdapters, (adapterType) => {
        expect(inviteAdapterLabels[adapterType]).toBe(
          EXPECTED_INVITE_LABELS[adapterType],
        );
      }),
      { numRuns: 100 },
    );
  });
});
