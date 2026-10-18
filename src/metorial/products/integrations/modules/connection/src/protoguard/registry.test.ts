import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  upsert: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { protoGuardFilter: { upsert: mocks.upsert } },
  getId: (model: string) => ({ oid: 1n, id: `${model}_1` })
}));

vi.mock('./filters', () => ({
  protoGuardFilterDefinitions: [
    { key: 'a', name: 'A', description: 'a', issueType: 'x', severity: 'low' },
    { key: 'b', name: 'B', description: 'b', issueType: 'x', severity: 'low' }
  ]
}));

describe('syncProtoGuardFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  let loadRegistry = async () => {
    vi.resetModules();
    return await import('./registry');
  };

  it('upserts every filter definition once and then reuses the result', async () => {
    mocks.upsert.mockImplementation(async ({ where }) => ({ key: where.key }));
    let { syncProtoGuardFilters } = await loadRegistry();

    let filters = await syncProtoGuardFilters();
    await syncProtoGuardFilters();

    expect(filters).toHaveLength(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it('retries after a failed sync', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('db down'));
    mocks.upsert.mockImplementation(async ({ where }) => ({ key: where.key }));
    let { syncProtoGuardFilters } = await loadRegistry();

    await expect(syncProtoGuardFilters()).rejects.toThrow('db down');
    await expect(syncProtoGuardFilters()).resolves.toHaveLength(2);
  });
});
