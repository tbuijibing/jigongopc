/**
 * Keyword extraction utility for intelligent agent recommendation.
 * Extracts technical terms from task titles and descriptions.
 */

export interface KeywordExtractionOptions {
  maxKeywords?: number;
  minLength?: number;
}

/**
 * Common English stop words to filter out
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'and', 'or', 'but', 'be', 'as', 'by', 'from', 'this', 'that', 'it', 'was',
  'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'am', 'i', 'you',
  'he', 'she', 'we', 'they', 'them', 'their', 'our', 'your', 'my', 'his', 'her',
  'its', 'which', 'who', 'what', 'when', 'where', 'why', 'how', 'if', 'then',
  'than', 'so', 'not', 'no', 'yes', 'all', 'any', 'some', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'such', 'only', 'own', 'same',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
  'down', 'out', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should',
  'now', 'using'
]);

/**
 * Extracts keywords from text, preserving technical terms and filtering stop words.
 * 
 * @param text - The input text to extract keywords from
 * @param options - Optional configuration for extraction
 * @returns Array of unique keywords, limited to maxKeywords
 * 
 * @example
 * extractKeywords("Build a React dashboard with TypeScript")
 * // Returns: ["Build", "React", "dashboard", "TypeScript"]
 */
export function extractKeywords(
  text: string,
  options: KeywordExtractionOptions = {}
): string[] {
  const { maxKeywords = 10, minLength = 2 } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Tokenize while preserving technical terms
  // Split on whitespace and common punctuation, but preserve:
  // - camelCase (e.g., useState)
  // - snake_case (e.g., user_name)
  // - kebab-case (e.g., my-component)
  // - dots (e.g., React.Component)
  const tokens = text
    .split(/[\s,;:!?()[\]{}'"<>]+/)
    .filter(token => token.length > 0);

  // Process tokens
  const keywords = new Set<string>();
  
  for (const token of tokens) {
    // Remove leading/trailing punctuation but preserve internal structure
    const cleaned = token.replace(/^[^\w]+|[^\w]+$/g, '');
    
    if (cleaned.length < minLength) {
      continue;
    }

    // Check if it's a stop word (case-insensitive)
    if (STOP_WORDS.has(cleaned.toLowerCase())) {
      continue;
    }

    // Add the keyword (preserve original case)
    keywords.add(cleaned);
  }

  // Convert to array and limit to maxKeywords
  const result = Array.from(keywords);
  return result.slice(0, maxKeywords);
}
