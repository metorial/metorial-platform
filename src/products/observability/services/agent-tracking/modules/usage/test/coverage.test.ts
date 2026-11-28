import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Organization } from '@mtsrc/agent-tracking-db';
import { coverageService } from '../src/services/coverage';

let matches: unknown[] = [];

let cursor = <T>(rows: T[]) => {
  let chain = {
    sort: () => chain,
    limit: () => chain,
    maxTimeMS: () => chain,
    toArray: async () => rows
  };

  return chain;
};

vi.mock('@mtsrc/agent-tracking-db', () => ({ db: {} }));

vi.mock('@mtsrc/agent-tracking-store', async importOriginal => ({
  ...(await importOriginal<typeof import('@mtsrc/agent-tracking-store')>()),
  isStoreConfigured: () => true,
  getStore: () => ({
    ready: async () => {},
    collections: () => ({
      sourceHealth: { find: () => cursor([]) },
      sessions: {
        aggregate: (pipeline: { $match?: unknown }[]) => {
          matches.push(pipeline[0]!.$match);
          return cursor([]);
        }
      },
      usageSlices: { countDocuments: async () => 0 }
    })
  })
}));

describe('coverageService', () => {
  beforeEach(() => {
    matches = [];
  });

  it('counts only sessions in which something happened', async () => {
    await coverageService.getCoverage({
      organization: { id: 'ator_1' } as Organization,
      range: { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-03-02T00:00:00Z') }
    });

    expect(matches).toHaveLength(2);
    for (let match of matches) {
      expect(match).toMatchObject({ organizationId: 'ator_1', empty: { $ne: true } });
    }
  });
});
