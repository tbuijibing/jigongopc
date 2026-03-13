import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { DEPENDENCY_TYPES } from "@jigongai/shared";

/**
 * Property 11: Circular dependency rejection
 *
 * For any dependency graph among Issues, if adding a new blocks/required_by
 * dependency would create a cycle, the creation SHALL be rejected with a 422
 * error. The existing dependency graph SHALL remain unchanged.
 *
 * Property 12: Dependency query completeness
 *
 * For any Issue with dependencies, querying its dependencies SHALL return all
 * forward dependencies (issues it depends on) and all reverse dependencies
 * (issues that depend on it).
 *
 * Both properties are modelled as pure functions (no DB needed) following
 * the pattern in issue-type.property.test.ts.
 *
 * **Validates: Requirements 9.4, 9.5**
 */

// ── Types ───────────────────────────────────────────────────────────────────

type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** Directional types that participate in cycle detection */
const DIRECTIONAL_TYPES: DependencyType[] = ["blocks", "required_by"];

interface Edge {
  from: string; // issueId
  to: string; // dependsOnIssueId
  type: DependencyType;
}

/** Adjacency list representation of a dependency graph */
type Graph = Map<string, Edge[]>;

type CreateResult =
  | { accepted: true; graph: Graph }
  | { rejected: true; status: 422; reason: string };

interface DependencyQueryResult {
  forward: Edge[]; // edges where issueId === queried node
  reverse: Edge[]; // edges where dependsOnIssueId === queried node
}

// ── Pure graph logic (mirrors IssueDependencyService) ───────────────────────

/** Build an adjacency list from a list of edges */
function buildGraph(edges: Edge[]): Graph {
  const graph: Graph = new Map();
  for (const edge of edges) {
    if (!graph.has(edge.from)) graph.set(edge.from, []);
    graph.get(edge.from)!.push(edge);
  }
  return graph;
}

/** Deep-clone a graph so mutations don't affect the original */
function cloneGraph(graph: Graph): Graph {
  const clone: Graph = new Map();
  for (const [key, edges] of graph) {
    clone.set(key, edges.map((e) => ({ ...e })));
  }
  return clone;
}

/** Collect all edges from a graph into a flat array */
function allEdges(graph: Graph): Edge[] {
  const edges: Edge[] = [];
  for (const list of graph.values()) {
    edges.push(...list);
  }
  return edges;
}

/**
 * DFS cycle detection — mirrors detectCycle in issue-dependencies.ts.
 *
 * Checks whether `fromIssueId` is reachable from `toIssueId` by following
 * forward directional edges (blocks/required_by). If reachable, adding
 * fromIssueId → toIssueId would create a cycle.
 */
function detectCycle(graph: Graph, fromIssueId: string, toIssueId: string): boolean {
  const visited = new Set<string>();
  const stack = [toIssueId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromIssueId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const outEdges = graph.get(current) ?? [];
    for (const edge of outEdges) {
      if (edge.type === "blocks" || edge.type === "required_by") {
        if (!visited.has(edge.to)) {
          stack.push(edge.to);
        }
      }
    }
  }
  return false;
}

/**
 * Pure-function equivalent of createDependency.
 *
 * - Self-dependency → rejected
 * - Duplicate edge → rejected
 * - Cycle for blocks/required_by → rejected (422), graph unchanged
 * - Otherwise → accepted, edge added to graph
 */
function createDependency(
  graph: Graph,
  from: string,
  to: string,
  type: DependencyType,
): CreateResult {
  if (from === to) {
    return { rejected: true, status: 422, reason: "An issue cannot depend on itself" };
  }

  // Check duplicate
  const existing = allEdges(graph);
  if (existing.some((e) => e.from === from && e.to === to)) {
    return { rejected: true, status: 422, reason: "Dependency already exists" };
  }

  // Cycle detection for directional types
  if (type === "blocks" || type === "required_by") {
    if (detectCycle(graph, from, to)) {
      return { rejected: true, status: 422, reason: "Circular dependency detected" };
    }
  }

  // Add edge
  const newGraph = cloneGraph(graph);
  if (!newGraph.has(from)) newGraph.set(from, []);
  newGraph.get(from)!.push({ from, to, type });
  return { accepted: true, graph: newGraph };
}

/**
 * Pure-function equivalent of getDependencies.
 *
 * Returns forward (edges where node is source) and reverse (edges where
 * node is target) dependencies.
 */
function getDependencies(graph: Graph, nodeId: string): DependencyQueryResult {
  const edges = allEdges(graph);
  return {
    forward: edges.filter((e) => e.from === nodeId),
    reverse: edges.filter((e) => e.to === nodeId),
  };
}

// ── Generators ──────────────────────────────────────────────────────────────

/** Small set of node IDs to increase chance of interesting graph structures */
const nodeIdArb = fc.constantFrom("A", "B", "C", "D", "E", "F");

