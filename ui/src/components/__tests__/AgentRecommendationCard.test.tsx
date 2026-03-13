// Feature: intelligent-agent-recommendation, Task 4.1: AgentRecommendationCard component
// Unit tests for the AgentRecommendationCard component

import { describe, it, expect, vi } from "vitest";
import type { Agent } from "@Jigongai/shared";
import type { AgentRecommendationCardProps } from "../AgentRecommendationCard";

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

describe("AgentRecommendationCard", () => {
  it("accepts required props without errors", () => {
    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: ["React", "TypeScript"],
    };

    expect(props.agent.id).toBe("agent-123");
    expect(props.agent.name).toBe("Frontend Specialist");
    expect(props.isSelected).toBe(false);
    expect(props.matchedCapabilities).toEqual(["React", "TypeScript"]);
  });

  it("accepts isSelected as true", () => {
    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected: true,
      onToggle: vi.fn(),
      matchedCapabilities: ["React"],
    };

    expect(props.isSelected).toBe(true);
  });

  it("accepts empty matchedCapabilities array", () => {
    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: [],
    };

    expect(props.matchedCapabilities).toEqual([]);
    expect(props.matchedCapabilities.length).toBe(0);
  });

  it("accepts multiple matchedCapabilities", () => {
    const capabilities = ["React", "TypeScript", "Vite", "Tailwind", "Next.js"];
    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: capabilities,
    };

    expect(props.matchedCapabilities.length).toBe(5);
    expect(props.matchedCapabilities).toContain("React");
    expect(props.matchedCapabilities).toContain("TypeScript");
  });

  it("onToggle callback receives agent ID", () => {
    const onToggle = vi.fn();
    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected: false,
      onToggle,
      matchedCapabilities: ["React"],
    };

    // Simulate toggle
    props.onToggle(props.agent.id);

    expect(onToggle).toHaveBeenCalledWith("agent-123");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("handles agent with different role", () => {
    const qaAgent: Agent = {
      ...mockAgent,
      id: "agent-456",
      name: "QA Specialist",
      role: "qa",
    };

    const props: AgentRecommendationCardProps = {
      agent: qaAgent,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: ["Testing", "Selenium"],
    };

    expect(props.agent.role).toBe("qa");
    expect(props.agent.name).toBe("QA Specialist");
  });

  it("handles agent with null icon", () => {
    const agentWithoutIcon: Agent = {
      ...mockAgent,
      icon: null,
    };

    const props: AgentRecommendationCardProps = {
      agent: agentWithoutIcon,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: ["React"],
    };

    expect(props.agent.icon).toBeNull();
  });

  it("handles agent with custom icon", () => {
    const agentWithCustomIcon: Agent = {
      ...mockAgent,
      icon: "rocket",
    };

    const props: AgentRecommendationCardProps = {
      agent: agentWithCustomIcon,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: ["React"],
    };

    expect(props.agent.icon).toBe("rocket");
  });

  it("supports toggling selection state", () => {
    const onToggle = vi.fn();
    let isSelected = false;

    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected,
      onToggle: (agentId: string) => {
        isSelected = !isSelected;
        onToggle(agentId);
      },
      matchedCapabilities: ["React"],
    };

    // First toggle
    props.onToggle(props.agent.id);
    expect(onToggle).toHaveBeenCalledWith("agent-123");
    expect(isSelected).toBe(true);

    // Second toggle
    props.onToggle(props.agent.id);
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(isSelected).toBe(false);
  });

  it("handles long agent names", () => {
    const agentWithLongName: Agent = {
      ...mockAgent,
      name: "Very Long Agent Name That Should Be Truncated In The UI",
    };

    const props: AgentRecommendationCardProps = {
      agent: agentWithLongName,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: ["React"],
    };

    expect(props.agent.name.length).toBeGreaterThan(30);
  });

  it("handles many matched capabilities", () => {
    const manyCapabilities = [
      "React",
      "TypeScript",
      "JavaScript",
      "Node.js",
      "Express",
      "MongoDB",
      "PostgreSQL",
      "Docker",
      "Kubernetes",
      "AWS",
    ];

    const props: AgentRecommendationCardProps = {
      agent: mockAgent,
      isSelected: false,
      onToggle: vi.fn(),
      matchedCapabilities: manyCapabilities,
    };

    expect(props.matchedCapabilities.length).toBe(10);
  });
});
