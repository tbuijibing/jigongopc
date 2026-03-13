import type { IssueDependency } from "../api/issue-dependencies";

export type DependencyGroup = {
  blocks: IssueDependency[];
  blockedBy: IssueDependency[];
  related: IssueDependency[];
};

/**
 * Groups dependencies into Blocks / Blocked By / Related based on the current issueId.
 *
 * - Blocks: current issue's issueId matches dep.issueId AND dependencyType is "blocks"
 * - Blocked By: dependencyType is "required_by", OR dependencyType is "blocks" and
 *   dep.dependsOnIssueId matches currentIssueId (or issueId doesn't match current)
 * - Related: dependencyType is "relates_to"
 */
export function groupDependencies(
  deps: IssueDependency[],
  currentIssueId: string,
): DependencyGroup {
  const blocks: IssueDependency[] = [];
  const blockedBy: IssueDependency[] = [];
  const related: IssueDependency[] = [];

  for (const dep of deps) {
    if (dep.dependencyType === "relates_to") {
      related.push(dep);
    } else if (dep.dependencyType === "blocks" && dep.issueId === currentIssueId) {
      blocks.push(dep);
    } else if (dep.dependencyType === "required_by") {
      blockedBy.push(dep);
    } else if (dep.dependencyType === "blocks" && dep.dependsOnIssueId === currentIssueId) {
      blockedBy.push(dep);
    } else {
      blockedBy.push(dep);
    }
  }

  return { blocks, blockedBy, related };
}
