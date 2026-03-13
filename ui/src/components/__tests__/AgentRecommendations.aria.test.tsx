// Feature: intelligent-agent-recommendation, Task 9.2: ARIA attributes for screen readers
// Tests to verify ARIA attributes are properly added to components

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentRecommendations } from "../AgentRecommendations";
import type { Agent } from "@Jigongai/shared";
import * as agentsApi from "../../api/agents";

// Mock the agents API
vi.mock("../../api/agents", () => ({
  agentsApi: {
    discover: vi.fn(),
  },
}));

describe("AgentRecommendations - ARIA Attributes", () => {
  let queryClient: QueryClient;

  const mockAgents: Agent[] = [
    {
      id: "agent-1",
      companyId: "company-1",
      name: "Test Agent",
      urlKey: "test-agent",
      icon: "🤖",
      role: "engineer",
      title: null,
      status: "active",
      reportsTo: null,
      capabilities: {
        languages: ["TypeScript"],
        frameworks: ["React"],
        domains: ["frontend"],
        tools: [],
        customTags: [],
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
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQuery = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  it("should have role='status' and aria-live='polite' on loading state", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    );

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Check loading state has proper ARIA attributes
    const loadingState = screen.getByRole("status");
    expect(loadingState).toHaveAttribute("aria-live", "polite");
    expect(loadingState).toHaveAttribute("aria-label", "Loading agent recommendations");
  });

  it("should have role='alert' and aria-live='assertive' on error state", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockRejectedValue(
      new Error("Network error")
    );

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Wait for error state
    await waitFor(() => {
      const errorState = screen.getByRole("alert");
      expect(errorState).toHaveAttribute("aria-live", "assertive");
      expect(errorState).toHaveTextContent("Unable to load recommendations");
    });
  });

  it("should have role='status' and aria-live='polite' on empty state", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockResolvedValue([]);

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Wait for empty state
    await waitFor(() => {
      const emptyState = screen.getByRole("status");
      expect(emptyState).toHaveAttribute("aria-live", "polite");
      expect(emptyState).toHaveTextContent("No agents match your task description");
    });
  });

  it("should have role='list' and aria-label on agent list", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockResolvedValue(mockAgents);

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Wait for agents to load
    await waitFor(() => {
      const agentList = screen.getByRole("list");
      expect(agentList).toHaveAttribute("aria-label", "Recommended agents");
    });
  });

  it("should have aria-label on capability badges container", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockResolvedValue(mockAgents);

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Wait for agents to load
    await waitFor(() => {
      const capabilitiesContainer = screen.getByLabelText("Matching capabilities");
      expect(capabilitiesContainer).toBeInTheDocument();
    });
  });

  it("should have aria-label on individual capability badges", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockResolvedValue(mockAgents);

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Wait for agents to load
    await waitFor(() => {
      const typescriptBadge = screen.getByLabelText("Capability: TypeScript");
      expect(typescriptBadge).toBeInTheDocument();
      
      const reactBadge = screen.getByLabelText("Capability: React");
      expect(reactBadge).toBeInTheDocument();
    });
  });

  it("should have enhanced aria-label on checkbox with agent name", async () => {
    vi.mocked(agentsApi.agentsApi.discover).mockResolvedValue(mockAgents);

    renderWithQuery(
      <AgentRecommendations
        companyId="company-1"
        title="Build React app"
        description="Create a frontend application"
        selectedAgentIds={new Set()}
        onSelectionChange={vi.fn()}
      />
    );

    // Wait for agents to load
    await waitFor(() => {
      const checkbox = screen.getByRole("checkbox", { 
        name: /Select agent Test Agent/i 
      });
      expect(checkbox).toBeInTheDocument();
    });
  });
});
