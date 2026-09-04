import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    file: {
      aggregate: vi.fn()
    },
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  withTransaction: vi.fn(async (fn: any) => await fn(db))
}));

import {
  applyStoreByteSizeDelta,
  computeStoreByteSize,
  getStoreByteSize,
  refreshStoreByteSize
} from './storeByteSize';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computeStoreByteSize', () => {
  it('sums the file sizes of every item in the store', async () => {
    db.file.aggregate.mockResolvedValue({ _sum: { fileSize: 260_000_000 } });

    expect(await computeStoreByteSize({ storeOid: 4n })).toBe(260_000_000n);

    expect(db.file.aggregate).toHaveBeenCalledWith({
      where: { storeItems: { some: { storeOid: 4n } } },
      _sum: { fileSize: true }
    });
  });

  it('treats an empty store as zero rather than null', async () => {
    db.file.aggregate.mockResolvedValue({ _sum: { fileSize: null } });

    expect(await computeStoreByteSize({ storeOid: 4n })).toBe(0n);
  });
});

describe('getStoreByteSize', () => {
  it('returns the cached value without recomputing', async () => {
    db.store.findUnique.mockResolvedValue({ byteSize: 1234n });

    expect(await getStoreByteSize({ storeOid: 4n })).toBe(1234n);
    expect(db.file.aggregate).not.toHaveBeenCalled();
  });

  it('backfills from null and writes the result back', async () => {
    db.store.findUnique.mockResolvedValue({ byteSize: null });
    db.file.aggregate.mockResolvedValue({ _sum: { fileSize: 500 } });

    expect(await getStoreByteSize({ storeOid: 4n })).toBe(500n);

    expect(db.store.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: { byteSize: 500n }
    });
  });

  it('backfills when the store row is missing entirely', async () => {
    db.store.findUnique.mockResolvedValue(null);
    db.file.aggregate.mockResolvedValue({ _sum: { fileSize: 0 } });

    expect(await getStoreByteSize({ storeOid: 4n })).toBe(0n);
  });

  it('treats a cached zero as a real value, not a missing one', async () => {
    db.store.findUnique.mockResolvedValue({ byteSize: 0n });

    expect(await getStoreByteSize({ storeOid: 4n })).toBe(0n);
    expect(db.file.aggregate).not.toHaveBeenCalled();
  });
});

describe('refreshStoreByteSize', () => {
  it('always recomputes, even when a cached value exists', async () => {
    db.file.aggregate.mockResolvedValue({ _sum: { fileSize: 900 } });

    expect(await refreshStoreByteSize({ storeOid: 4n })).toBe(900n);

    expect(db.store.findUnique).not.toHaveBeenCalled();
    expect(db.store.update).toHaveBeenCalledWith({
      where: { oid: 4n },
      data: { byteSize: 900n }
    });
  });
});

describe('applyStoreByteSizeDelta', () => {
  it('increments an existing cache', async () => {
    await applyStoreByteSizeDelta({ storeOid: 4n, delta: 100n });

    expect(db.store.updateMany).toHaveBeenCalledWith({
      where: { oid: 4n, byteSize: { not: null } },
      data: { byteSize: { increment: 100n } }
    });
  });

  it('leaves a null cache alone so the next read computes it in full', async () => {
    await applyStoreByteSizeDelta({ storeOid: 4n, delta: -100n });

    // The `byteSize: { not: null }` filter is what skips uncomputed stores.
    expect(db.store.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ byteSize: { not: null } })
      })
    );
  });

  it('does not touch the database for a zero delta', async () => {
    await applyStoreByteSizeDelta({ storeOid: 4n, delta: 0n });

    expect(db.store.updateMany).not.toHaveBeenCalled();
  });
});
