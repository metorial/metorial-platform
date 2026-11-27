import { beforeEach, expect, it, vi } from 'vitest';

let { list } = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@metorial/data-hooks', () => ({ createLoader: (config: unknown) => config }));
vi.mock('../../user', () => ({
  withAuth: (callback: (sdk: unknown) => unknown) => callback({ sandbox: { specs: { list } } })
}));

import { sandboxSpecsLoader } from './catalog';

beforeEach(() => list.mockReset());

it('loads specs beyond the first page, including the largest machine sizes', async () => {
  let firstPage = Array.from({ length: 100 }, (_, index) => ({
    id: `spec-${index}`,
    cpus: 0.5,
    memoryGib: 0.5
  }));
  let largest = { id: 'largest', cpus: 16, memoryGib: 32, available: false };
  list.mockResolvedValueOnce({ items: firstPage, pagination: { hasMoreAfter: true } });
  list.mockResolvedValueOnce({ items: [largest], pagination: { hasMoreAfter: false } });

  let loader = sandboxSpecsLoader as unknown as {
    fetch: (input: {
      instanceId: string;
    }) => Promise<{ items: unknown[]; pagination: { hasMoreAfter: boolean } }>;
  };
  let result = await loader.fetch({ instanceId: 'instance' });

  expect(result.items).toHaveLength(101);
  expect(result.items).toContainEqual(largest);
  expect(list).toHaveBeenNthCalledWith(2, 'instance', { after: 'spec-99', limit: 100 });
  expect(result.pagination.hasMoreAfter).toBe(false);
});
