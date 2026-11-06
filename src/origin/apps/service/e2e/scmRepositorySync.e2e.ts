import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createDbCodeBucket, createRepoSetup, createSync, createTenant } from './fixtures';

let setupSync = async () => {
  let setup = await createRepoSetup();
  let bucket = await createDbCodeBucket({
    tenantOid: setup.tenant.oid,
    repositoryOid: setup.repo.oid
  });
  let sync = await createSync({
    tenantOid: setup.tenant.oid,
    repoOid: setup.repo.oid,
    codeBucketOid: bucket.oid
  });

  return { ...setup, bucket, sync };
};

describe('origin scm repository sync', () => {
  it('gets many syncs', async () => {
    let { tenant, sync, repo, bucket } = await setupSync();
    let second = await createSync({
      tenantOid: tenant.oid,
      repoOid: repo.oid,
      codeBucketOid: bucket.oid,
      status: 'failed'
    });

    let result = await origin.scmRepositorySync.getMany({
      tenantId: tenant.id,
      scmRepositorySyncIds: [sync.id, second.id, uniqueId('missing')]
    });

    expect(result.syncs.map(item => item.id).sort()).toEqual([sync.id, second.id].sort());

    let presented = result.syncs.find(item => item.id === sync.id)!;
    expect(presented).toMatchObject({
      object: 'origin#repository_sync',
      status: 'complete_no_changes',
      repositoryAccessMode: 'pull_request',
      baseBranch: 'main',
      title: 'Sync',
      mergeAttemptStatus: 'not_attempted',
      providerPrId: null
    });
    expect(Object.keys(presented)).not.toContain('requestKey');
  });

  it('does not return syncs of other tenants', async () => {
    let { sync } = await setupSync();
    let other = await createTenant();

    let result = await origin.scmRepositorySync.getMany({
      tenantId: other.id,
      scmRepositorySyncIds: [sync.id]
    });
    expect(result.syncs).toEqual([]);
  });

  it('returns nothing for an empty id list', async () => {
    let tenant = await createTenant();

    let result = await origin.scmRepositorySync.getMany({
      tenantId: tenant.id,
      scmRepositorySyncIds: []
    });
    expect(result.syncs).toEqual([]);
  });

  it('returns the stored sync from checkStatus when no pull request exists', async () => {
    let { tenant, sync } = await setupSync();

    let checked = await origin.scmRepositorySync.checkStatus({
      tenantId: tenant.id,
      scmRepositorySyncId: sync.id
    });

    expect(checked).toMatchObject({ id: sync.id, status: 'complete_no_changes' });
  });

  it('rejects checkStatus for foreign and unknown syncs', async () => {
    let { sync } = await setupSync();
    let other = await createTenant();

    await expectRpcError(
      origin.scmRepositorySync.checkStatus({
        tenantId: other.id,
        scmRepositorySyncId: sync.id
      }),
      'not_found'
    );
    await expectRpcError(
      origin.scmRepositorySync.checkStatus({
        tenantId: other.id,
        scmRepositorySyncId: uniqueId('missing')
      }),
      'not_found'
    );
  });
});
