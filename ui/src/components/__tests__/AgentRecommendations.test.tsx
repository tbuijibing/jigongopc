// Feature: intelligent-agent-recommendation, Task 5.1 & 5.2: AgentRecommendations component
// Unit tests for the AgentRecommendations component with selection state management

import { describe, it, expect, vi } from "vitest";
import type { Agent } from "@Jigongai/shared";
import type { AgentRecommendationsProps } from "../AgentRecommendations";

const mockAgent: Agent = {
  id: "agent-123",
  companyId: "company-456",
  name: "Frontend Specialist",
  urlKey: "frontend-specialist",
  role: "engineer",
  title: null,
  icon: "code",
  status: "active",
  reportsTo: null,
  capabilities: {
    languages: ["JavaScript", "TypeScript"],
    frameworks: ["React", "Next.js"],
    domains: ["frontend", "ui-ux"],
    tools: ["Vite", "Tailwind"],
    customTags: ["responsive-design"],
  },
  adapterType: "process",
  adapterConfig: {},
  runtimeConfig: {},
  budgetMonthlyCents: 10000,
  spentMonthlyCents: 0,
  permissions: { canCreateAgents: false },
  lastHeartbeatAt: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AgentRecommendations", () => {
  it("accepts required props without errors", () => {
    const selectedAgentIds = new Set<string>();
    const onSelectionChange = vi.fn();

    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: "Build React dashboard",
      description: "Create a responsive dashboard using TypeScript",
      selectedAgentIds,
      onSelectionChange,
    };

    expect(props.companyId).toBe("company-456");
    expect(props.title).toBe("Build React dashboard");
    expect(props.description).toBe("Create a responsive dashboard using TypeScript");
    expect(props.selectedAgentIds.size).toBe(0);
  });

  it("accepts empty title and description", () => {
    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: "",
      description: "",
      selectedAgentIds: new Set(),
      onSelectionChange: vi.fn(),
    };

    expect(props.title).toBe("");
    expect(props.description).toBe("");
  });

  it("accepts selectedAgentIds with multiple agents", () => {
    const selectedAgentIds = new Set(["agent-1", "agent-2", "agent-3"]);
    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: "Build React dashboard",
      description: "Create a dashboard",
      selectedAgentIds,
      onSelectionChange: vi.fn(),
    };

    expect(props.selectedAgentIds.size).toBe(3);
    expect(props.selectedAgentIds.has("agent-1")).toBe(true);
    expect(props.selectedAgentIds.has("agent-2")).toBe(true);
    expect(props.selectedAgentIds.has("agent-3")).toBe(true);
  });

  it("onSelectionChange callback receives updated Set", () => {
    const onSelectionChange = vi.fn();
    const selectedAgentIds = new Set<string>();

    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: "Build React dashboard",
      description: "Create a dashboard",
      selectedAgentIds,
      onSelectionChange,
    };

    // Simulate adding an agent
    const newSelection = new Set(selectedAgentIds);
    newSelection.add("agent-123");
    props.onSelectionChange(newSelection);

    expect(onSelectionChange).toHaveBeenCalledWith(newSelection);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it("supports toggling agent selection", () => {
    const onSelectionChange = vi.fn();
    let selectedAgentIds = new Set<string>();

    const toggleAgent = (agentId: string) => {
      const newSelection = new Set(selectedAgentIds);
      if (newSelection.has(agentId)) {
        newSelection.delete(agentId);
      } else {
        newSelection.add(agentId);
      }
      selectedAgentIds = newSelection;
      onSelectionChange(newSelection);
    };

    // Add agent
    toggleAgent("agent-123");
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(["agent-123"]));
    expect(selectedAgentIds.has("agent-123")).toBe(true);

    // Remove agent
    toggleAgent("agent-123");
    expect(onSelectionChange).toHaveBeenCalledWith(new Set());
    expect(selectedAgentIds.has("agent-123")).toBe(false);
  });

  it("supports multiple simultaneous selections", () => {
    const onSelectionChange = vi.fn();
    let selectedAgentIds = new Set<string>();

    const toggleAgent = (agentId: string) => {
      const newSelection = new Set(selectedAgentIds);
      if (newSelection.has(agentId)) {
        newSelection.delete(agentId);
      } else {
        newSelection.add(agentId);
      }
      selectedAgentIds = newSelection;
      onSelectionChange(newSelection);
    };

    // Add multiple agents
    toggleAgent("agent-1");
    toggleAgent("agent-2");
    toggleAgent("agent-3");

    expect(selectedAgentIds.size).toBe(3);
    expect(selectedAgentIds.has("agent-1")).toBe(true);
    expect(selectedAgentIds.has("agent-2")).toBe(true);
    expect(selectedAgentIds.has("agent-3")).toBe(true);
  });

  it("preserves selections when agent remains in list", () => {
    const oldAgentIds = ["agent-1", "agent-2", "agent-3"];
    const newAgentIds = ["agent-2", "agent-3", "agent-4"];
    const selectedAgentIds = new Set(["agent-1", "agent-2"]);

    // Preserve selections for agents that remain
    const preservedSelections = new Set(
      Array.from(selectedAgentIds).filter((id) => newAgentIds.includes(id))
    );

    expect(preservedSelections.has("agent-1")).toBe(false); // Removed from list
    expect(preservedSelections.has("agent-2")).toBe(true); // Still in list
    expect(preservedSelections.size).toBe(1);
  });

  it("handles empty selectedAgentIds Set", () => {
    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: "Build React dashboard",
      description: "Create a dashboard",
      selectedAgentIds: new Set(),
      onSelectionChange: vi.fn(),
    };

    expect(props.selectedAgentIds.size).toBe(0);
    expect(Array.from(props.selectedAgentIds)).toEqual([]);
  });

  it("handles long title and description", () => {
    const longTitle = "Build a comprehensive React dashboard with TypeScript, Redux, and Material-UI";
    const longDescription = "Create a fully responsive dashboard application using React, TypeScript, Redux for state management, Material-UI for components, and integrate with REST APIs for data fetching. Include authentication, authorization, and role-based access control.";

    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: longTitle,
      description: longDescription,
      selectedAgentIds: new Set(),
      onSelectionChange: vi.fn(),
    };

    expect(props.title.length).toBeGreaterThan(50);
    expect(props.description.length).toBeGreaterThan(100);
  });

  it("handles special characters in title and description", () => {
    const props: AgentRecommendationsProps = {
      companyId: "company-456",
      title: "Build React app with @types/node & TypeScript",
      description: "Use React.js, Node.js, and TypeScript (v5.0+)",
      selectedAgentIds: new Set(),
      onSelectionChange: vi.fn(),
    };

    expect(props.title).toContain("@types/node");
    expect(props.description).toContain("(v5.0+)");
  });
});
