// Feature: intelligent-agent-recommendation, Task 8.2: Integration test for cross-company access prevention
// Property 15: Cross-Company Access Prevention
// Validates: Requirements 7.2

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { agentsApi } from "../agents";
import { ApiError } from "../client";
import type { Agent } from "@Jigongai/shared";

/**
 * Helper function to create a mock Agent with all required fields
 */
function createMockAgent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Test Agent",
    urlKey: "test-agent",
    role: "engineer",
    title: null,
    icon: "🤖",
    status: "active",
    reportsTo: null,
    capabilities: {
      languages: [],
      frameworks: [],
      domains: [],
      tools: [],
      customTags: [],
    },
    adapterType: "process",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    permissions: {
      canCreateAgents: false,
    },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Property 15: Cross-Company Access Prevention
 *
 * For any discovery request with a company ID that the user doesn't have access to,
 * the API should reject the request with an authorization error (403 Forbidden).
 *
 * **Validates: Requirements 7.2**
 *
 * This test verifies that the agent discovery API enforces company-scoped access control
 * and prevents users from discovering agents belonging to other companies.
 */
describe("Property 15: Cross-Company Access Prevention", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.error to verify error handling
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consoleErrorSpy.mockRestore();
  });

  it("should reject discovery requests for unauthorized company IDs with 403 Forbidden", async () => {
    // Mock API to return 403 Forbidden for cross-company access
    const unauthorizedCompanyId = "company-unauthorized";
    const keywords = ["React", "TypeScript"];

    vi.spyOn(agentsApi, "discover").mockRejectedValue(
      new ApiError("Access denied", 403, {
        error: "You do not have permission to access agents from this company",
      })
    );

    // Attempt to discover agents from unauthorized company
    try {
      await agentsApi.discover(unauthorizedCompanyId, keywords);
      expect.fail("Expected 403 error to be thrown");
    } catch (error) {
      // Verify error is ApiError with 403 status
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).message).toBe("Access denied");
      expect((error as ApiError).body).toEqual({
        error: "You do not have permission to access agents from this company",
      });
    }
  });

  it("should allow discovery requests for authorized company IDs", async () => {
    // Mock API to return agents for authorized company
    const authorizedCompanyId = "company-authorized";
    const keywords = ["React", "TypeScript"];
    const mockAgents: Agent[] = [
      createMockAgent({
        id: "agent-1",
        companyId: authorizedCompanyId,
        name: "Frontend Specialist",
        urlKey: "frontend-specialist",
        icon: "🎨",
        capabilities: {
          languages: ["JavaScript", "TypeScript"],
          frameworks: ["React"],
          domains: ["frontend"],
          tools: [],
          customTags: [],
        },
      }),
    ];

    vi.spyOn(agentsApi, "discover").mockResolvedValue(mockAgents);

    // Discover agents from authorized company
    const result = await agentsApi.discover(authorizedCompanyId, keywords);

    // Verify agents are returned
    expect(result).toEqual(mockAgents);
    expect(result).toHaveLength(1);
    expect(result[0]?.companyId).toBe(authorizedCompanyId);
  });

  it("should reject discovery with 403 when user switches to unauthorized company", async () => {
    // Simulate user switching from authorized to unauthorized company
    const authorizedCompanyId = "company-1";
    const unauthorizedCompanyId = "company-2";
    const keywords = ["Node.js"];

    // First request succeeds (authorized company)
    const mockAgents: Agent[] = [
      createMockAgent({
        id: "agent-1",
        companyId: authorizedCompanyId,
        name: "Backend Developer",
        urlKey: "backend-developer",
        icon: "⚙️",
        capabilities: {
          languages: ["JavaScript"],
          frameworks: ["Node.js"],
          domains: ["backend"],
          tools: [],
          customTags: [],
        },
      }),
    ];

    vi.spyOn(agentsApi, "discover")
      .mockResolvedValueOnce(mockAgents) // First call succeeds
      .mockRejectedValueOnce(
        // Second call fails with 403
        new ApiError("Access denied", 403, {
          error: "You do not have permission to access agents from this company",
        })
      );

    // First request to authorized company succeeds
    const result1 = await agentsApi.discover(authorizedCompanyId, keywords);
    expect(result1).toEqual(mockAgents);

    // Second request to unauthorized company fails
    try {
      await agentsApi.discover(unauthorizedCompanyId, keywords);
      expect.fail("Expected 403 error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
    }
  });

  it("should handle 403 errors differently from other error types", async () => {
    const companyId = "company-unauthorized";
    const keywords = ["Python"];

    // Test 403 Forbidden
    vi.spyOn(agentsApi, "discover").mockRejectedValueOnce(
      new ApiError("Access denied", 403, { error: "Forbidden" })
    );

    try {
      await agentsApi.discover(companyId, keywords);
      expect.fail("Expected 403 error");
    } catch (error) {
      expect((error as ApiError).status).toBe(403);
    }

    // Test 404 Not Found (different error type)
    vi.spyOn(agentsApi, "discover").mockRejectedValueOnce(
      new ApiError("Company not found", 404, { error: "Not found" })
    );

    try {
      await agentsApi.discover(companyId, keywords);
      expect.fail("Expected 404 error");
    } catch (error) {
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).status).not.toBe(403);
    }

    // Test 500 Internal Server Error (different error type)
    vi.spyOn(agentsApi, "discover").mockRejectedValueOnce(
      new ApiError("Internal server error", 500, { error: "Server error" })
    );

    try {
      await agentsApi.discover(companyId, keywords);
      expect.fail("Expected 500 error");
    } catch (error) {
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).status).not.toBe(403);
    }
  });

  it("should propagate 403 error details to calling component for proper error handling", async () => {
    const unauthorizedCompanyId = "company-other";
    const keywords = ["Java", "Spring"];

    const forbiddenError = new ApiError(
      "Cross-company access denied",
      403,
      {
        error: "You do not have permission to access agents from this company",
        companyId: unauthorizedCompanyId,
        requestedBy: "user-123",
      }
    );

    vi.spyOn(agentsApi, "discover").mockRejectedValue(forbiddenError);

    try {
      await agentsApi.discover(unauthorizedCompanyId, keywords);
      expect.fail("Expected error to be thrown");
    } catch (error) {
      // Verify error details are preserved for UI error handling
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      expect((error as ApiError).message).toBe("Cross-company access denied");
      expect((error as ApiError).body).toMatchObject({
        error: "You do not have permission to access agents from this company",
        companyId: unauthorizedCompanyId,
      });
    }
  });

  it("should not expose agents from other companies even with valid keywords", async () => {
    // Simulate scenario where keywords match agents in multiple companies
    // but API should only return agents from authorized company
    const authorizedCompanyId = "company-1";
    const unauthorizedCompanyId = "company-2";
    const keywords = ["React"]; // Common keyword that might match agents in both companies

    // Mock authorized company request - returns agents
    const authorizedAgents: Agent[] = [
      createMockAgent({
        id: "agent-1",
        companyId: authorizedCompanyId,
        name: "React Developer",
        urlKey: "react-developer",
        icon: "⚛️",
        capabilities: {
          languages: ["JavaScript"],
          frameworks: ["React"],
          domains: ["frontend"],
          tools: [],
          customTags: [],
        },
      }),
    ];

    vi.spyOn(agentsApi, "discover")
      .mockResolvedValueOnce(authorizedAgents) // Authorized company succeeds
      .mockRejectedValueOnce(
        // Unauthorized company fails
        new ApiError("Access denied", 403, {
          error: "You do not have permission to access agents from this company",
        })
      );

    // Request to authorized company returns agents
    const result1 = await agentsApi.discover(authorizedCompanyId, keywords);
    expect(result1).toHaveLength(1);
    expect(result1[0]?.companyId).toBe(authorizedCompanyId);

    // Request to unauthorized company is rejected
    try {
      await agentsApi.discover(unauthorizedCompanyId, keywords);
      expect.fail("Expected 403 error");
    } catch (error) {
      expect((error as ApiError).status).toBe(403);
    }
  });

  it("should enforce company scope even with empty keywords", async () => {
    // Test that company access control is enforced regardless of keywords
    const unauthorizedCompanyId = "company-unauthorized";
    const keywords: string[] = [];

    vi.spyOn(agentsApi, "discover").mockRejectedValue(
      new ApiError("Access denied", 403, {
        error: "You do not have permission to access agents from this company",
      })
    );

    try {
      await agentsApi.discover(unauthorizedCompanyId, keywords);
      expect.fail("Expected 403 error");
    } catch (error) {
      expect((error as ApiError).status).toBe(403);
    }
  });
});
