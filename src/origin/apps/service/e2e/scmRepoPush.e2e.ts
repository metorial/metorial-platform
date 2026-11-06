import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createPush, createRepoSetup, createRepository, createTenant } from './fixtures';

describe('origin scm repository push', () => {
  it('gets a push with its repository', async () => {
    let { tenant, repo } = await createRepoSetup();
    let push = await createPush({
      tenantOid: tenant.oid,
      repoOid: repo.oid,
      branchName: 'release'
    });

    let fetched = await origin.scmRepoPush.get({
      tenantId: tenant.id,
      scmRepoPushId: push.id
    });

    expect(fetched).toMatchObject({
      object: 'origin#scmRepositoryPush',
      id: push.id,
      sha: push.sha,
      branchName: 'release',
      pusherName: 'Pusher',
      pusherEmail: 'pusher@example.test',
      commitMessage: 'A commit',
      repo: { id: repo.id }
    });
  });

  it('lists the pushes of the tenant', async () => {
    let { tenant, repo } = await createRepoSetup();
    let first = await createPush({ tenantOid: tenant.oid, repoOid: repo.oid });
    let second = await createPush({ tenantOid: tenant.oid, repoOid: repo.oid });

    let list = await origin.scmRepoPush.list({ tenantId: tenant.id });

    expect(list.items.map(item => item.id).sort()).toEqual([first.id, second.id].sort());
  });

  it('filters pushes by repository', async () => {
    let { tenant, backend, installation, account, repo } = await createRepoSetup();
    let other = await createRepository({ tenant, backend, installation, account });

    let inRepo = await createPush({ tenantOid: tenant.oid, repoOid: repo.oid });
    let inOther = await createPush({ tenantOid: tenant.oid, repoOid: other.oid });

    let list = await origin.scmRepoPush.list({ tenantId: tenant.id, repoId: repo.id });

    expect(list.items.map(item => item.id)).toEqual([inRepo.id]);
    expect(list.items.map(item => item.id)).not.toContain(inOther.id);
  });

  it('pages through pushes', async () => {
    let { tenant, repo } = await createRepoSetup();
    let created = await Promise.all(
      [1, 2, 3].map(() => createPush({ tenantOid: tenant.oid, repoOid: repo.oid }))
    );

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 10; page++) {
      let result = await origin.scmRepoPush.list({ tenantId: tenant.id, limit: 1, after });
      expect(result.items.length).toBeLessThanOrEqual(1);
      seen.push(...result.items.map(item => item.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(new Set(created.map(item => item.id)));
  });

  it('isolates pushes between tenants', async () => {
    let { tenant, repo } = await createRepoSetup();
    let other = await createTenant();
    let push = await createPush({ tenantOid: tenant.oid, repoOid: repo.oid });

    let list = await origin.scmRepoPush.list({ tenantId: other.id });
    expect(list.items).toEqual([]);

    await expectRpcError(
      origin.scmRepoPush.get({ tenantId: other.id, scmRepoPushId: push.id }),
      'not_found'
    );
  });

  it('rejects an unknown push', async () => {
    let tenant = await createTenant();

    await expectRpcError(
      origin.scmRepoPush.get({ tenantId: tenant.id, scmRepoPushId: uniqueId('missing') }),
      'not_found'
    );
  });
});
