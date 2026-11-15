import { isServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { upsert, create, enqueue } = vi.hoisted(() => ({
  upsert: vi.fn(),
  create: vi.fn(),
  enqueue: vi.fn()
}));

vi.mock('../db', () => ({ db: { scmRepositorySync: { upsert, create } } }));
vi.mock('../id', () => ({ getId: () => ({ oid: 99n, id: 'osrs_new' }) }));
vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('../queues/scm/repositorySync/start', () => ({
  startRepositorySyncQueue: { add: enqueue }
}));
vi.mock('../queues/scm/repositorySync/merge', () => ({ mergeRepositorySyncQueue: {} }));
vi.mock('../queues/scm/repositorySync/waitForCi', () => ({
  waitForCiRepositorySyncQueue: {}
}));
vi.mock('../lib/scmRepositorySyncProvider', () => ({
  getRepositorySyncStatusSnapshot: vi.fn()
}));

import { scmRepositorySyncService, type RepositorySyncSource } from './scmRepositorySync';

let tenant = { oid: 1n } as never;
let repo = { oid: 10n, tenantOid: 1n, defaultBranch: 'main' } as never;

let sha = (c: string) => c.repeat(64);

let manifestSource = (
  overrides: Partial<Extract<RepositorySyncSource, { type: 'manifest' }>> = {}
): RepositorySyncSource => ({
  type: 'manifest',
  sourceKey: 'sdst_1',
  manifest: {
    bucket: 'mte-files',
    key: `skill-sync/manifests/sdst_1/${sha('a')}.ndjson`,
    sha256: sha('a'),
    entryCount: 3
  },
  previousManifest: {
    bucket: 'mte-files',
    key: `skill-sync/manifests/sdst_1/${sha('b')}.ndjson`,
    sha256: sha('b')
  },
  ...overrides
});

let request = (source: RepositorySyncSource, extra: Record<string, unknown> = {}) => ({
  tenant,
  repo,
  source,
  repositoryAccessMode: 'pull_request' as const,
  requestKey: 'sprp_1',
  branchName: 'metorial/sdst_1',
  prName: 'Sync skills',
  ...extra
});

let errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (isServiceError(error)) return error.data;
    throw error;
  }
  return undefined;
};

