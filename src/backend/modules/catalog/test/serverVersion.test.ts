import { db } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverVersionService } from '../src/services/serverVersion';

vi.mock('@metorial/db', () => ({
  db: {
    serverVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) }))
  }
}));

const mockServer = { oid: 'server-oid' };
const mockVariant = { oid: 'variant-oid' };

describe('serverVersionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerVersionById', () => {
    it('returns server version when found by id', async () => {
      const mockVersion = { id: '123', identifier: 'abc', serverOid: mockServer.oid };
      (db.serverVersion.findFirst as any).mockResolvedValue(mockVersion);

      const result = await serverVersionService.getServerVersionById({
        serverVersionId: '123',
        server: mockServer as any
      });

      expect(db.serverVersion.findFirst).toHaveBeenCalledWith({
        where: {
          serverOid: mockServer.oid,
          OR: [{ id: '123' }, { identifier: '123' }]
        },
        include: expect.any(Object)
      });
      expect(result).toBe(mockVersion);
    });

    it('throws ServiceError when not found', async () => {
      (db.serverVersion.findFirst as any).mockResolvedValue(null);

      await expect(
        serverVersionService.getServerVersionById({
          serverVersionId: 'not-found',
          server: mockServer as any
        })
      ).rejects.toBeInstanceOf(ServiceError);
    });
  });

  describe('listServerVersions', () => {
    it('calls findMany with correct params (no variant)', async () => {
      (db.serverVersion.findMany as any).mockResolvedValue([{ id: '1' }]);
      const paginatorSpy = vi.spyOn(Paginator, 'create');

      await serverVersionService.listServerVersions({ server: mockServer as any });

      expect(paginatorSpy).toHaveBeenCalled();
      expect(db.serverVersion.findMany).toHaveBeenCalledWith({
        where: {
          serverOid: mockServer.oid,
          serverVariantOid: undefined
        },
        include: expect.any(Object)
      });
    });

    it('calls findMany with correct params (with variant)', async () => {
      (db.serverVersion.findMany as any).mockResolvedValue([{ id: '2' }]);
      const paginatorSpy = vi.spyOn(Paginator, 'create');

      await serverVersionService.listServerVersions({
        server: mockServer as any,
        variant: mockVariant as any
      });

      expect(paginatorSpy).toHaveBeenCalled();
      expect(db.serverVersion.findMany).toHaveBeenCalledWith({
        where: {
          serverOid: mockServer.oid,
          serverVariantOid: mockVariant.oid
        },
        include: expect.any(Object)
      });
    });
  });
});
