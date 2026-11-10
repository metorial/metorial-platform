import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => ({
  db: {
    codeBucket: { findFirst: vi.fn(), update: vi.fn() },
    scmRepositorySync: { findFirst: vi.fn() }
  },
  deleteBucketPath: vi.fn()
}));

vi.mock('../db', () => ({ db: h.db }));
vi.mock('../id', () => ({ getId: vi.fn() }));
vi.mock('../lib/codeWorkspace', () => ({
  codeBucketClient: { deleteBucketPath: h.deleteBucketPath }
}));
vi.mock('../lib/bitbucket', () => ({}));
vi.mock('../lib/githubApp', () => ({}));
vi.mock('../lib/gitlab', () => ({}));
vi.mock('../queues/codeBucket/bitbucket', () => ({}));
vi.mock('../queues/codeBucket/cloneBucket', () => ({}));
vi.mock('../queues/codeBucket/copyFromToBucket', () => ({}));
vi.mock('../queues/codeBucket/exportBitbucket', () => ({}));
vi.mock('../queues/codeBucket/exportGithub', () => ({}));
vi.mock('../queues/codeBucket/exportGitlab', () => ({}));
vi.mock('../queues/codeBucket/importBitbucket', () => ({}));
vi.mock('../queues/codeBucket/importGithub', () => ({}));
vi.mock('../queues/codeBucket/importGitlab', () => ({}));
vi.mock('../queues/codeBucket/importTemplate', () => ({}));
vi.mock('./codeBucketPurpose', () => ({ codeBucketPurposeService: {} }));
vi.mock('./repositorySyncState', () => ({
  terminalRepositorySyncStatuses: ['merged', 'failed', 'cancelled']
}));

import { codeBucketService } from './codeBucket';

let tenant = { oid: 7n, id: 'tenant_1' } as any;
let bucket = { oid: 3n, id: 'bucket_1', tenantOid: 7n, isReadOnly: true, deletedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  h.db.codeBucket.findFirst.mockResolvedValue(bucket);
  h.db.codeBucket.update.mockImplementation(async ({ data }) => ({ ...bucket, ...data }));
  h.deleteBucketPath.mockResolvedValue({ deletedPaths: [] });
  h.db.scmRepositorySync.findFirst.mockResolvedValue(null);
});

describe('deleting a code bucket', () => {
  it("only looks up buckets owned by the caller's tenant", async () => {
    await codeBucketService.deleteCodeBucket({ tenant, id: 'bucket_1' });

    expect(h.db.codeBucket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bucket_1', tenantOid: 7n } })
    );
  });

  it("rejects another tenant's bucket without deleting anything", async () => {
    h.db.codeBucket.findFirst.mockResolvedValue(null);

    let error = await codeBucketService
      .deleteCodeBucket({ tenant, id: 'bucket_other' })
      .catch(e => e);

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.data.status).toBe(404);
    expect(h.deleteBucketPath).not.toHaveBeenCalled();
    expect(h.db.codeBucket.update).not.toHaveBeenCalled();
  });

  it('removes every file, including from read-only buckets, then marks the bucket deleted', async () => {
    let deleted = await codeBucketService.deleteCodeBucket({ tenant, id: 'bucket_1' });

    expect(h.deleteBucketPath).toHaveBeenCalledWith({ bucketId: 'bucket_1', path: '/' });
    expect(h.db.codeBucket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: 3n }, data: { deletedAt: expect.any(Date) } })
    );
    expect(deleted.deletedAt).toBeInstanceOf(Date);
  });

  it('succeeds again for an already deleted bucket without touching its storage', async () => {
    let deletedAt = new Date('2026-11-01T00:00:00Z');
    h.db.codeBucket.findFirst.mockResolvedValue({ ...bucket, deletedAt });

    let result = await codeBucketService.deleteCodeBucket({ tenant, id: 'bucket_1' });

    expect(result.deletedAt).toBe(deletedAt);
    expect(h.deleteBucketPath).not.toHaveBeenCalled();
    expect(h.db.codeBucket.update).not.toHaveBeenCalled();
  });

  it('keeps the bucket when storage deletion fails so a retry can finish it', async () => {
    h.deleteBucketPath.mockRejectedValue(new Error('unavailable'));

    await expect(
      codeBucketService.deleteCodeBucket({ tenant, id: 'bucket_1' })
    ).rejects.toThrow('unavailable');
    expect(h.db.codeBucket.update).not.toHaveBeenCalled();
  });

  it('refuses with code_bucket_in_use while a repository sync still exports it', async () => {
    h.db.scmRepositorySync.findFirst.mockResolvedValue({ id: 'sync_1' });

    let error = await codeBucketService
      .deleteCodeBucket({ tenant, id: 'bucket_1' })
      .catch(e => e);

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.data).toMatchObject({ status: 409, code: 'code_bucket_in_use' });
    expect(h.db.scmRepositorySync.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { codeBucketOid: 3n, status: { notIn: ['merged', 'failed', 'cancelled'] } }
      })
    );
    expect(h.deleteBucketPath).not.toHaveBeenCalled();
    expect(h.db.codeBucket.update).not.toHaveBeenCalled();
  });

  it('does not check syncs for an already deleted bucket', async () => {
    h.db.codeBucket.findFirst.mockResolvedValue({ ...bucket, deletedAt: new Date() });
    h.db.scmRepositorySync.findFirst.mockResolvedValue({ id: 'sync_1' });

    await expect(
      codeBucketService.deleteCodeBucket({ tenant, id: 'bucket_1' })
    ).resolves.toMatchObject({ id: 'bucket_1' });
  });
});

describe('getting a code bucket', () => {
  it("only finds live buckets owned by the caller's tenant", async () => {
    await codeBucketService.getCodeBucketById({ tenant, id: 'bucket_1' });

    expect(h.db.codeBucket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bucket_1', tenantOid: 7n, deletedAt: null } })
    );
  });

  it("answers 404 for another tenant's bucket", async () => {
    h.db.codeBucket.findFirst.mockResolvedValue(null);

    let error = await codeBucketService
      .getCodeBucketById({ tenant, id: 'bucket_other' })
      .catch(e => e);

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.data.status).toBe(404);
  });
});
