import { describe, it, expect } from 'vitest';
import { extractKeywords } from '../keywordExtractor';

describe('keywordExtractor', () => {
  describe('basic functionality', () => {
    it('should extract keywords from simple text', () => {
      const result = extractKeywords('Build a React dashboard with TypeScript');
      expect(result).toContain('Build');
      expect(result).toContain('React');
      expect(result).toContain('dashboard');
      expect(result).toContain('TypeScript');
    });

    it('should filter out stop words', () => {
      const result = extractKeywords('the quick brown fox is jumping over a lazy dog');
      expect(result).not.toContain('the');
      expect(result).not.toContain('a');
      expect(result).not.toContain('is');
      expect(result).not.toContain('over');
    });

    it('should filter out short words', () => {
      const result = extractKeywords('a b cd efg');
      expect(result).not.toContain('a');
      expect(result).not.toContain('b');
      expect(result).toContain('cd');
      expect(result).toContain('efg');
    });

    it('should return unique keywords', () => {
      const result = extractKeywords('React React React TypeScript TypeScript');
      expect(result.filter(k => k === 'React').length).toBe(1);
      expect(result.filter(k => k === 'TypeScript').length).toBe(1);
    });

    it('should limit to maxKeywords', () => {
      const text = 'one two three four five six seven eight nine ten eleven twelve';
      const result = extractKeywords(text, { maxKeywords: 5 });
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty input', () => {
      expect(extractKeywords('')).toEqual([]);
      expect(extractKeywords('   ')).toEqual([]);
    });
  });

  describe('technical term preservation', () => {
    it('should preserve camelCase', () => {
      const result = extractKeywords('useState useEffect handleClick');
      expect(result).toContain('useState');
      expect(result).toContain('useEffect');
      expect(result).toContain('handleClick');
    });

    it('should preserve snake_case', () => {
      const result = extractKeywords('user_name api_key database_connection');
      expect(result).toContain('user_name');
      expect(result).toContain('api_key');
      expect(result).toContain('database_connection');
    });

    it('should preserve kebab-case', () => {
      const result = extractKeywords('my-component user-profile api-endpoint');
      expect(result).toContain('my-component');
      expect(result).toContain('user-profile');
      expect(result).toContain('api-endpoint');
    });

    it('should preserve dotted notation', () => {
      const result = extractKeywords('React.Component Array.map Object.keys');
      expect(result).toContain('React.Component');
      expect(result).toContain('Array.map');
      expect(result).toContain('Object.keys');
    });
  });

  describe('punctuation handling', () => {
    it('should remove leading and trailing punctuation', () => {
      const result = extractKeywords('(React) [TypeScript] {Node.js} "Express"');
      expect(result).toContain('React');
      expect(result).toContain('TypeScript');
      expect(result).toContain('Node.js');
      expect(result).toContain('Express');
    });

    it('should handle commas and semicolons', () => {
      const result = extractKeywords('React, TypeScript; Node.js, Express');
      expect(result).toContain('React');
      expect(result).toContain('TypeScript');
      expect(result).toContain('Node.js');
      expect(result).toContain('Express');
    });
  });

  describe('case sensitivity', () => {
    it('should preserve original case', () => {
      const result = extractKeywords('React TYPESCRIPT nodejs');
      expect(result).toContain('React');
      expect(result).toContain('TYPESCRIPT');
      expect(result).toContain('nodejs');
    });

    it('should filter stop words case-insensitively', () => {
      const result = extractKeywords('The THE the A An AN');
      expect(result).not.toContain('The');
      expect(result).not.toContain('THE');
      expect(result).not.toContain('the');
      expect(result).not.toContain('A');
      expect(result).not.toContain('An');
      expect(result).not.toContain('AN');
    });
  });

  describe('real-world examples', () => {
    it('should extract keywords from task description', () => {
      const text = 'Create a responsive dashboard using React and TypeScript with Tailwind CSS';
      const result = extractKeywords(text);
      
      expect(result).toContain('Create');
      expect(result).toContain('responsive');
      expect(result).toContain('dashboard');
      expect(result).toContain('React');
      expect(result).toContain('TypeScript');
      expect(result).toContain('Tailwind');
      expect(result).toContain('CSS');
      
      // Stop words should be filtered
      expect(result).not.toContain('a');
      expect(result).not.toContain('using');
      expect(result).not.toContain('and');
      expect(result).not.toContain('with');
    });

    it('should handle technical task descriptions', () => {
      const text = 'Implement user authentication with JWT tokens and bcrypt password hashing';
      const result = extractKeywords(text);
      
      expect(result).toContain('Implement');
      expect(result).toContain('user');
      expect(result).toContain('authentication');
      expect(result).toContain('JWT');
      expect(result).toContain('tokens');
      expect(result).toContain('bcrypt');
      expect(result).toContain('password');
      expect(result).toContain('hashing');
    });
  });
});
