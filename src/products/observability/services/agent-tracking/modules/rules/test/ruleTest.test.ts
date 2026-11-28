import { describe, expect, it, vi } from 'vitest';
import { testRuleDraft } from '../src/lib/test';

let filters: unknown[] = [];

vi.mock('@mtsrc/agent-tracking-store', async importOriginal => ({
  ...(await importOriginal<typeof import('@mtsrc/agent-tracking-store')>()),
  isStoreConfigured: () => true,
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      sessions: {
        find: (filter: unknown) => {
          filters.push(filter);

          let chain = { sort: () => chain, limit: () => chain, toArray: async () => [] };
          return chain;
        }
      }
    })
  })
}));

describe('testRuleDraft', () => {
  it('tests a draft rule only on sessions in which something happened', async () => {
    let result = await testRuleDraft({
      organizationId: 'ator_1',
      draft: {} as never,
      target: {} as never,
      now: new Date('2026-03-04T10:00:00Z')
    });

    expect(result.sessionsEvaluated).toBe(0);
    expect(filters).toEqual([
      expect.objectContaining({ organizationId: 'ator_1', empty: { $ne: true } })
    ]);
  });
});
