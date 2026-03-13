import { and, eq, or } from "drizzle-orm";
import type { Db } from "@jigongai/db";
import { issues, issueDependencies } from "@jigongai/db";
import { DEPENDENCY_TYPES } from "@jigongai/shared";
import { notFound, unprocessable } from "../errors.js";

function validateDependencyType(type: string): void {
  if (!(DEPENDENCY_TYPES as readonly string[]).includes(type)) {
    throw unprocessable(
      `Invalid dependencyType '${type}'. Must be one of: ${DEPENDENCY_TYPES.join(", ")}`,
    );
  }
}

export function issueDependencyService(db: Db) {
  /**
   * Verify an issue exists and belongs to the given company. Returns the issue row subset.
   */
  async function ensureIssueBelongsToCompany(
    companyId: string,
    issueId: string,
  ): Promise<{ id: string; companyId: string }> {
    const issue = await db
      .select({ id: issues.id, companyId: issues.companyId })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!issue) {
      throw notFound("Issue not found in this company");
    }
    return issue;
  }

  /**
   * Detect circular dependencies using DFS.
   * Only blocks and required_by types have directional semantics that can form cycles.
   * relates_to is bidirectional/non-blocking so we skip cycle detection for it.
   */
  async function detectCycle(
    companyId: string,
    fromIssueId: string,
    toIssueId: string,
  ): Promise<boolean> {
    // We need to check: can we reach fromIssueId starting from toIssueId
    // by following existing blocks/required_by edges?
    // If yes, adding fromIssueId -> toIssueId would create a cycle.
    const visited = new Set<string>();
    const stack = [toIssueId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromIssueId) {
        return true; // cycle detected
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      // Follow forward edges: current -> dependsOnIssueId (blocks/required_by only)
      const edges = await db
        .select({ dependsOnIssueId: issueDependencies.dependsOnIssueId })
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.issueId, current),
            or(
              eq(issueDependencies.dependencyType, "blocks"),
              eq(issueDependencies.dependencyType, "required_by"),
            ),
          ),
        );

      for (const edge of edges) {
        if (!visited.has(edge.dependsOnIssueId)) {
          stack.push(edge.dependsOnIssueId);
        }
      }
    }

    return false;
  }

  return {
    createDependency: async (
      companyId: string,
      issueId: string,
      dependsOnIssueId: string,
      dependencyType: string,
    ) => {
      // Validate dependency type
      validateDependencyType(dependencyType);

      // Cannot depend on self
      if (issueId === dependsOnIssueId) {
        throw unprocessable("An issue cannot depend on itself");
      }

      // Validate both issues belong to the same company
      await ensureIssueBelongsToCompany(companyId, issueId);
      await ensureIssueBelongsToCompany(companyId, dependsOnIssueId);

      // Detect circular dependencies for blocks/required_by types
      if (dependencyType === "blocks" || dependencyType === "required_by") {
        const hasCycle = await detectCycle(companyId, issueId, dependsOnIssueId);
        if (hasCycle) {
          throw unprocessable(
            "Creating this dependency would result in a circular dependency",
          );
        }
      }

      // Insert the dependency (unique constraint on issueId+dependsOnIssueId handles duplicates)
      try {
        return await db
          .insert(issueDependencies)
          .values({
            companyId,
            issueId,
            dependsOnIssueId,
            dependencyType,
          })
          .returning()
          .then((rows) => rows[0]);
      } catch (err: any) {
        // Handle unique constraint violation
        if (err.code === "23505") {
          throw unprocessable(
            "A dependency between these two issues already exists",
          );
        }
        throw err;
      }
    },

    getDependencies: async (companyId: string, issueId: string) => {
      // Forward dependencies: issues that this issue depends on
      const forward = await db
        .select()
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.issueId, issueId),
          ),
        );

      // Reverse dependencies: issues that depend on this issue
      const reverse = await db
        .select()
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.dependsOnIssueId, issueId),
          ),
        );

      return { forward, reverse };
    },

    deleteDependency: async (companyId: string, depId: string) => {
      const deleted = await db
        .delete(issueDependencies)
        .where(
          and(
            eq(issueDependencies.id, depId),
            eq(issueDependencies.companyId, companyId),
          ),
        )
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!deleted) {
        throw notFound("Dependency not found");
      }
      return deleted;
    },
  };
}
