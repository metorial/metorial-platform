import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findFirst, findUniqueOrThrow, create } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  create: vi.fn()
}));

vi.mock('../db', () => ({
  globalDB: {
    horizon: { findUniqueOrThrow },
    horizonToken: { findFirst, create }
  }
}));

import { horizonTokenRepository } from './token';

describe('Horizon token repository', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findUniqueOrThrow.mockReset();
    create.mockReset();
  });

  it('isolates reusable token lookup by Horizon identifier and expiry', async () => {
    let expiresAfter = new Date('2026-07-24T12:00:00.000Z');
    findFirst.mockResolvedValueOnce(null);

    await horizonTokenRepository.findReusableHorizonToken({
      horizonIdentifier: 'default',
      expiresAfter
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        horizon: { identifier: 'default' },
        expiresAt: { gt: expiresAfter }
      },
      include: { horizon: true },
      orderBy: { expiresAt: 'desc' }
    });
  });

  it('creates a token only for an already registered Horizon', async () => {
    findUniqueOrThrow.mockResolvedValueOnce({ oid: 42, identifier: 'default' });
    create.mockImplementationOnce(async ({ data }) => ({ ...data, id: 'hzt_1' }));

    let result = await horizonTokenRepository.createHorizonToken({
      horizonIdentifier: 'default',
      ttlMs: 60_000
    });

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { identifier: 'default' }
    });
    expect(result.id).toBe('hzt_1');
    expect(create.mock.calls[0]?.[0].data.horizonOid).toBe(42);
  });
});