const directionalTypeArb: fc.Arbitrary<DependencyType> = fc.constantFrom(
  ...DIRECTIONAL_TYPES,
);

const depTypeArb: fc.Arbitrary<DependencyType> = fc.constantFrom(...DEPENDENCY_TYPES);

/** Generate a valid acyclic graph by adding edges one at a time, skipping cycles */
const acyclicGraphArb: fc.Arbitrary<{ graph: Graph; edges: Edge[] }> = fc
  .array(
    fc.record({
      from: nodeIdArb,
      to: nodeIdArb,
      type: directionalTypeArb,
    }),
    { minLength: 0, maxLength: 12 },
  )
  .map((candidateEdges) => {
    let graph: Graph = new Map();
    const accepted: Edge[] = [];
    for (const candidate of candidateEdges) {
      const result = createDependency(graph, candidate.from, candidate.to, candidate.type);
      if ("accepted" in result) {
        graph = result.graph;
        accepted.push({ from: candidate.from, to: candidate.to, type: candidate.type });
      }
    }
    return { graph, edges: accepted };
  });

// ── Property 11: Circular dependency rejection ─────────────────────────────

describe("Property 11: Circular dependency rejection — creating a cycle returns 422, graph unchanged", () => {
  it("direct cycle (A→B then B→A) is rejected for directional types", () => {
    fc.assert(
      fc.property(
        nodeIdArb,
        nodeIdArb,
        directionalTypeArb,
        directionalTypeArb,
        (a, b, type1, type2) => {
          fc.pre(a !== b);

          // Build graph with A→B
          let graph: Graph = new Map();
          const r1 = createDependency(graph, a, b, type1);
          expect("accepted" in r1).toBe(true);
          if (!("accepted" in r1)) return;
          graph = r1.graph;

          // Attempt B→A — should be rejected
          const graphBefore = cloneGraph(graph);
          const r2 = createDependency(graph, b, a, type2);
          expect("rejected" in r2).toBe(true);
          if ("rejected" in r2) {
            expect(r2.status).toBe(422);
          }

          // Graph unchanged after rejection
          expect(allEdges(graph)).toEqual(allEdges(graphBefore));
        },
      ),
      { numRuns: 300 },
    );
  });

  it("transitive cycle (A→B→C then C→A) is rejected for directional types", () => {
    fc.assert(
      fc.property(
        nodeIdArb,
        nodeIdArb,
        nodeIdArb,
        directionalTypeArb,
        directionalTypeArb,
        directionalTypeArb,
        (a, b, c, t1, t2, t3) => {
          fc.pre(a !== b && b !== c && a !== c);

          let graph: Graph = new Map();
          const r1 = createDependency(graph, a, b, t1);
          expect("accepted" in r1).toBe(true);
          if (!("accepted" in r1)) return;
          graph = r1.graph;

          const r2 = createDependency(graph, b, c, t2);
          expect("accepted" in r2).toBe(true);
          if (!("accepted" in r2)) return;
          graph = r2.graph;

          // Attempt C→A — should be rejected (cycle: A→B→C→A)
          const graphBefore = cloneGraph(graph);
          const r3 = createDependency(graph, c, a, t3);
          expect("rejected" in r3).toBe(true);
          if ("rejected" in r3) {
            expect(r3.status).toBe(422);
          }

          // Graph unchanged
          expect(allEdges(graph)).toEqual(allEdges(graphBefore));
        },
      ),
      { numRuns: 300 },
    );
  });

  it("relates_to edges do NOT trigger cycle detection", () => {
    fc.assert(
      fc.property(nodeIdArb, nodeIdArb, (a, b) => {
        fc.pre(a !== b);

        // A→B as relates_to
        let graph: Graph = new Map();
        const r1 = createDependency(graph, a, b, "relates_to");
        expect("accepted" in r1).toBe(true);
        if (!("accepted" in r1)) return;
        graph = r1.graph;

        // B→A as relates_to — should be accepted (no cycle semantics)
        const r2 = createDependency(graph, b, a, "relates_to");
        expect("accepted" in r2).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("self-dependency is always rejected", () => {
    fc.assert(
      fc.property(nodeIdArb, depTypeArb, (node, type) => {
        const graph: Graph = new Map();
        const result = createDependency(graph, node, node, type);
        expect("rejected" in result).toBe(true);
        if ("rejected" in result) {
          expect(result.status).toBe(422);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("on any acyclic graph, adding a cycle-creating edge is rejected and graph stays unchanged", () => {
    fc.assert(
      fc.property(
        acyclicGraphArb,
        nodeIdArb,
        nodeIdArb,
        directionalTypeArb,
        ({ graph }, from, to, type) => {
          // Only test when the new edge would actually create a cycle
          fc.pre(from !== to);
          fc.pre(detectCycle(graph, from, to));

          const graphBefore = cloneGraph(graph);
          const result = createDependency(graph, from, to, type);

          expect("rejected" in result).toBe(true);
          if ("rejected" in result) {
            expect(result.status).toBe(422);
          }
          // Graph unchanged
          expect(allEdges(graph)).toEqual(allEdges(graphBefore));
        },
      ),
      { numRuns: 500 },
    );
  });

  it("on any acyclic graph, adding a non-cycle edge is accepted", () => {
    fc.assert(
      fc.property(
        acyclicGraphArb,
        nodeIdArb,
        nodeIdArb,
        directionalTypeArb,
        ({ graph }, from, to, type) => {
          fc.pre(from !== to);
          // No cycle would be created
          fc.pre(!detectCycle(graph, from, to));
          // Not a duplicate
          fc.pre(!allEdges(graph).some((e) => e.from === from && e.to === to));

          const result = createDependency(graph, from, to, type);
          expect("accepted" in result).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ── Property 12: Dependency query completeness ──────────────────────────────

describe("Property 12: Dependency query completeness — query returns all forward and reverse dependencies", () => {
  it("forward deps = all edges where queried node is source", () => {
    fc.assert(
      fc.property(acyclicGraphArb, nodeIdArb, ({ graph }, nodeId) => {
        const { forward } = getDependencies(graph, nodeId);
        const edges = allEdges(graph);

        // Every forward result has nodeId as source
        for (const dep of forward) {
          expect(dep.from).toBe(nodeId);
        }

        // Count matches expected
        const expected = edges.filter((e) => e.from === nodeId);
        expect(forward.length).toBe(expected.length);
      }),
      { numRuns: 300 },
    );
  });

  it("reverse deps = all edges where queried node is target", () => {
    fc.assert(
      fc.property(acyclicGraphArb, nodeIdArb, ({ graph }, nodeId) => {
        const { reverse } = getDependencies(graph, nodeId);
        const edges = allEdges(graph);

        // Every reverse result has nodeId as target
        for (const dep of reverse) {
          expect(dep.to).toBe(nodeId);
        }

        // Count matches expected
        const expected = edges.filter((e) => e.to === nodeId);
        expect(reverse.length).toBe(expected.length);
      }),
      { numRuns: 300 },
    );
  });

  it("forward + reverse covers all edges involving the queried node", () => {
    fc.assert(
      fc.property(acyclicGraphArb, nodeIdArb, ({ graph }, nodeId) => {
        const { forward, reverse } = getDependencies(graph, nodeId);
        const edges = allEdges(graph);

        // All edges involving nodeId
        const allInvolving = edges.filter((e) => e.from === nodeId || e.to === nodeId);

        // Union of forward and reverse should cover all involving edges
        const combined = [...forward, ...reverse];
        expect(combined.length).toBe(allInvolving.length);

        // Every involving edge appears in combined
        for (const edge of allInvolving) {
          const found = combined.some(
            (c) => c.from === edge.from && c.to === edge.to && c.type === edge.type,
          );
          expect(found).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("forward and reverse are disjoint (no edge appears in both) unless node is both source and target", () => {
    fc.assert(
      fc.property(acyclicGraphArb, nodeIdArb, ({ graph }, nodeId) => {
        const { forward, reverse } = getDependencies(graph, nodeId);

        // An edge can only be in both if from === to === nodeId, which is
        // impossible since self-deps are rejected. So they must be disjoint.
        for (const fwd of forward) {
          const inReverse = reverse.some(
            (r) => r.from === fwd.from && r.to === fwd.to && r.type === fwd.type,
          );
          expect(inReverse).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("node with no edges returns empty forward and reverse", () => {
    fc.assert(
      fc.property(acyclicGraphArb, ({ graph }) => {
        // Pick a node that has no edges at all
        const edges = allEdges(graph);
        const involvedNodes = new Set(edges.flatMap((e) => [e.from, e.to]));
        const isolatedNode = "ISOLATED";
        fc.pre(!involvedNodes.has(isolatedNode));

        const { forward, reverse } = getDependencies(graph, isolatedNode);
        expect(forward.length).toBe(0);
        expect(reverse.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("query includes all dependency types (blocks, required_by, relates_to)", () => {
    fc.assert(
      fc.property(
        nodeIdArb,
        nodeIdArb,
        nodeIdArb,
        (a, b, c) => {
          fc.pre(a !== b && a !== c && b !== c);

          // Build graph with all three dependency types from node A
          let graph: Graph = new Map();
          const r1 = createDependency(graph, a, b, "blocks");
          if (!("accepted" in r1)) return;
          graph = r1.graph;

          const r2 = createDependency(graph, a, c, "relates_to");
          if (!("accepted" in r2)) return;
          graph = r2.graph;

          const { forward } = getDependencies(graph, a);
          const types = new Set(forward.map((e) => e.type));

          expect(types.has("blocks")).toBe(true);
          expect(types.has("relates_to")).toBe(true);
          expect(forward.length).toBe(2);
        },
      ),
      { numRuns: 200 },
    );
  });
});
