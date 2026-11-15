import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { origin } from './client';
import { expectRpcError } from './errors';
import {
  createDbCodeBucket,
  createRepoSetup,
  createRepository,
  createTenant
} from './fixtures';

describe('origin scm repository', () => {
  it('gets a repository', async () => {
    let { tenant, repo, account } = await createRepoSetup();

    let fetched = await origin.scmRepository.get({
      tenantId: tenant.id,
      scmRepositoryId: repo.id
    });

    expect(fetched).toMatchObject({
      object: 'origin#repository',
      id: repo.id,
      name: repo.name,
      identifier: repo.identifier,
      provider: 'gitlab',
      externalOwner: 'owner',
      externalIsPrivate: true,
      defaultBranch: 'main',
      account: { id: account.id }
    });
  });

  it('does not expose internal oids', async () => {
    let { tenant, repo } = await createRepoSetup();

    let fetched = await origin.scmRepository.get({
      tenantId: tenant.id,
      scmRepositoryId: repo.id
    });

    for (let key of Object.keys(fetched)) expect(key).not.toMatch(/oid$/i);
  });

  it('rejects an unknown or foreign repository', async () => {
    let { repo } = await createRepoSetup();
    let other = await createTenant();

    await expectRpcError(
      origin.scmRepository.get({ tenantId: other.id, scmRepositoryId: repo.id }),
      'bad_request'
    );
    await expectRpcError(
      origin.scmRepository.get({ tenantId: other.id, scmRepositoryId: uniqueId('missing') }),
      'bad_request'
    );
  });

  it('gets many repositories and skips foreign and unknown ids', async () => {
    let { tenant, backend, installation, account, repo } = await createRepoSetup();
    let second = await createRepository({ tenant, backend, installation, account });
    let foreign = await createRepoSetup();

    let result = await origin.scmRepository.getMany({
      tenantId: tenant.id,
      scmRepositoryIds: [repo.id, second.id, foreign.repo.id, uniqueId('missing')]
    });

    expect(result.repositories.map(item => item.id).sort()).toEqual(
      [repo.id, second.id].sort()
    );
  });

  it('returns nothing for an empty id list', async () => {
    let tenant = await createTenant();

    let result = await origin.scmRepository.getMany({
      tenantId: tenant.id,
      scmRepositoryIds: []
    });
    expect(result.repositories).toEqual([]);
  });

  it('rejects an unknown or foreign installation for previews, link and create', async () => {
    let { installation } = await createRepoSetup();
    let other = await createTenant();
    let missing = uniqueId('missing');

    for (let scmInstallationId of [installation.id, missing]) {
      await expectRpcError(
        origin.scmRepository.listAccountPreviews({ tenantId: other.id, scmInstallationId }),
        'not_found'
      );
      await expectRpcError(
        origin.scmRepository.listRepositoryPreviews({ tenantId: other.id, scmInstallationId }),
        'not_found'
      );
      await expectRpcError(
        origin.scmRepository.link({ tenantId: other.id, scmInstallationId, externalId: '1' }),
        'not_found'
      );
      await expectRpcError(
        origin.scmRepository.create({
          tenantId: other.id,
          scmInstallationId,
          externalAccountId: '1',
          name: 'repo',
          isPrivate: true
        }),
        'not_found'
      );
    }
  });

  it('validates the preview limit', async () => {
    let { tenant, installation } = await createRepoSetup();

    for (let limit of [0, 101]) {
      await expectRpcError(
        origin.scmRepository.listRepositoryPreviews({
          tenantId: tenant.id,
          scmInstallationId: installation.id,
          limit
        }),
        'invalid_data'
      );
    }
  });

  it('validates create and sync inputs', async () => {
    let { tenant, installation, repo } = await createRepoSetup();

    await expectRpcError(
      origin.scmRepository.create({
        tenantId: tenant.id,
        scmInstallationId: installation.id,
        externalAccountId: '1',
        name: 'repo'
      } as any),
      'invalid_data'
    );
    await expectRpcError(
      origin.scmRepository.syncCodeBucket({
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: 'bucket',
        repositoryAccessMode: 'force_push' as any
      }),
      'invalid_data'
    );
  });

  describe('syncCodeBucket', () => {
    it('creates a pending sync for a pull request', async () => {
      let { tenant, repo } = await createRepoSetup();
      let bucket = await createDbCodeBucket({
        tenantOid: tenant.oid,
        repositoryOid: repo.oid
      });

      let sync = await origin.scmRepository.syncCodeBucket({
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: bucket.id,
        repositoryAccessMode: 'pull_request',
        branchName: 'feature/one',
        prName: 'Add feature',
        prDescription: 'Details'
      });

      expect(sync).toMatchObject({
        object: 'origin#repository_sync',
        repositoryAccessMode: 'pull_request',
        branchName: 'feature/one',
        baseBranch: 'main',
        title: 'Add feature',
        description: 'Details',
        enableAutoMerge: true,
        forceMergeOrPush: false,
        mergeBeforeChecksPass: false
      });

      let row = await db.scmRepositorySync.findUniqueOrThrow({ where: { id: sync.id } });
      expect(row).toMatchObject({
        tenantOid: tenant.oid,
        repoOid: repo.oid,
        codeBucketOid: bucket.oid
      });
    });

    it('uses the default branch for direct pushes', async () => {
      let { tenant, repo } = await createRepoSetup();
      let bucket = await createDbCodeBucket({
        tenantOid: tenant.oid,
        repositoryOid: repo.oid
      });

      let sync = await origin.scmRepository.syncCodeBucket({
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: bucket.id,
        repositoryAccessMode: 'default_branch',
        commitMessage: 'Direct commit'
      });

      expect(sync).toMatchObject({
        repositoryAccessMode: 'default_branch',
        branchName: 'main',
        title: 'Direct commit'
      });
    });

    it('requires a branch and title', async () => {
      let { tenant, repo } = await createRepoSetup();
      let bucket = await createDbCodeBucket({
        tenantOid: tenant.oid,
        repositoryOid: repo.oid
      });
      let base = {
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: bucket.id
      };

      let noBranch = await expectRpcError(
        origin.scmRepository.syncCodeBucket({
          ...base,
          repositoryAccessMode: 'pull_request',
          prName: 'Title'
        }),
        'bad_request'
      );
      expect(noBranch.message).toBe('Branch name is required');

      let noTitle = await expectRpcError(
        origin.scmRepository.syncCodeBucket({
          ...base,
          repositoryAccessMode: 'pull_request',
          branchName: 'branch'
        }),
        'bad_request'
      );
      expect(noTitle.message).toBe('Pull request name is required');

      let noCommit = await expectRpcError(
        origin.scmRepository.syncCodeBucket({
          ...base,
          repositoryAccessMode: 'default_branch'
        }),
        'bad_request'
      );
      expect(noCommit.message).toBe('Commit message is required');
    });

    it('is idempotent for a repeated request key', async () => {
      let { tenant, repo } = await createRepoSetup();
      let bucket = await createDbCodeBucket({
        tenantOid: tenant.oid,
        repositoryOid: repo.oid
      });
      let input = {
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: bucket.id,
        repositoryAccessMode: 'pull_request' as const,
        requestKey: uniqueId('key'),
        branchName: 'feature/idempotent',
        prName: 'Idempotent'
      };

      let first = await origin.scmRepository.syncCodeBucket(input);
      let second = await origin.scmRepository.syncCodeBucket(input);

      expect(second.id).toBe(first.id);
      expect(
        await db.scmRepositorySync.count({
          where: { tenantOid: tenant.oid, requestKey: input.requestKey }
        })
      ).toBe(1);
    });

    it('rejects a request key reused with different parameters', async () => {
      let { tenant, repo } = await createRepoSetup();
      let bucket = await createDbCodeBucket({
        tenantOid: tenant.oid,
        repositoryOid: repo.oid
      });
      let input = {
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: bucket.id,
        repositoryAccessMode: 'pull_request' as const,
        requestKey: uniqueId('key'),
        branchName: 'feature/a',
        prName: 'First'
      };

      await origin.scmRepository.syncCodeBucket(input);

      let error = await expectRpcError(
        origin.scmRepository.syncCodeBucket({ ...input, prName: 'Second' }),
        'bad_request'
      );
      expect(error.message).toContain('request key was already used');
    });

    it('scopes request keys per tenant', async () => {
      let first = await createRepoSetup();
      let second = await createRepoSetup();
      let requestKey = uniqueId('key');

      let sync = async (setup: typeof first) => {
        let bucket = await createDbCodeBucket({
          tenantOid: setup.tenant.oid,
          repositoryOid: setup.repo.oid
        });
        return origin.scmRepository.syncCodeBucket({
          tenantId: setup.tenant.id,
          scmRepositoryId: setup.repo.id,
          codeBucketId: bucket.id,
          repositoryAccessMode: 'pull_request',
          requestKey,
          branchName: 'feature/shared',
          prName: 'Shared'
        });
      };

      let a = await sync(first);
      let b = await sync(second);
      expect(a.id).not.toBe(b.id);
    });

    it('rejects a code bucket of another tenant', async () => {
      let { tenant, repo } = await createRepoSetup();
      let other = await createTenant();
      let foreignBucket = await createDbCodeBucket({ tenantOid: other.oid });

      await expectRpcError(
        origin.scmRepository.syncCodeBucket({
          tenantId: tenant.id,
          scmRepositoryId: repo.id,
          codeBucketId: foreignBucket.id,
          repositoryAccessMode: 'pull_request',
          branchName: 'branch',
          prName: 'Title'
        }),
        'not_found'
      );
    });

    it('rejects a repository of another tenant', async () => {
      let { repo } = await createRepoSetup();
      let other = await createTenant();
      let bucket = await createDbCodeBucket({ tenantOid: other.oid });

      await expectRpcError(
        origin.scmRepository.syncCodeBucket({
          tenantId: other.id,
          scmRepositoryId: repo.id,
          codeBucketId: bucket.id,
          repositoryAccessMode: 'pull_request',
          branchName: 'branch',
          prName: 'Title'
        }),
        'bad_request'
      );
    });

    it('creates a pull request sync with syncCodeBucketToBranch', async () => {
      let { tenant, repo } = await createRepoSetup();
      let bucket = await createDbCodeBucket({
        tenantOid: tenant.oid,
        repositoryOid: repo.oid
      });

      let sync = await origin.scmRepository.syncCodeBucketToBranch({
        tenantId: tenant.id,
        scmRepositoryId: repo.id,
        codeBucketId: bucket.id,
        branchName: 'feature/to-branch',
        prName: 'To branch'
      });

      expect(sync).toMatchObject({
        repositoryAccessMode: 'pull_request',
        branchName: 'feature/to-branch',
        title: 'To branch'
      });
    });
  });
});
