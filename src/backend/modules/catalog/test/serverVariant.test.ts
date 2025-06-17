import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverVariantService } from '../src/services/serverVariant';

vi.mock('@metorial/db', () => ({
  db: {
    serverVariant: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

const mockServer = { oid: 'server-oid', id: 'server-id', type: 'imported' };
const mockInstance = { oid: 'instance-oid' };
const mockServerVariant = {
  id: 'variant-id',
  identifier: 'variant-identifier',
  serverOid: 'server-oid',
  sourceType: 'remote',
  currentVersion: { schema: {} },
  server: mockServer as any
};

describe('serverVariantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerVariantById', () => {
    it('returns server variant by id', async () => {
      (db.serverVariant.findFirst as any).mockResolvedValue(mockServerVariant);
      const result = await serverVariantService.getServerVariantById({
        serverVariantId: 'variant-id',
        server: mockServer as any
      });
      expect(result).toEqual(mockServerVariant);
      expect(db.serverVariant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ id: 'variant-id' }, { identifier: 'variant-id' }]
          }),
          include: expect.any(Object)
        })
      );
    });

    it('throws ServiceError if not found', async () => {
      (db.serverVariant.findFirst as any).mockResolvedValue(undefined);
      await expect(
        serverVariantService.getServerVariantById({
          serverVariantId: 'not-found',
          server: mockServer as any
        })
      ).rejects.toBeInstanceOf(ServiceError);
    });
  });

  describe('getServerVariantByIdOrLatestServerVariantSafe', () => {
    it('returns latest variant by serverId if id not provided', async () => {
      const variants = [
        { ...mockServerVariant, id: 'a', sourceType: 'docker' },
        { ...mockServerVariant, id: 'b', sourceType: 'remote' }
      ];
      (db.serverVariant.findMany as any).mockResolvedValue(variants);
      const result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverId: 'server-id',
        instance: mockInstance as any
      });
      expect(result).toEqual(variants[0]);
    });

    it('returns undefined if no variants found', async () => {
      (db.serverVariant.findMany as any).mockResolvedValue([]);
      const result = await serverVariantService.getServerVariantByIdOrLatestServerVariantSafe({
        serverId: 'server-id',
        instance: mockInstance as any
      });
      expect(result).toBeUndefined();
    });
  });
});