describe('createScmRepositorySync with a manifest source', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    upsert.mockImplementation(async ({ create }) => ({ ...create, status: 'pending' }));
  });

  it('stores the manifest source and no code bucket', async () => {
    await scmRepositorySyncService.createScmRepositorySync(
      request(manifestSource(), {
        deletePaths: ['ignored.md'],
        explicitDeletesOnly: true,
        deletionGuard: { maxUnexpectedDeletes: 250, maxUnexpectedDeleteRatio: 0.1 },
        allowMassDelete: true
      })
    );

    let data = upsert.mock.calls[0]![0].create;
    expect(data).toMatchObject({
      sourceType: 'manifest',
      sourceKey: 'sdst_1',
      codeBucketOid: null,
      manifestBucket: 'mte-files',
      manifestSha256: sha('a'),
      manifestEntryCount: 3,
      previousManifestBucket: 'mte-files',
      previousManifestSha256: sha('b'),
      requestedBranchName: 'metorial/sdst_1',
      branchName: 'metorial/sdst_1',
      deletePaths: [],
      explicitDeletesOnly: false,
      deletionGuard: { maxUnexpectedDeletes: 250, maxUnexpectedDeleteRatio: 0.1 },
      allowMassDelete: true
    });
    expect(upsert.mock.calls[0]![0].where).toEqual({
      tenantOid_requestKey: { tenantOid: 1n, requestKey: 'sprp_1' }
    });
    expect(enqueue).toHaveBeenCalledWith({ syncId: 'osrs_new' });
  });

  it('stores no previous manifest when there is none', async () => {
    await scmRepositorySyncService.createScmRepositorySync(
      request(manifestSource({ previousManifest: undefined }))
    );

    expect(upsert.mock.calls[0]![0].create).toMatchObject({
      previousManifestBucket: null,
      previousManifestKey: null,
      previousManifestSha256: null
    });
  });

  it('returns the existing sync when the same request is replayed', async () => {
    let first = await scmRepositorySyncService.createScmRepositorySync(
      request(manifestSource())
    );
    upsert.mockResolvedValue({ ...first, status: 'syncing_contents' });

    let replay = await scmRepositorySyncService.createScmRepositorySync(
      request(manifestSource())
    );

    expect(replay.status).toBe('syncing_contents');
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('compares the requested branch, not a branch adopted later', async () => {
    let first = await scmRepositorySyncService.createScmRepositorySync(
      request(manifestSource())
    );
    upsert.mockResolvedValue({
      ...first,
      branchName: 'metorial/sdst_1-adopted',
      status: 'merged'
    });

    await expect(
      scmRepositorySyncService.createScmRepositorySync(request(manifestSource()))
    ).resolves.toMatchObject({ branchName: 'metorial/sdst_1-adopted' });
  });

  it.each([
    [
      'a different manifest',
      manifestSource({
        manifest: { ...(manifestSource() as any).manifest, sha256: sha('c') }
      }),
      {}
    ],
    ['a different previous manifest', manifestSource({ previousManifest: undefined }), {}],
    ['a different source key', manifestSource({ sourceKey: 'sdst_2' }), {}],
    ['a different requested branch', manifestSource(), { branchName: 'metorial/other' }],
    [
      'a different manifest key',
      manifestSource({
        manifest: { ...(manifestSource() as any).manifest, key: 'skill-sync/manifests/other' }
      }),
      {}
    ],
    [
      'a different manifest bucket',
      manifestSource({
        manifest: { ...(manifestSource() as any).manifest, bucket: 'other-files' }
      }),
      {}
    ],
    [
      'a different previous manifest key',
      manifestSource({
        previousManifest: {
          ...(manifestSource() as any).previousManifest,
          key: 'skill-sync/manifests/other'
        }
      }),
      {}
    ],
    [
      'a different previous manifest bucket',
      manifestSource({
        previousManifest: { ...(manifestSource() as any).previousManifest, bucket: 'other' }
      }),
      {}
    ],
    ['mass deletes newly allowed', manifestSource(), { allowMassDelete: true }]
  ])('rejects a reused request key with %s', async (_name, source, extra) => {
    let first = await scmRepositorySyncService.createScmRepositorySync(
      request(manifestSource())
    );
    upsert.mockResolvedValue(first);

    expect(
      await errorOf(scmRepositorySyncService.createScmRepositorySync(request(source, extra)))
    ).toMatchObject({ status: 400, message: 'Repository sync request key was already used' });
  });

  it('rejects a request key first used for a code bucket sync', async () => {
    upsert.mockResolvedValue({
      ...(await scmRepositorySyncService.createScmRepositorySync(
        request({ type: 'code_bucket', codeBucket: { oid: 5n, tenantOid: 1n } as never })
      ))
    });

    expect(
      await errorOf(
        scmRepositorySyncService.createScmRepositorySync(request(manifestSource()))
      )
    ).toMatchObject({ status: 400 });
  });
});

describe('createScmRepositorySync with a code bucket source', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    upsert.mockImplementation(async ({ create }) => ({ ...create, status: 'pending' }));
  });

  it('keeps the legacy fields', async () => {
    await scmRepositorySyncService.createScmRepositorySync(
      request(
        { type: 'code_bucket', codeBucket: { oid: 5n, tenantOid: 1n } as never },
        { deletePaths: ['old.md'], explicitDeletesOnly: true }
      )
    );

    expect(upsert.mock.calls[0]![0].create).toMatchObject({
      sourceType: 'code_bucket',
      sourceKey: null,
      codeBucketOid: 5n,
      manifestSha256: null,
      deletePaths: ['old.md'],
      explicitDeletesOnly: true,
      allowMassDelete: false
    });
  });

  it('still requires the code bucket to belong to the tenant', async () => {
    expect(
      await errorOf(
        scmRepositorySyncService.createScmRepositorySync(
          request({ type: 'code_bucket', codeBucket: { oid: 5n, tenantOid: 2n } as never })
        )
      )
    ).toMatchObject({ status: 400 });
    expect(upsert).not.toHaveBeenCalled();
  });
});
