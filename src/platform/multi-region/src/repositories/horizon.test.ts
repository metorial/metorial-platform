import { beforeEach, describe, expect, it, vi } from 'vitest';

let { upsert, findUnique } = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn()
}));

vi.mock('../db', () => ({
  globalDB: {
    horizon: { upsert, findUnique }
  }
}));

import { horizonRepository } from './horizon';

describe('Horizon repository', () => {
  beforeEach(() => {
    upsert.mockReset();
    findUnique.mockReset();
  });

  it('registers Horizon idempotently and updates its endpoint', async () => {
    upsert.mockResolvedValueOnce({
      oid: 1,
      identifier: 'default',
      endpointUrl: 'https://horizon.example/rpc'
    });

    await horizonRepository.registerHorizon({
      identifier: 'default',
      endpointUrl: 'https://horizon.example/rpc'
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { identifier: 'default' },
      create: {
        identifier: 'default',
        endpointUrl: 'https://horizon.example/rpc'
      },
      update: { endpointUrl: 'https://horizon.example/rpc' }
    });
  });

  it('looks up Horizon without touching the Cell model', async () => {
    findUnique.mockResolvedValueOnce(null);

    await expect(horizonRepository.getHorizon({ identifier: 'other' })).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { identifier: 'other' } });
  });
});
