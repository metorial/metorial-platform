import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, mocks } = vi.hoisted(() => {
  let mocks = {
    findSkill: vi.fn(),
    deleteLinks: vi.fn(),
    createLink: vi.fn()
  };
  let db = {
    skill: { findUnique: mocks.findSkill },
    skillProviderLink: {
      deleteMany: mocks.deleteLinks,
      create: mocks.createLink
    }
  };
  return { db, mocks };
});

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    addMany: vi.fn(),
    process: vi.fn(() => ({}))
  })),
  QueueRetryError: class QueueRetryError extends Error {}
}));

vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({ redisUrl: 'redis://test' }))
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  ID: {
    generateId: vi.fn(() => Promise.resolve('link_100'))
  },
  withTransaction: vi.fn(async (callback: (tx: typeof db) => unknown) => await callback(db))
}));

import { reconcileSkillProviderLinks } from './reconcileSkillProviderLinks';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconcileSkillProviderLinks', () => {
  it('combines direct and integration providers while removing stale links', async () => {
    mocks.findSkill.mockResolvedValue({
      oid: 1n,
      status: 'active',
      skillProviders: [{ providerOid: 10n }],
      skillIntegrations: [
        {
          integration: {
            providers: [{ providerOid: 20n }]
          }
        }
      ],
      skillProviderLinks: [
        { oid: 30n, providerOid: 10n },
        { oid: 40n, providerOid: 99n }
      ]
    });

    await reconcileSkillProviderLinks({ skillId: 'skl_1' });

    expect(mocks.deleteLinks).toHaveBeenCalledWith({
      where: { oid: { in: [40n] } }
    });
    expect(mocks.createLink).toHaveBeenCalledWith({
      data: {
        id: 'link_100',
        skillOid: 1n,
        providerOid: 20n
      }
    });
  });
});
