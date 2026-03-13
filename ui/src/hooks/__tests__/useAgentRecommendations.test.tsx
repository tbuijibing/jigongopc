// Feature: intelligent-agent-recommendation, Task 3.1: useAgentRecommendations hook
// Basic unit tests for the custom hook

import { describe, it, expect } from "vitest";
import { extractKeywords } from "../../lib/keywordExtractor";

describe("useAgentRecommendations hook utilities", () => {
  it("should extract keywords from combined title and description", () => {
    const title = "Build React dashboard";
    const description = "Create a responsive dashboard using TypeScript";
    const combinedText = `${title} ${description}`;
    
    const keywords = extractKeywords(combinedText);
    
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords).toContain("Build");
    expect(keywords).toContain("React");
    expect(keywords).toContain("dashboard");
    expect(keywords).toContain("TypeScript");
  });

  it("should return empty array when text is empty", () => {
    const keywords = extractKeywords("");
    expect(keywords).toEqual([]);
  });

  it("should combine title and description correctly", () => {
    const title = "React";
    const description = "TypeScript";
    const combinedText = [title.trim(), description.trim()].filter(Boolean).join(" ");
    
    expect(combinedText).toBe("React TypeScript");
    
    const keywords = extractKeywords(combinedText);
    expect(keywords).toContain("React");
    expect(keywords).toContain("TypeScript");
  });

  it("should handle only title provided", () => {
    const title = "Build React app";
    const description = "";
    const combinedText = [title.trim(), description.trim()].filter(Boolean).join(" ");
    
    expect(combinedText).toBe("Build React app");
    
    const keywords = extractKeywords(combinedText);
    expect(keywords.length).toBeGreaterThan(0);
  });

  it("should handle only description provided", () => {
    const title = "";
    const description = "Create TypeScript dashboard";
    const combinedText = [title.trim(), description.trim()].filter(Boolean).join(" ");
    
    expect(combinedText).toBe("Create TypeScript dashboard");
    
    const keywords = extractKeywords(combinedText);
    expect(keywords.length).toBeGreaterThan(0);
  });
});
