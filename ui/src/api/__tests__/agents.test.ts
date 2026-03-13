import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agentsApi } from '../agents';
import * as client from '../client';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

describe('agentsApi.discover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct correct URL with company ID and keywords', async () => {
    const mockGet = vi.mocked(client.api.get);
    mockGet.mockResolvedValue([]);

    const companyId = 'company-123';
    const keywords = ['React', 'TypeScript', 'Node.js'];

    await agentsApi.discover(companyId, keywords);

    expect(mockGet).toHaveBeenCalledWith(
      '/companies/company-123/agents/discover?need=React,TypeScript,Node.js'
    );
  });

  it('should URL-encode company ID', async () => {
    const mockGet = vi.mocked(client.api.get);
    mockGet.mockResolvedValue([]);

    const companyId = 'company with spaces';
    const keywords = ['test'];

    await agentsApi.discover(companyId, keywords);

    expect(mockGet).toHaveBeenCalledWith(
      '/companies/company%20with%20spaces/agents/discover?need=test'
    );
  });

  it('should URL-encode keywords with special characters', async () => {
    const mockGet = vi.mocked(client.api.get);
    mockGet.mockResolvedValue([]);

    const companyId = 'company-123';
    const keywords = ['C++', 'Node.js', 'React/Redux'];

    await agentsApi.discover(companyId, keywords);

    expect(mockGet).toHaveBeenCalledWith(
      '/companies/company-123/agents/discover?need=C%2B%2B,Node.js,React%2FRedux'
    );
  });

  it('should handle empty keywords array', async () => {
    const mockGet = vi.mocked(client.api.get);
    mockGet.mockResolvedValue([]);

    const companyId = 'company-123';
    const keywords: string[] = [];

    await agentsApi.discover(companyId, keywords);

    expect(mockGet).toHaveBeenCalledWith(
      '/companies/company-123/agents/discover?need='
    );
  });

  it('should return agent array from API response', async () => {
    const mockAgents = [
      { id: 'agent-1', name: 'Agent 1', companyId: 'company-123' },
      { id: 'agent-2', name: 'Agent 2', companyId: 'company-123' },
    ];
    const mockGet = vi.mocked(client.api.get);
    mockGet.mockResolvedValue(mockAgents);

    const companyId = 'company-123';
    const keywords = ['React'];

    const result = await agentsApi.discover(companyId, keywords);

    expect(result).toEqual(mockAgents);
  });

  it('should propagate API errors', async () => {
    const mockError = new Error('Network error');
    const mockGet = vi.mocked(client.api.get);
    mockGet.mockRejectedValue(mockError);

    const companyId = 'company-123';
    const keywords = ['React'];

    await expect(agentsApi.discover(companyId, keywords)).rejects.toThrow('Network error');
  });

  describe('error propagation', () => {
    it('should propagate network errors to calling component', async () => {
      const networkError = new Error('Failed to fetch');
      const mockGet = vi.mocked(client.api.get);
      mockGet.mockRejectedValue(networkError);

      const companyId = 'company-123';
      const keywords = ['React', 'TypeScript'];

      await expect(agentsApi.discover(companyId, keywords)).rejects.toThrow('Failed to fetch');
      expect(mockGet).toHaveBeenCalledWith(
        '/companies/company-123/agents/discover?need=React,TypeScript'
      );
    });

    it('should propagate 403 Forbidden errors correctly', async () => {
      const forbiddenError = new client.ApiError('Access denied', 403, { error: 'Access denied' });
      const mockGet = vi.mocked(client.api.get);
      mockGet.mockRejectedValue(forbiddenError);

      const companyId = 'company-456';
      const keywords = ['Node.js'];

      try {
        await agentsApi.discover(companyId, keywords);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(client.ApiError);
        expect((error as client.ApiError).message).toBe('Access denied');
        expect((error as client.ApiError).status).toBe(403);
        expect((error as client.ApiError).body).toEqual({ error: 'Access denied' });
      }
    });

    it('should propagate 500 Internal Server errors correctly', async () => {
      const serverError = new client.ApiError('Internal server error', 500, { error: 'Database connection failed' });
      const mockGet = vi.mocked(client.api.get);
      mockGet.mockRejectedValue(serverError);

      const companyId = 'company-789';
      const keywords = ['Python', 'Django'];

      try {
        await agentsApi.discover(companyId, keywords);
        expect.fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(client.ApiError);
        expect((error as client.ApiError).message).toBe('Internal server error');
        expect((error as client.ApiError).status).toBe(500);
        expect((error as client.ApiError).body).toEqual({ error: 'Database connection failed' });
      }
    });

    it('should propagate 404 Not Found errors correctly', async () => {
      const notFoundError = new client.ApiError('Company not found', 404, { error: 'Company not found' });
      const mockGet = vi.mocked(client.api.get);
      mockGet.mockRejectedValue(notFoundError);

      const companyId = 'nonexistent-company';
      const keywords = ['Java'];

      await expect(agentsApi.discover(companyId, keywords)).rejects.toThrow('Company not found');
      await expect(agentsApi.discover(companyId, keywords)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should propagate timeout errors to calling component', async () => {
      const timeoutError = new Error('Request timeout');
      const mockGet = vi.mocked(client.api.get);
      mockGet.mockRejectedValue(timeoutError);

      const companyId = 'company-123';
      const keywords = ['Go', 'Kubernetes'];

      await expect(agentsApi.discover(companyId, keywords)).rejects.toThrow('Request timeout');
    });
  });
});
