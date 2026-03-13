import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractKeywords } from '../keywordExtractor';

/**
 * Property 4: Keyword Extraction and Combination
 *
 * For any non-empty title and description text, the keyword extractor should
 * extract keywords from both sources and return a combined list containing
 * terms from both inputs.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

describe('Property 4: Keyword Extraction and Combination', () => {
  it('extracts keywords from both title and description', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        (title, description) => {
          // Extract keywords from combined text
          const combined = `${title} ${description}`;
          const keywords = extractKeywords(combined);
          
          // Extract keywords from title and description separately
          const titleKeywords = extractKeywords(title);
          const descKeywords = extractKeywords(description);
          
          // If title has keywords, some should appear in the combined result
          if (titleKeywords.length > 0) {
            const hasMatchFromTitle = keywords.some(k => titleKeywords.includes(k));
            expect(hasMatchFromTitle).toBe(true);
          }
          
          // If description has keywords, some should appear in the combined result
          if (descKeywords.length > 0) {
            const hasMatchFromDesc = keywords.some(k => descKeywords.includes(k));
            expect(hasMatchFromDesc).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Stop Word Filtering
 *
 * For any text input containing common stop words (the, a, an, is, are, in, on, at, to, for, of, with),
 * the keyword extractor should filter them out and not include them in the returned keyword list.
 *
 * **Validates: Requirements 2.4**
 */

describe('Property 5: Stop Word Filtering', () => {
  it('filters out common stop words from results', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('the', 'a', 'an', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'of', 'with'), { minLength: 1, maxLength: 10 }),
        fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 10 }),
        (stopWords, contentWords) => {
          // Combine stop words and content words
          const text = [...stopWords, ...contentWords].join(' ');
          const keywords = extractKeywords(text);
          
          // No stop words should appear in results (case-insensitive check)
          stopWords.forEach(stopWord => {
            const lowerKeywords = keywords.map(k => k.toLowerCase());
            expect(lowerKeywords).not.toContain(stopWord.toLowerCase());
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
/**
 * Property 6: Keyword Count Limit
 *
 * For any text input regardless of length, the keyword extractor should
 * return at most 10 keywords.
 *
 * **Validates: Requirements 2.6**
 */

describe('Property 6: Keyword Count Limit', () => {
  it('returns at most 10 keywords regardless of input length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 500 }),
        (text) => {
          const keywords = extractKeywords(text);
          expect(keywords.length).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
