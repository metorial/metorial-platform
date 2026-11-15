import { beforeEach, describe, expect, it, vi } from 'vitest';

let { findMany, remote } = vi.hoisted(() => ({ findMany: vi.fn(), remote: vi.fn() }));

vi.mock('@metorial/db', () => ({
  db: { skillDestinationSyncRepositoryPropagation: { findMany } }
}));
vi.mock('@metorial/skills-scm-utils', () => ({
  getOriginTenant: async () => ({ id: 'tenant' }),
  origin: { scmRepositorySync: { getMany: remote } }
}));

import { destinationBucketIsAvailable } from './bucket';

let sync = { oid: 2n, destinationOid: 1n };
let propagation = { originSyncId: 'remote', skillRepository: { project: {} } };

describe('shared destination bucket ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findMany.mockResolvedValue([propagation]);
  });

  it('blocks new content until every older request has been dispatched', async () => {
    findMany.mockResolvedValue([propagation, { ...propagation, originSyncId: null }]);

    expect(await destinationBucketIsAvailable(sync)).toBe(false);
    expect(remote).not.toHaveBeenCalled();
  });

  it.each(['pending', 'creating_branch', 'syncing_contents'])(
    'blocks content while an older request is %s',
    async status => {
      remote.mockResolvedValue({ syncs: [{ id: 'remote', status }] });

      expect(await destinationBucketIsAvailable(sync)).toBe(false);
    }
  );

  it.each([
    'creating_pr',
    'waiting_for_ci',
    'waiting_for_review',
    'merging',
    'merged',
    'failed',
    'cancelled',
    'complete_direct_push'
  ])('allows edits after Origin has consumed the bucket: %s', async status => {
    remote.mockResolvedValue({ syncs: [{ id: 'remote', status }] });

    expect(await destinationBucketIsAvailable(sync)).toBe(true);
  });

  it('does not treat a missing remote result as permission to overwrite the bucket', async () => {
    remote.mockResolvedValue({ syncs: [] });

    expect(await destinationBucketIsAvailable(sync)).toBe(false);
  });

  it('allows destinations without earlier repository work', async () => {
    findMany.mockResolvedValue([]);

    expect(await destinationBucketIsAvailable(sync)).toBe(true);
  });
});
