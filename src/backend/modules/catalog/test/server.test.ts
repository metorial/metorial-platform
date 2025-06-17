import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverService } from '../src/services/server';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    server: {
      findFirst: vi.fn()
    }
  }
}));
vi.mock('@metorial/error', () => ({
  notFoundError: (type: string, id: string) => ({ type, id }),
  ServiceError: class extends Error {
    constructor(public error: any) {
      super('ServiceError');
      this.name = 'ServiceError';
    }
  }
}));
vi.mock('@metorial/service', () => ({
  Service: {
    create: (_: string, factory: () => any) => ({
      build: () => factory()
    })
  }
}));

describe('ServerService', () => {
  const mockServer = { id: 'server-1', type: 'imported' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns server when found by id', async () => {
    (db.server.findFirst as any).mockResolvedValueOnce(mockServer);

    const result = await serverService.getServerById({ serverId: 'server-1' });

    expect(db.server.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        include: expect.any(Object)
      })
    );
    expect(result).toBe(mockServer);
  });

  it('throws ServiceError when server not found', async () => {
    (db.server.findFirst as any).mockResolvedValueOnce(null);

    await expect(serverService.getServerById({ serverId: 'not-found' })).rejects.toThrowError(
      ServiceError
    );
  });

  it('searches by listing id and slug as well', async () => {
    (db.server.findFirst as any).mockResolvedValueOnce(mockServer);

    await serverService.getServerById({ serverId: 'listing-slug' });

    const callArgs = (db.server.findFirst as any).mock.calls[0][0];
    expect(callArgs.where.AND[0].OR).toEqual([
      { id: 'listing-slug' },
      { listing: { id: 'listing-slug' } },
      { listing: { slug: 'listing-slug' } }
    ]);
  });

  it('filters by type "imported"', async () => {
    (db.server.findFirst as any).mockResolvedValueOnce(mockServer);

    await serverService.getServerById({ serverId: 'server-1' });

    const callArgs = (db.server.findFirst as any).mock.calls[0][0];
    expect(callArgs.where.AND[1].OR).toEqual([{ type: 'imported' }]);
  });
});
