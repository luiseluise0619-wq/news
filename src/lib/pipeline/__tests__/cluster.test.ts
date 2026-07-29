import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@prisma/client', () => {
  const mockPrismaClient = vi.fn();
  mockPrismaClient.prototype.article = {
    findMany: vi.fn().mockResolvedValue([
      { id: '1', title: 'Test 1', source: { name: 'BBC', category: { name: 'World' } } },
      { id: '2', title: 'Test 2', source: { name: 'CNN', category: { name: 'World' } } },
    ]),
    updateMany: vi.fn().mockResolvedValue({ count: 2 }),
  };
  mockPrismaClient.prototype.category = {
    findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'World' })
  };
  mockPrismaClient.prototype.newsEvent = {
    create: vi.fn().mockResolvedValue({ id: 'event-1' }),
  };
  return { PrismaClient: mockPrismaClient };
});

vi.mock('../../ai/provider', () => ({
  generateObject: vi.fn().mockResolvedValue({
    clusters: [
      { theme: 'Test Theme', articleIds: ['1', '2'] }
    ]
  })
}));

import { clusterArticles } from '../cluster';

describe('clusterArticles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully cluster unclustered articles', async () => {
    const eventCount = await clusterArticles();
    expect(eventCount).toBe(1);
  });
});
