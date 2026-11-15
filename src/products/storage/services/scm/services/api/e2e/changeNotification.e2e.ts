import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { origin } from './client';
import { expectRpcError } from './errors';
import {
  createChangeNotification,
  createDbCodeBucket,
  createPush,
  createRepoSetup,
  createSync,
  createTenant
} from './fixtures';

describe('origin change notification', () => {
  it('gets a notification with its repository, push and sync', async () => {
    let { tenant, repo } = await createRepoSetup();
    let push = await createPush({ tenantOid: tenant.oid, repoOid: repo.oid });
    let bucket = await createDbCodeBucket({ tenantOid: tenant.oid, repositoryOid: repo.oid });
    let sync = await createSync({
      tenantOid: tenant.oid,
      repoOid: repo.oid,
      codeBucketOid: bucket.oid
    });
    let notification = await createChangeNotification({
      tenantOid: tenant.oid,
      repoOid: repo.oid,
      type: 'repository_sync_status_changed',
      repoPushOid: push.oid,
      repositorySyncOid: sync.oid
    });

    let fetched = await origin.changeNotification.get({
      tenantId: tenant.id,
      changeNotificationId: notification.id
    });

    expect(fetched).toMatchObject({
      object: 'origin#changeNotification',
      id: notification.id,
      type: 'repository_sync_status_changed',
      tenantId: tenant.id,
      repo: { id: repo.id },
      repoPush: { id: push.id, repo: { id: repo.id } },
      repositorySync: { id: sync.id }
    });
  });

  it('omits the push and sync when they are not linked', async () => {
    let { tenant, repo } = await createRepoSetup();
    let notification = await createChangeNotification({
      tenantOid: tenant.oid,
      repoOid: repo.oid
    });

    let fetched = await origin.changeNotification.get({
      tenantId: tenant.id,
      changeNotificationId: notification.id
    });

    expect(fetched.repoPush).toBeUndefined();
    expect(fetched.repositorySync).toBeUndefined();
  });

  it('does not return notifications of other tenants', async () => {
    let { tenant, repo } = await createRepoSetup();
    let other = await createTenant();
    let notification = await createChangeNotification({
      tenantOid: tenant.oid,
      repoOid: repo.oid
    });

    await expectRpcError(
      origin.changeNotification.get({
        tenantId: other.id,
        changeNotificationId: notification.id
      }),
      'not_found'
    );
    await expectRpcError(
      origin.changeNotification.get({
        tenantId: tenant.id,
        changeNotificationId: uniqueId('missing')
      }),
      'not_found'
    );
  });

  it('lists notifications filtered by repository', async () => {
    let { tenant, repo } = await createRepoSetup();
    let other = await createRepoSetup();

    let first = await createChangeNotification({ tenantOid: tenant.oid, repoOid: repo.oid });
    let second = await createChangeNotification({ tenantOid: tenant.oid, repoOid: repo.oid });
    let foreign = await createChangeNotification({
      tenantOid: other.tenant.oid,
      repoOid: other.repo.oid
    });

    let list = await origin.changeNotification.list({ repoId: repo.id });

    let ids = list.items.map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids).not.toContain(foreign.id);
    expect(list.items.every(item => item.repo.id === repo.id)).toBe(true);
  });

  describe('poll', () => {
    it('returns notifications in order and advances the cursor', async () => {
      let { tenant, repo } = await createRepoSetup();
      let first = await createChangeNotification({ tenantOid: tenant.oid, repoOid: repo.oid });
      let second = await createChangeNotification({
        tenantOid: tenant.oid,
        repoOid: repo.oid
      });

      let page = await origin.changeNotification.poll({ tenantId: tenant.id });

      expect(page.items.map(item => item.id)).toEqual([first.id, second.id]);
      expect(page.nextCursor).toBe(second.oid.toString());

      let next = await origin.changeNotification.poll({
        tenantId: tenant.id,
        afterCursor: page.nextCursor
      });
      expect(next.items).toEqual([]);
      expect(next.nextCursor).toBe(page.nextCursor);

      let third = await createChangeNotification({ tenantOid: tenant.oid, repoOid: repo.oid });
      let more = await origin.changeNotification.poll({
        tenantId: tenant.id,
        afterCursor: page.nextCursor
      });
      expect(more.items.map(item => item.id)).toEqual([third.id]);
    });

    it('respects the limit', async () => {
      let { tenant, repo } = await createRepoSetup();
      let created = [];
      for (let i = 0; i < 3; i++)
        created.push(
          await createChangeNotification({ tenantOid: tenant.oid, repoOid: repo.oid })
        );

      let seen: string[] = [];
      let cursor: string | undefined;

      for (let i = 0; i < 5; i++) {
        let page = await origin.changeNotification.poll({
          tenantId: tenant.id,
          afterCursor: cursor,
          limit: 2
        });
        expect(page.items.length).toBeLessThanOrEqual(2);
        if (page.items.length === 0) break;
        seen.push(...page.items.map(item => item.id));
        cursor = page.nextCursor;
      }

      expect(seen).toEqual(created.map(item => item.id));
    });

    it('only returns sync status notifications', async () => {
      let { tenant, repo } = await createRepoSetup();
      let push = await createPush({ tenantOid: tenant.oid, repoOid: repo.oid });
      let pushNotification = await createChangeNotification({
        tenantOid: tenant.oid,
        repoOid: repo.oid,
        type: 'repo_push',
        repoPushOid: push.oid
      });
      let syncNotification = await createChangeNotification({
        tenantOid: tenant.oid,
        repoOid: repo.oid,
        type: 'repository_sync_status_changed'
      });

      let page = await origin.changeNotification.poll({ tenantId: tenant.id });
      let ids = page.items.map(item => item.id);

      expect(ids).toContain(syncNotification.id);
      expect(ids).not.toContain(pushNotification.id);
    });

    it('isolates tenants', async () => {
      let { tenant, repo } = await createRepoSetup();
      let other = await createTenant();
      await createChangeNotification({ tenantOid: tenant.oid, repoOid: repo.oid });

      let page = await origin.changeNotification.poll({ tenantId: other.id });
      expect(page.items).toEqual([]);
    });

    it('rejects an invalid cursor and limit', async () => {
      let tenant = await createTenant();

      let error = await expectRpcError(
        origin.changeNotification.poll({ tenantId: tenant.id, afterCursor: 'abc' }),
        'bad_request'
      );
      expect(error.message).toBe('Invalid change notification cursor');

      for (let limit of [0, -1, 1.5])
        await expectRpcError(
          origin.changeNotification.poll({ tenantId: tenant.id, limit }),
          'invalid_data'
        );
    });
  });
});
