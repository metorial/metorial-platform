import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let h = vi.hoisted(() => {
  let tx = {
    scmRepositoryWebhookReceivedEvent: { create: vi.fn(async () => ({ oid: 1n })) },
    scmRepositoryPush: { create: vi.fn(async () => ({ id: 'push_1' })) }
  };
  return {
    accelerate: vi.fn(),
    webhook: { findUnique: vi.fn() },
    tx,
    db: {
      scmRepositoryWebhook: { findUnique: vi.fn() },
      scmRepositoryPush: { update: vi.fn() },
      $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx))
    }
  };
});

vi.mock('../lib/scmTokenRefreshLock', () => ({ usingScmTokenRefreshLock: vi.fn() }));
vi.mock('../queues/scm/repositorySync/recover', () => ({
  accelerateRepositorySyncsForProviderEvent: h.accelerate
}));
vi.mock('../db', () => ({ db: h.db }));
vi.mock('../id', () => ({ getId: () => ({ oid: 1n, id: 'push_1' }) }));
vi.mock('../env', () => ({ delegateSecretsToNebula: false }));
vi.mock('../lib/githubApp', () => ({ createGitHubInstallationClient: vi.fn() }));
vi.mock('../lib/gitlab', () => ({ createGitLabClientWithInstallation: vi.fn() }));
vi.mock('../lib/bitbucket', () => ({ createBitbucketClientWithInstallation: vi.fn() }));
vi.mock('../lib/scmCredentials', () => ({ readWebhookSigningSecret: async () => 'secret' }));
vi.mock('../queues/scm/createRepoWebhook', () => ({
  createRepoWebhookQueue: { add: vi.fn() }
}));
vi.mock('../queues/scm/handleRepoPush', () => ({
  createHandleRepoPushQueue: { add: vi.fn() }
}));

import { scmRepoService } from './scmRepo';

let sign = (payload: string) =>
  `sha256=${crypto.createHmac('sha256', 'secret').update(payload).digest('hex')}`;

let useWebhook = (provider: string, backendType = provider) =>
  h.db.scmRepositoryWebhook.findUnique.mockResolvedValue({
    oid: 1n,
    repo: {
      oid: 10n,
      tenantOid: 1n,
      provider,
      installation: { backend: { type: backendType, webUrl: 'https://scm.example' } }
    }
  });

let deletionCalls = () =>
  h.accelerate.mock.calls.map(call => call[0]).filter(call => call.deletedBranchName);

beforeEach(() => vi.clearAllMocks());

describe('branch deletion webhooks', () => {
  it('wakes manifest syncs when a GitHub push deletes a branch', async () => {
    useWebhook('github');
    let payload = JSON.stringify({
      ref: 'refs/heads/metorial/skills-1',
      after: '0'.repeat(40),
      deleted: true,
      pusher: { name: 'a', email: 'a@example.test' },
      sender: { login: 'a' },
      commits: []
    });

    await scmRepoService.receiveGitHubWebhookEvent({
      webhookId: 'wh',
      idempotencyKey: 'delivery_1',
      eventType: 'push',
      payload,
      signature: sign(payload)
    });

    expect(deletionCalls()).toEqual([
      {
        repoOid: 10n,
        deletedBranchName: 'metorial/skills-1',
        idempotencyKey: 'delivery_1:deleted'
      }
    ]);
  });

  it('ignores ordinary GitHub pushes', async () => {
    useWebhook('github');
    let payload = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'abc',
      pusher: { name: 'a', email: 'a@example.test' },
      sender: { login: 'a' },
      commits: []
    });

    await scmRepoService.receiveGitHubWebhookEvent({
      webhookId: 'wh',
      idempotencyKey: 'delivery_2',
      eventType: 'push',
      payload,
      signature: sign(payload)
    });

    expect(deletionCalls()).toEqual([]);
  });

  it('wakes manifest syncs when a GitLab push deletes a branch', async () => {
    useWebhook('gitlab');

    await scmRepoService.receiveGitLabWebhookEvent({
      webhookId: 'wh',
      idempotencyKey: 'delivery_3',
      eventType: 'Push Hook',
      token: 'secret',
      payload: JSON.stringify({
        object_kind: 'push',
        ref: 'refs/heads/metorial/skills-1',
        after: '0'.repeat(40),
        commits: []
      })
    });

    expect(deletionCalls()).toEqual([
      expect.objectContaining({ deletedBranchName: 'metorial/skills-1' })
    ]);
  });

  it.each([
    [
      'Bitbucket Cloud',
      'bitbucket',
      'repo:push',
      {
        push: { changes: [{ old: { type: 'branch', name: 'metorial/skills-1' }, new: null }] }
      }
    ],
    [
      'Bitbucket Data Center',
      'bitbucket_data_center',
      'repo:refs_changed',
      {
        changes: [
          {
            type: 'DELETE',
            ref: { type: 'BRANCH', displayId: 'metorial/skills-1' },
            toHash: '0'.repeat(40)
          }
        ]
      }
    ]
  ])(
    'wakes manifest syncs when a %s push deletes a branch',
    async (_label, type, eventType, event) => {
      useWebhook('bitbucket', type);
      let payload = JSON.stringify(event);

      await scmRepoService.receiveBitbucketWebhookEvent({
        webhookId: 'wh',
        idempotencyKey: 'delivery_4',
        eventType,
        payload,
        signature: sign(payload)
      });

      expect(deletionCalls()).toEqual([
        {
          repoOid: 10n,
          deletedBranchName: 'metorial/skills-1',
          idempotencyKey: 'delivery_4:deleted:metorial/skills-1'
        }
      ]);
      expect(h.tx.scmRepositoryPush.create).not.toHaveBeenCalled();
    }
  );
});
