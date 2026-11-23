import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('../db', () => ({ db: { consumer: { findFirst: mocks.findFirst } } }));

let loadCache = async () => {
  vi.resetModules();
  return await import('./consumerCache');
};

describe('consumer cache', () => {
  beforeEach(() => mocks.findFirst.mockReset());

  it('finds a consumer seeded after an earlier lookup missed it', async () => {
    let { loadConsumerById } = await loadCache();
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'csm_1', identifier: 'metorial' });

    expect(await loadConsumerById({ id: 'metorial' })).toBeNull();
    expect(await loadConsumerById({ id: 'metorial' })).toMatchObject({ id: 'csm_1' });
  });

  it('serves a found consumer from the cache', async () => {
    let { loadConsumerById } = await loadCache();
    mocks.findFirst.mockResolvedValue({ id: 'csm_1', identifier: 'metorial' });

    await loadConsumerById({ id: 'csm_1' });
    await loadConsumerById({ id: 'csm_1' });

    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
  });
});
