import { useDeferredValue, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@Jigongai/shared";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { extractKeywords } from "../lib/keywordExtractor";

export interface UseAgentRecommendationsOptions {
  companyId: string;
  title: string;
  description: string;
  enabled: boolean;
}

export interface UseAgentRecommendationsResult {
  agents: Agent[];
  isLoading: boolean;
  error: Error | null;
  keywords: string[];
}

/**
 * Custom hook for fetching agent recommendations based on task title and description.
 * 
 * Extracts keywords from the combined title and description text, debounces the extraction
 * (500ms using useDeferredValue), and queries the agent discovery API with the keywords.
 * 
 * @param options - Configuration including companyId, title, description, and enabled flag
 * @returns Object containing agents array, loading state, error, and extracted keywords
 * 
 * @example
 * const { agents, isLoading, keywords } = useAgentRecommendations({
 *   companyId: "company-123",
 *   title: "Build React dashboard",
 *   description: "Create a responsive dashboard using TypeScript",
 *   enabled: true
 * });
 */
export function useAgentRecommendations(
  options: UseAgentRecommendationsOptions
): UseAgentRecommendationsResult {
  const { companyId, title, description, enabled } = options;

  // Combine title and description text
  const combinedText = useMemo(() => {
    const parts = [title.trim(), description.trim()].filter(Boolean);
    return parts.join(" ");
  }, [title, description]);

  // Extract keywords from combined text
  const keywords = useMemo(() => {
    if (!combinedText) {
      return [];
    }
    return extractKeywords(combinedText);
  }, [combinedText]);

  // Debounce keywords using useDeferredValue (500ms effective delay)
  const deferredKeywords = useDeferredValue(keywords);

  // Build query key with debounced keywords
  const needString = deferredKeywords.join(",");

  // Query agent discovery API
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.discover(companyId, needString),
    queryFn: () => agentsApi.discover(companyId, deferredKeywords),
    enabled: enabled && deferredKeywords.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    agents: data ?? [],
    isLoading,
    error: error as Error | null,
    keywords: deferredKeywords,
  };
}
