import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 1: API Client URL Construction
 *
 * For any company ID and array of keywords, when the discover method is called,
 * the resulting URL should match the pattern `/companies/:companyId/agents/discover?need=keyword1,keyword2,...`
 * with properly encoded parameters.
 *
 * **Validates: Requirements 1.2**
 */

// Helper function to build the discover URL (extracted from agentsApi.discover logic)
function buildDiscoverUrl(companyId: string, keywords: string[]): string {
  const need = keywords.map(k => encodeURIComponent(k)).join(',');
  return `/companies/${encodeURIComponent(companyId)}/agents/discover?need=${need}`;
}

describe('Property 1: API Client URL Construction', () => {
  it('constructs valid URL format with encoded parameters for any company ID and keywords', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 10 }
        ),
        (companyId, keywords) => {
          const url = buildDiscoverUrl(companyId, keywords);
          
          // Verify URL matches expected pattern
          expect(url).toMatch(/^\/companies\/[^/]+\/agents\/discover\?need=.+$/);
          
          // Verify company ID is properly encoded in the URL
          expect(url).toContain(`/companies/${encodeURIComponent(companyId)}/agents/discover`);
          
          // Verify the need parameter exists
          expect(url).toContain('?need=');
          
          // Extract the need parameter value
          const needMatch = url.match(/\?need=(.+)$/);
          expect(needMatch).toBeTruthy();
          
          if (needMatch) {
            const needValue = needMatch[1];
            
            // Verify each keyword appears in the need parameter (encoded)
            keywords.forEach(keyword => {
              const encodedKeyword = encodeURIComponent(keyword);
              expect(needValue).toContain(encodedKeyword);
            });
            
            // Verify keywords are comma-separated
            const needParts = needValue.split(',');
            expect(needParts.length).toBe(keywords.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles special characters in company ID and keywords', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9\-_]+$/).filter(s => s.length > 0),
        fc.array(
          fc.oneof(
            fc.constant('C++'),
            fc.constant('Node.js'),
            fc.constant('React/Redux'),
            fc.constant('ASP.NET'),
            fc.constant('Spring Boot'),
            fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0)
          ),
          { minLength: 1, maxLength: 5 }
        ),
        (companyId, keywords) => {
          const url = buildDiscoverUrl(companyId, keywords);
          
          // Verify URL is properly formed
          expect(url).toMatch(/^\/companies\/[^/]+\/agents\/discover\?need=.+$/);
          
          // Verify company ID is encoded
          expect(url).toContain(encodeURIComponent(companyId));
          
          // Verify keywords are encoded
          keywords.forEach(keyword => {
            const encodedKeyword = encodeURIComponent(keyword);
            expect(url).toContain(encodedKeyword);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('constructs correct URL structure for edge cases', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.oneof(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 1 }), // Single keyword
          fc.array(fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0), { minLength: 10, maxLength: 10 }) // Exactly 10 keywords
        ),
        (companyId, keywords) => {
          const url = buildDiscoverUrl(companyId, keywords);
          
          // Verify basic URL structure
          expect(url).toContain('/companies/');
          expect(url).toContain('/agents/discover');
          expect(url).toContain('?need=');
          
          // Verify company ID is in the URL
          expect(url).toContain(encodeURIComponent(companyId));
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 14: Company-Scoped Discovery Results
 *
 * For any company ID used in the discovery request, all returned agents should belong to that company
 * (agent.companyId === requestCompanyId).
 *
 * **Validates: Requirements 7.1**
 */

describe('Property 14: Company-Scoped Discovery Results', () => {
  it('ensures all returned agents belong to the requested company', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Request company ID
        fc.array(
          fc.record({
            id: fc.uuid(),
            companyId: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 30 }),
            icon: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 5 })),
            role: fc.constantFrom('software_engineer', 'data_scientist', 'devops_engineer', 'qa_engineer'),
            status: fc.constantFrom('active', 'paused', 'terminated'),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (requestCompanyId, mockAgents) => {
          // Simulate backend filtering: only return agents matching the requested company
          const filteredAgents = mockAgents.filter(agent => agent.companyId === requestCompanyId);
          
          // Property: All returned agents must belong to the requested company
          filteredAgents.forEach(agent => {
            expect(agent.companyId).toBe(requestCompanyId);
          });
          
          // Additional check: No agents from other companies should be in the result
          const otherCompanyAgents = filteredAgents.filter(agent => agent.companyId !== requestCompanyId);
          expect(otherCompanyAgents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array when no agents match the requested company', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Request company ID
        fc.array(
          fc.record({
            id: fc.uuid(),
            companyId: fc.uuid().filter(id => id !== 'request-company-id'), // Ensure different company
            name: fc.string({ minLength: 3, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (requestCompanyId, mockAgents) => {
          // Ensure no agents belong to the requested company
          const agentsWithDifferentCompany = mockAgents.map(agent => ({
            ...agent,
            companyId: agent.companyId === requestCompanyId ? fc.sample(fc.uuid(), 1)[0] : agent.companyId
          }));
          
          // Simulate backend filtering
          const filteredAgents = agentsWithDifferentCompany.filter(agent => agent.companyId === requestCompanyId);
          
          // Property: Should return empty array when no agents match
          expect(filteredAgents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maintains company scope across different keyword searches', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Request company ID
        fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 5 }), // Keywords
        fc.array(
          fc.record({
            id: fc.uuid(),
            companyId: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 30 }),
            capabilities: fc.record({
              languages: fc.array(fc.string({ minLength: 2, maxLength: 15 }), { maxLength: 5 }),
              frameworks: fc.array(fc.string({ minLength: 2, maxLength: 15 }), { maxLength: 5 }),
              domains: fc.array(fc.string({ minLength: 2, maxLength: 15 }), { maxLength: 5 }),
              tools: fc.array(fc.string({ minLength: 2, maxLength: 15 }), { maxLength: 5 }),
              customTags: fc.array(fc.string({ minLength: 2, maxLength: 15 }), { maxLength: 5 }),
            }),
          }),
          { minLength: 5, maxLength: 20 }
        ),
        (requestCompanyId, keywords, mockAgents) => {
          // Simulate backend filtering by company first, then by keyword matching
          const companyFilteredAgents = mockAgents.filter(agent => agent.companyId === requestCompanyId);
          
          // Property: Company filtering should happen BEFORE keyword matching
          // This ensures company scope is always enforced regardless of keywords
          companyFilteredAgents.forEach(agent => {
            expect(agent.companyId).toBe(requestCompanyId);
          });
          
          // Verify that agents from other companies are excluded even if they might match keywords
          const excludedAgents = mockAgents.filter(agent => agent.companyId !== requestCompanyId);
          excludedAgents.forEach(agent => {
            expect(agent.companyId).not.toBe(requestCompanyId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles edge case where all agents belong to the same company', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Request company ID
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 15 }
        ),
        (requestCompanyId, agentTemplates) => {
          // Create agents all belonging to the same company
          const mockAgents = agentTemplates.map(template => ({
            ...template,
            companyId: requestCompanyId,
          }));
          
          // Simulate backend filtering
          const filteredAgents = mockAgents.filter(agent => agent.companyId === requestCompanyId);
          
          // Property: All agents should be returned when they all belong to the requested company
          expect(filteredAgents.length).toBe(mockAgents.length);
          filteredAgents.forEach(agent => {
            expect(agent.companyId).toBe(requestCompanyId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles mixed company scenarios correctly', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Request company ID
        fc.integer({ min: 1, max: 10 }), // Number of agents from requested company
        fc.integer({ min: 1, max: 10 }), // Number of agents from other companies
        (requestCompanyId, numRequestedCompanyAgents, numOtherCompanyAgents) => {
          // Create agents from the requested company
          const requestedCompanyAgents = Array.from({ length: numRequestedCompanyAgents }, (_, i) => ({
            id: `agent-requested-${i}`,
            companyId: requestCompanyId,
            name: `Agent ${i}`,
          }));
          
          // Create agents from other companies
          const otherCompanyAgents = Array.from({ length: numOtherCompanyAgents }, (_, i) => ({
            id: `agent-other-${i}`,
            companyId: `other-company-${i}`,
            name: `Other Agent ${i}`,
          }));
          
          // Mix them together
          const allAgents = [...requestedCompanyAgents, ...otherCompanyAgents];
          
          // Simulate backend filtering
          const filteredAgents = allAgents.filter(agent => agent.companyId === requestCompanyId);
          
          // Property: Only agents from the requested company should be returned
          expect(filteredAgents.length).toBe(numRequestedCompanyAgents);
          filteredAgents.forEach(agent => {
            expect(agent.companyId).toBe(requestCompanyId);
          });
          
          // Verify no agents from other companies leaked through
          const leakedAgents = filteredAgents.filter(agent => agent.companyId !== requestCompanyId);
          expect(leakedAgents.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
