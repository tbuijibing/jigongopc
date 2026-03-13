import type { AgentCapabilities } from "@Jigongai/shared";

/** Pure function: extract non-empty capability tag groups from an AgentCapabilities object. */
export function extractCapabilityTagGroups(
  capabilities: AgentCapabilities,
): { dimension: string; label: string; tags: string[] }[] {
  const dimensions: { key: keyof AgentCapabilities; label: string }[] = [
    { key: "languages", label: "Languages" },
    { key: "frameworks", label: "Frameworks" },
    { key: "domains", label: "Domains" },
    { key: "tools", label: "Tools" },
    { key: "customTags", label: "Custom Tags" },
  ];
  return dimensions
    .filter((d) => {
      const arr = capabilities[d.key];
      return Array.isArray(arr) && arr.length > 0;
    })
    .map((d) => ({ dimension: d.key, label: d.label, tags: capabilities[d.key] }));
}
