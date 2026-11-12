import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues = new Map<string, any>();
let db = Object.fromEntries(
  [
    'triggerRegistration',
    'triggerRegistrationInstance',
    'triggerRegistrationSchedule',
    'triggerRegistrationGateway',
    'triggerRegistrationWebhook',
    'triggerWebhookTarget',
    'triggerWebhookTargetRegistrationAttempt',
    'triggerWebhookRenewalResult',
    'triggerDeliveryRoute',
    'slateWebhookRegistration'
  ].map(table => [
    table,
    Object.fromEntries(
      [
        'findUnique',
        'findUniqueOrThrow',
        'findFirst',
        'findFirstOrThrow',
        'findMany',
        'create',
        'createMany',
        'update',
        'updateMany',
        'deleteMany',
        'delete',
        'count',
        'upsert'
      ].map(method => [method, vi.fn()])
    )
  ])
);
db.$transaction = vi.fn(async (operations: any) =>
  typeof operations === 'function' ? operations(db) : Promise.all(operations)
);
let decrypt = vi.fn();
let invocation = {
  createInvocationWithState: vi.fn(),
  listWebhookTargets: vi.fn(),
  unregisterWebhook: vi.fn(),
  registerWebhook: vi.fn()
};
let createRegistration = vi.fn();
let instanceError = vi.fn();
let nextSnowflake = vi.fn();
vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => {
    let queue = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: (handler: any) => {
        queue.handler = handler;
        return queue;
      },
      handler: null as any
    };
    queues.set(name, queue);
    return queue;
  },
  QueueRetryError: class extends Error {}
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_options: any, handler: any) => ({ handler })
}));
let locks = vi.hoisted(() => ({ held: [] as (string | string[])[], taken: [] as any[] }));
vi.mock('@lowerdeck/lock', () => ({
  createLock: ({ name }: { name: string }) => ({
    usingLock: async (key: string | string[], fn: () => unknown) => {
      locks.taken.push({ name, key });
      locks.held.push(key);
      try {
        return await fn();
      } finally {
        locks.held.splice(locks.held.indexOf(key), 1);
      }
    }
  })
}));
vi.mock('./_webhookTargetLock', () => ({
  webhookTargetLock: { usingLock: (_id: string, fn: () => unknown) => fn() }
}));
vi.mock('../../db', () => ({ db }));
vi.mock('../../services/triggerInfrastructure', () => ({
  getTriggerInfrastructure: vi.fn(async () => undefined)
}));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('../../id', () => ({
  getId: () => ({ id: 'generated', oid: 9n }),
  snowflake: { nextId: () => nextSnowflake() }
}));
vi.mock('../../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ id: 'version' }))
}));
vi.mock('../../lib/webhookUrl', () => ({
  getWebhookUrl: () => 'https://example.invalid/hook'
}));
vi.mock('./_triggerAuth', async () => {
  let { secretService } = await import('../../services/secret');
  return {
    resolveTriggerAuth: async (d: any) => {
      if (!d.authConfig) return null;
      let decrypted = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: d.authConfig.secretOid,
        purpose: 'slate_authentication_configuration',
        tenant: d.tenant,
        note: d.note
      });
      return {
        authenticationMethodId: d.authConfig.authMethod.key,
        data: decrypted.output ?? decrypted.input ?? {}
      };
    }
  };
});
vi.mock('../../services/secret', () => ({
  secretService: {
    DANGEROUSLY_decryptSecret: decrypt,
    createSecret: vi.fn(async () => ({ oid: 8n })),
    DANGEROUSLY_deleteSecret: vi.fn()
  }
}));
vi.mock('../../services/slateInvocation', () => ({ slateInvocationService: invocation }));
vi.mock('../../services/slateWebhookRegistration', () => ({
  generateWebhookRegistrationUrlKey: () => 'url-key'
}));
vi.mock('../../internal/triggerWebhookRegistrationServiceInternal', () => ({
  triggerWebhookRegistrationServiceInternal: { createWebhookRegistration: createRegistration }
}));
vi.mock('./_instanceError', () => ({ createTriggerRegistrationInstanceError: instanceError }));
let registration: any;
let target: any;
let instance: any;
let discovered: any;
let activeLink: any;
let run = (name: string, data: any = {}, attemptsMade = 0) =>
  queues.get(`shub/trg/${name}/1`).handler(data, { attemptsMade });
let HOUR = 60 * 60 * 1000;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  queues.clear();
  nextSnowflake.mockReturnValue(10n);
  locks.held.length = 0;
  locks.taken.length = 0;
  db.$queryRaw = vi.fn();
  db.triggerWebhookRenewalResult.upsert.mockImplementation(async ({ create }: any) => create);
  db.slateWebhookRegistration.create.mockResolvedValue({ oid: 7n, secretOid: 8n });
  db.$transaction.mockImplementation(async (operations: any) =>
    typeof operations === 'function' ? operations(db) : Promise.all(operations)
  );
  registration = {
    id: 'connection',
    oid: 2n,
    status: 'active',
    tenantOid: 1n,
    tenant: { oid: 1n },
    slate: {},
    instance: { id: 'provider-instance' },
    instanceConfig: { value: { setting: true } },
    authConfig: { secretOid: 4n, authMethod: { key: 'token' } }
  };
  instance = {
    id: 'subscription',
    oid: 3n,
    triggerRegistrationOid: 2n,
    triggerRegistration: registration,
    triggerGroup: {
      oid: 5n,
      key: 'events',
      spec: { invocation: { type: 'webhook', registration: { mode: 'auto' } } }
    }
  };
  target = {
    id: 'target',
    oid: 6n,
    status: 'deleting',
    unregistrationStarted: false,
    tenantOid: 1n,
    tenant: { oid: 1n },
    triggerGroupOid: 5n,
    triggerGroup: {
      key: 'events',
      slate: {},
      spec: { invocation: { type: 'webhook', registration: { mode: 'auto' } } }
    },
    name: 'target',
    description: null,
    metadata: {},
    webhookTargetPayload: {},
    updatedAt: new Date(),
    webhookRegistrationOid: 7n,
    webhookRegistration: { oid: 7n, secretOid: 8n, registrationIdentifier: '' },
    registeredByTriggerRegistration: { id: 'connection' },
    webhooks: [{ triggerRegistrationInstance: instance }]
  };
  discovered = {
    webhookTargetIdentifier: 'stable',
    targetOwnership: 'multi_user',
    name: 'target',
    metadata: {},
    webhookTargetPayload: {}
  };
  activeLink = { triggerRegistrationInstance: { id: instance.id } };
  db.triggerRegistrationInstance.findUnique.mockResolvedValue(instance);
  db.triggerRegistration.findUnique.mockResolvedValue(registration);
  db.triggerRegistration.findFirst.mockResolvedValue(registration);
  db.triggerRegistration.findMany.mockResolvedValue([{ id: registration.id }]);
  db.triggerWebhookTarget.updateMany.mockImplementation(async ({ data }: any) => {
    Object.assign(target, data);
    return { count: 1 };
  });
  db.triggerWebhookTarget.count.mockResolvedValue(1);
  db.triggerDeliveryRoute.findMany.mockResolvedValue([]);
  db.triggerDeliveryRoute.count.mockResolvedValue(0);
  db.triggerWebhookTarget.findUnique.mockResolvedValue(target);
  db.triggerWebhookTarget.findUniqueOrThrow.mockResolvedValue(target);
  db.triggerWebhookTarget.findFirstOrThrow.mockResolvedValue(target);
  db.triggerWebhookTarget.update.mockImplementation(async ({ data }: any) => ({
    ...target,
    ...data
  }));
  db.triggerWebhookTargetRegistrationAttempt.create.mockResolvedValue({ oid: 11n });
  db.triggerWebhookTarget.create.mockRejectedValue({ code: 'P2002' });
  db.triggerRegistrationWebhook.findMany.mockResolvedValue([]);
  decrypt.mockImplementation(async ({ purpose }: any) =>
    purpose === 'slate_authentication_configuration'
      ? { output: { token: 'credential' } }
      : { payload: { hook: 42 } }
  );
  invocation.createInvocationWithState.mockResolvedValue({ id: 'stack' });
  invocation.unregisterWebhook.mockResolvedValue({
    status: 'success',
    invocation: { oid: 9n }
  });
  invocation.registerWebhook.mockResolvedValue({
    status: 'success',
    invocation: { oid: 9n },
    data: { webhookRegistrationPayload: { hook: 42 }, webhookRegistrationIdentifier: '42' }
  });
  createRegistration.mockResolvedValue({ oid: 7n, secretOid: 8n });
  await import('./webhookRediscover');
  await import('./webhookUnregister');
  await import('./webhookTargetSweep');
});

describe('automatic webhook lifecycle', () => {
  it('continues discovery through an empty permission-filtered page', async () => {
    invocation.listWebhookTargets.mockResolvedValue({
      status: 'success',
      data: { targets: [], nextPageToken: 2 }
    });
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    expect(queues.get('shub/trg/whk/search/1').add).toHaveBeenCalledWith(
      expect.objectContaining({ triggerRegistrationInstanceId: instance.id, pageToken: 2 }),
      expect.anything()
    );
    expect(invocation.createInvocationWithState).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { authenticationMethodId: 'token', data: { token: 'credential' } },
        config: { setting: true }
      })
    );
  });
  it('stops queued discovery after callback removal and excludes non-auto groups', async () => {
    registration.status = 'deleted';
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    registration.status = 'active';
    instance.triggerGroup.spec.invocation = { type: 'polling' };
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    expect(invocation.listWebhookTargets).not.toHaveBeenCalled();
  });
  it('rescans active automatic subscriptions in bounded pages', async () => {
    db.triggerRegistrationInstance.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({ id: `subscription-${i}` }))
    );
    await run('whk/rediscover');
    expect(db.triggerRegistrationInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: expect.objectContaining({ triggerRegistration: { status: 'active' } })
      })
    );
    expect(queues.get('shub/trg/whk/search/1').addManyWithOps.mock.calls[0][0]).toHaveLength(
      100
    );
    expect(queues.get('shub/trg/whk/rediscover/1').add).toHaveBeenCalledWith({
      cursor: 'subscription-99'
    });
  });
  it('unregisters with saved connection auth and config after links are removed', async () => {
    registration.status = 'deleted';
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(invocation.createInvocationWithState).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { authenticationMethodId: 'token', data: { token: 'credential' } },
        config: { setting: true },
        session: { id: target.id, state: {} }
      })
    );
    expect(invocation.unregisterWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookRegistrationIdentifier: '',
        webhookRegistrationPayload: { hook: 42 }
      })
    );
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ oid: target.oid }),
      data: expect.objectContaining({ status: 'deleted' })
    });
    expect(db.triggerRegistration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'connection',
          tenantOid: 1n,
          instances: { some: { triggerGroupOid: 5n } }
        }
      })
    );
  });
  it('retries cleanup with the final connection after a private repository access 404', async () => {
    invocation.unregisterWebhook.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: 9n },
      error: { code: 'github_webhook_repository_unavailable', message: '404 Not Found' }
    });
    let data = { triggerWebhookTargetId: target.id, triggerRegistrationId: 'last-writer' };
    await expect(run('whk/unregister', data, 0)).rejects.toThrow();
    expect(db.triggerRegistration.findFirst.mock.calls[0][0].where.id).toBe('connection');
    await run('whk/unregister', data, 1);
    expect(db.triggerRegistration.findFirst.mock.calls[1][0].where.id).toBe('last-writer');
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'deleted' }) })
    );
  });
  it('uses the creator credentials when the final disconnected connection is read-only', async () => {
    await run('whk/unregister', {
      triggerWebhookTargetId: target.id,
      triggerRegistrationId: 'last-reader'
    });
    expect(db.triggerRegistration.findFirst.mock.calls[0][0].where.id).toBe('connection');
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'deleted' }) })
    );
  });
  it('keeps failed provider cleanup retryable and records the failure', async () => {
    invocation.unregisterWebhook.mockResolvedValue({
      status: 'error',
      invocation: { oid: 9n },
      error: { code: 'permission', message: 'Access denied' }
    });
    await expect(
      run('whk/unregister', { triggerWebhookTargetId: target.id })
    ).rejects.toThrow();
    expect(db.triggerWebhookTargetRegistrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    );
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'deleting', unregistrationStarted: true } })
    );
    expect(db.slateWebhookRegistration.update).not.toHaveBeenCalled();
  });
  it('does not delete a hook still used by another active connection', async () => {
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([activeLink]);
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active' } })
    );
  });
  it('re-registers a hookless target once per active connection', async () => {
    target.webhookRegistrationOid = null;
    target.webhookRegistration = null;
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([
      activeLink,
      { triggerRegistrationInstance: { id: 'other' } }
    ]);
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(queues.get('shub/trg/whk/register/1').addManyWithOps).toHaveBeenCalledWith([
      {
        data: {
          triggerWebhookTargetId: target.id,
          triggerRegistrationInstanceId: instance.id
        },
        opts: { id: `${target.id}:${instance.id}` }
      },
      {
        data: { triggerWebhookTargetId: target.id, triggerRegistrationInstanceId: 'other' },
        opts: { id: `${target.id}:other` }
      }
    ]);
  });
  it('prefers active connections when rotating cleanup credentials', async () => {
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(db.triggerRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]
      })
    );
  });
  it('makes repeated cleanup a no-op and refuses missing cleanup credentials', async () => {
    target.status = 'deleted';
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(decrypt).not.toHaveBeenCalled();
    target.status = 'deleting';
    db.triggerRegistration.findFirst.mockResolvedValue(null);
    await expect(
      run('whk/unregister', { triggerWebhookTargetId: target.id })
    ).rejects.toThrow();
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
  });
  it('records which connection created the hook on the target', async () => {
    target.status = 'creating';
    await run('whk/register', { triggerWebhookTargetId: target.id });
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'active',
          registeredByTriggerRegistrationOid: registration.oid
        })
      })
    );
  });
  it('skips the lock and writes for an unchanged, already linked active target', async () => {
    target.status = 'active';
    db.triggerRegistrationWebhook.findUnique.mockResolvedValue({ webhookRegistrationOid: 7n });
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(db.triggerWebhookTarget.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.upsert).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/register/1').add).not.toHaveBeenCalled();
  });
  it('links rediscovered subscriptions to the existing shared registration', async () => {
    target.status = 'active';
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(db.triggerRegistrationWebhook.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ lastDiscoveredAt: expect.any(Date) }),
        update: { webhookRegistrationOid: 7n, lastDiscoveredAt: expect.any(Date) }
      })
    );
    expect(db.triggerWebhookTarget.update).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/register/1').add).not.toHaveBeenCalled();
  });
  it('ignores jsonb key reordering when comparing the stored identity', async () => {
    target.status = 'failed';
    target.metadata = { repo: 'r', owner: 'o', instanceUrl: 'https://x', repositoryId: 1 };
    target.webhookTargetPayload = { ...target.metadata };
    db.triggerRegistrationWebhook.findUnique.mockResolvedValue({ oid: 10n });
    let reordered = { instanceUrl: 'https://x', repositoryId: 1, owner: 'o', repo: 'r' };
    await run('whk/link', {
      triggerRegistrationInstanceId: instance.id,
      target: { ...discovered, metadata: reordered, webhookTargetPayload: reordered }
    });
    expect(db.triggerWebhookTarget.update).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/register/1').add).not.toHaveBeenCalled();
  });
  it('restores a target that was being deleted when a connection links it again', async () => {
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(db.triggerWebhookTarget.update).toHaveBeenCalledWith({
      where: { oid: target.oid },
      data: { status: 'active' }
    });
    expect(queues.get('shub/trg/whk/register/1').add).not.toHaveBeenCalled();
  });
  it('refreshes the stored identity of an active target without re-registering', async () => {
    target.status = 'active';
    await run('whk/link', {
      triggerRegistrationInstanceId: instance.id,
      target: { ...discovered, name: 'owner/renamed', webhookTargetPayload: { revision: 2 } }
    });
    expect(db.triggerWebhookTarget.update).toHaveBeenCalledWith({
      where: { oid: target.oid },
      data: {
        name: 'owner/renamed',
        description: null,
        metadata: {},
        webhookTargetPayload: { revision: 2 }
      }
    });
    expect(queues.get('shub/trg/whk/register/1').add).not.toHaveBeenCalled();
  });
  it.each(['deleted', 'failed'])('retries a %s target on later discovery', async status => {
    target.status = status;
    await run('whk/link', {
      triggerRegistrationInstanceId: instance.id,
      target: { ...discovered, name: 'renamed', webhookTargetPayload: { revision: 2 } }
    });
    expect(db.triggerWebhookTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'creating',
          webhookRegistrationOid: null,
          name: 'renamed',
          webhookTargetPayload: { revision: 2 }
        })
      })
    );
    expect(queues.get('shub/trg/whk/register/1').add).toHaveBeenCalled();
  });
  it('does not retry an unchanged failed target before the cool-down passes', async () => {
    target.status = 'failed';
    db.triggerRegistrationWebhook.findUnique.mockResolvedValue({ oid: 10n });
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(db.triggerWebhookTarget.update).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.upsert).toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/register/1').add).not.toHaveBeenCalled();
  });
  it.each([
    [
      'a new connection links it',
      () => db.triggerRegistrationWebhook.findUnique.mockResolvedValue(null)
    ],
    ['the cool-down passed', () => (target.updatedAt = new Date(Date.now() - 7 * HOUR))]
  ])('retries an unchanged failed target when %s', async (_name, arrange) => {
    target.status = 'failed';
    db.triggerRegistrationWebhook.findUnique.mockResolvedValue({ oid: 10n });
    arrange();
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(db.triggerWebhookTarget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'creating', webhookRegistrationOid: null })
      })
    );
    expect(queues.get('shub/trg/whk/register/1').add).toHaveBeenCalled();
  });
  it('cleans up a link if its callback is deleted during linking', async () => {
    db.triggerRegistration.findUnique
      .mockResolvedValueOnce(registration)
      .mockResolvedValueOnce({ ...registration, status: 'deleted' });
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(queues.get('shub/trg/cleanup/1').add).toHaveBeenCalledWith(
      { triggerRegistrationId: registration.id },
      { id: registration.id }
    );
  });
  it('treats an empty string page token as the end of discovery', async () => {
    invocation.listWebhookTargets.mockResolvedValue({
      status: 'success',
      data: { targets: [], nextPageToken: '' }
    });
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    expect(queues.get('shub/trg/whk/search/1').add).not.toHaveBeenCalled();
  });
});

describe('unregister terminal state', () => {
  it('removes the target locally on the last attempt when provider cleanup keeps failing', async () => {
    invocation.unregisterWebhook.mockResolvedValue({
      status: 'error',
      invocation: { oid: 9n },
      error: { code: 'permission', message: 'Access denied' }
    });
    target.webhookRegistration.urlKey = 'registered-key';
    await run('whk/unregister', { triggerWebhookTargetId: target.id }, 9);
    expect(db.triggerWebhookTargetRegistrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) })
    );
    // The hook is still at the provider, so its URL is kept for the next registration and
    // the deleted record gives it up.
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'deleted',
          registrationUrlKey: 'registered-key'
        })
      })
    );
    expect(db.slateWebhookRegistration.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: { status: 'deleted', urlKey: 'url-key' }
    });
  });
  it('releases the receive URL when the provider hook was removed', async () => {
    target.webhookRegistration.urlKey = 'registered-key';
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'deleted', registrationUrlKey: null })
      })
    );
    expect(db.slateWebhookRegistration.update).toHaveBeenCalledWith({
      where: { oid: 7n },
      data: { status: 'deleted' }
    });
  });
  it('falls back to any connection of the trigger group when the creator is unknown', async () => {
    target.registeredByTriggerRegistration = null;
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(db.triggerRegistration.findFirst).toHaveBeenCalledTimes(1);
    expect(db.triggerRegistration.findFirst.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: {
          id: registration.id,
          tenantOid: 1n,
          instances: { some: { triggerGroupOid: 5n } }
        }
      })
    );
    expect(invocation.unregisterWebhook).toHaveBeenCalled();
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'deleted' }) })
    );
  });
  it('deletes the target locally on the last attempt when no cleanup credentials exist', async () => {
    db.triggerRegistration.findFirst.mockResolvedValue(null);
    target.webhookRegistration.urlKey = 'registered-key';
    await run('whk/unregister', { triggerWebhookTargetId: target.id }, 9);
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'deleted',
          registrationUrlKey: 'registered-key'
        })
      })
    );
  });
});

describe('hourly sweep', () => {
  beforeEach(() => {
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([]);
    db.triggerWebhookTarget.findMany.mockResolvedValue([]);
  });
  it('re-queues stuck targets', async () => {
    db.triggerWebhookTarget.findMany.mockResolvedValueOnce([{ id: 'stuck' }]);
    await run('whk/sweep');
    expect(db.triggerWebhookTarget.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        updatedAt: { lt: expect.any(Date) },
        OR: [
          { status: { in: ['creating', 'deleting'] } },
          expect.objectContaining({ status: { in: ['active', 'failed'] } })
        ]
      })
    );
    expect(queues.get('shub/trg/whk/unregister/1').addManyWithOps).toHaveBeenCalledWith([
      { data: { triggerWebhookTargetId: 'stuck' }, opts: { id: 'stuck' } }
    ]);
  });
  it('does nothing when there is nothing to prune or retry', async () => {
    await run('whk/sweep');
    expect(db.triggerRegistrationWebhook.deleteMany).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/unregister/1').addManyWithOps).not.toHaveBeenCalled();
  });
});

describe('cleanup queue durability', () => {
  it('handles registration completing while cleanup was queued', async () => {
    target.status = 'active';
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(invocation.unregisterWebhook).toHaveBeenCalled();
  });
  it('enqueues cleanup with connection context before removing links', async () => {
    registration.status = 'deleted';
    db.triggerRegistrationInstance.findMany.mockResolvedValue([{ oid: instance.oid }]);
    db.triggerRegistrationWebhook.findMany
      .mockResolvedValueOnce([{ triggerWebhookTargetOid: target.oid }])
      .mockResolvedValueOnce([]);
    db.triggerWebhookTarget.findMany.mockResolvedValue([target]);
    await run('cleanup', { triggerRegistrationId: registration.id });
    let add = queues.get('shub/trg/whk/unregister/1').addManyWithOps;
    expect(add).toHaveBeenCalledWith([
      {
        data: { triggerWebhookTargetId: target.id, triggerRegistrationId: registration.id },
        opts: { id: target.id }
      }
    ]);
    expect(add.mock.invocationCallOrder[0]).toBeLessThan(
      db.triggerRegistrationWebhook.deleteMany.mock.invocationCallOrder[0]
    );
  });
  it('skips the unregister queue when nothing is orphaned', async () => {
    registration.status = 'deleted';
    db.triggerRegistrationInstance.findMany.mockResolvedValue([{ oid: instance.oid }]);
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([]);
    await run('cleanup', { triggerRegistrationId: registration.id });
    expect(db.triggerWebhookTarget.updateMany).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/unregister/1').addManyWithOps).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.deleteMany).toHaveBeenCalled();
  });
  it('keeps links when scheduling provider cleanup fails', async () => {
    registration.status = 'deleted';
    db.triggerRegistrationInstance.findMany.mockResolvedValue([{ oid: instance.oid }]);
    db.triggerRegistrationWebhook.findMany
      .mockResolvedValueOnce([{ triggerWebhookTargetOid: target.oid }])
      .mockResolvedValueOnce([]);
    db.triggerWebhookTarget.findMany.mockResolvedValue([target]);
    queues
      .get('shub/trg/whk/unregister/1')
      .addManyWithOps.mockRejectedValueOnce(new Error('Queue unavailable'));
    await expect(run('cleanup', { triggerRegistrationId: registration.id })).rejects.toThrow(
      'Queue unavailable'
    );
    expect(db.triggerRegistrationWebhook.deleteMany).not.toHaveBeenCalled();
  });
});

describe('shared targets with mixed webhook permissions', () => {
  it('lets a writer register after another connection has failed', async () => {
    target.status = 'creating';
    invocation.registerWebhook.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: 9n },
      error: { code: 'permission', message: 'Write permission required' }
    });
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([]);
    await run(
      'whk/register',
      { triggerWebhookTargetId: target.id, triggerRegistrationInstanceId: 'reader' },
      4
    );
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { renewalOperationId: null, status: 'failed' } })
    );
    target.status = 'failed';
    target.webhooks = [
      {
        triggerRegistrationInstance: {
          ...instance,
          id: 'writer',
          triggerRegistration: { ...registration, id: 'writer-connection', oid: 12n }
        }
      }
    ];
    await run('whk/register', {
      triggerWebhookTargetId: target.id,
      triggerRegistrationInstanceId: 'writer'
    });
    expect(db.triggerWebhookTarget.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          webhooks: expect.objectContaining({
            where: {
              triggerRegistrationInstance: {
                id: 'writer',
                triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
              }
            }
          })
        })
      })
    );
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registeredByTriggerRegistrationOid: 12n })
      })
    );
  });
  it('blames only the connection whose credentials failed', async () => {
    target.status = 'creating';
    invocation.registerWebhook.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: 9n },
      error: { code: 'permission', message: 'Write permission required' }
    });
    await run('whk/register', { triggerWebhookTargetId: target.id }, 4);
    expect(instanceError).toHaveBeenCalledTimes(1);
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerRegistrationInstanceOid: instance.oid,
        code: 'webhook_registration_failed'
      })
    );
    expect(db.triggerRegistrationWebhook.findMany).not.toHaveBeenCalled();
  });
  it('falls back to another active connection when the requested one is gone', async () => {
    target.status = 'creating';
    db.triggerWebhookTarget.findUnique
      .mockResolvedValueOnce({ ...target, webhooks: [] })
      .mockResolvedValueOnce(target);
    await run('whk/register', {
      triggerWebhookTargetId: target.id,
      triggerRegistrationInstanceId: 'disconnected'
    });
    expect(db.triggerWebhookTarget.findUnique).toHaveBeenCalledTimes(2);
    expect(
      db.triggerWebhookTarget.findUnique.mock.calls[1][0].include.webhooks.where
        .triggerRegistrationInstance.id
    ).toBeUndefined();
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registeredByTriggerRegistrationOid: registration.oid })
      })
    );
  });
  it('queues separate credential candidates for the same discovered target', async () => {
    target.status = 'creating';
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    instance.id = 'another-connection';
    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    let calls = queues.get('shub/trg/whk/register/1').add.mock.calls;
    expect(calls[0][0].triggerRegistrationInstanceId).toBe('subscription');
    expect(calls[1][0].triggerRegistrationInstanceId).toBe('another-connection');
    expect(calls[0][1].id).not.toBe(calls[1][1].id);
  });
});

describe('cleanup recovery', () => {
  it('replaces a deleted provider hook after persisting its deletion failed', async () => {
    let providerHookExists = true;
    invocation.unregisterWebhook.mockImplementation(async () => {
      providerHookExists = false;
      return { status: 'success', invocation: { oid: 9n } };
    });
    invocation.registerWebhook.mockImplementation(async () => {
      providerHookExists = true;
      return {
        status: 'success',
        invocation: { oid: 9n },
        data: { webhookRegistrationPayload: { hook: 43 }, webhookRegistrationIdentifier: '43' }
      };
    });
    db.triggerWebhookTarget.update.mockImplementation(async ({ data }: any) => {
      Object.assign(target, data);
      return { ...target };
    });
    db.triggerWebhookTargetRegistrationAttempt.create.mockRejectedValueOnce(
      new Error('Database write failed after provider deletion')
    );

    await expect(
      run('whk/unregister', { triggerWebhookTargetId: target.id })
    ).rejects.toThrow();
    expect(providerHookExists).toBe(false);
    expect(target.unregistrationStarted).toBe(true);

    await run('whk/link', { triggerRegistrationInstanceId: instance.id, target: discovered });
    expect(target.status).toBe('deleting');
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([activeLink]);
    await run('whk/unregister', { triggerWebhookTargetId: target.id }, 1);
    expect(target.status).toBe('creating');
    expect(target.webhookRegistrationOid).toBeNull();
    for (let [jobs] of queues.get('shub/trg/whk/register/1').addManyWithOps.mock.calls) {
      for (let { data } of jobs) await run('whk/register', data);
    }
    expect(target.status).toBe('active');
    expect(providerHookExists).toBe(true);
  });

  it('uses another connection when a sweep cannot use the creator credentials', async () => {
    let writer = {
      ...registration,
      id: 'other-writer',
      authConfig: { ...registration.authConfig, secretOid: 14n }
    };
    db.triggerRegistration.findMany.mockResolvedValue([
      { id: writer.id },
      { id: registration.id }
    ]);
    db.triggerRegistration.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === writer.id ? writer : registration
    );
    decrypt.mockImplementation(async ({ purpose, secretOid }: any) =>
      purpose === 'slate_authentication_configuration'
        ? { output: { token: secretOid === 14n ? 'working' : 'revoked' } }
        : { payload: { hook: 42 } }
    );
    invocation.createInvocationWithState.mockImplementation(async (input: any) => input);
    invocation.unregisterWebhook.mockImplementation(async ({ stack }: any) =>
      stack.auth.data.token === 'working'
        ? { status: 'success', invocation: { oid: 9n } }
        : {
            status: 'error',
            invocation: { oid: 9n },
            error: { code: 'unauthorized', message: 'Revoked' }
          }
    );

    await expect(
      run('whk/unregister', { triggerWebhookTargetId: target.id })
    ).rejects.toThrow();
    await run('whk/unregister', { triggerWebhookTargetId: target.id }, 1);
    expect(invocation.unregisterWebhook).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stack: expect.objectContaining({
          auth: { authenticationMethodId: 'token', data: { token: 'working' } }
        })
      })
    );
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'deleted' }) })
    );
  });
});

describe('complete discovery pruning', () => {
  let links: any[];
  let matches = (record: any, where: any): boolean =>
    Object.entries(where).every(([key, condition]: any) => {
      if (condition === undefined) return true;
      if (key === 'OR') return condition.some((part: any) => matches(record, part));
      let value = record?.[key];
      if (condition && typeof condition === 'object') {
        if ('lt' in condition) return value != null && value < condition.lt;
        if ('gt' in condition) return value != null && value > condition.gt;
        if ('not' in condition) return value !== condition.not;
        if ('in' in condition) return condition.in.includes(value);
        return matches(value, condition);
      }
      return value === condition;
    });
  beforeEach(() => {
    links = [
      {
        oid: 101n,
        triggerRegistrationInstanceOid: instance.oid,
        triggerWebhookTargetOid: target.oid,
        triggerWebhookTarget: { targetIdentifier: discovered.webhookTargetIdentifier },
        lastDiscoveredAt: new Date(Date.now() - 25 * HOUR),
        createdAt: new Date(Date.now() - 25 * HOUR)
      }
    ];
    db.triggerRegistrationWebhook.findMany.mockImplementation(async ({ where, take }: any) =>
      links.filter(link => matches(link, where)).slice(0, take ?? links.length)
    );
    db.triggerRegistrationWebhook.updateMany.mockImplementation(
      async ({ where, data }: any) => {
        for (let link of links.filter(link => matches(link, where))) Object.assign(link, data);
      }
    );
    db.triggerRegistrationWebhook.deleteMany.mockImplementation(async ({ where }: any) => {
      links = links.filter(link => !matches(link, where));
    });
    db.triggerWebhookTarget.findMany.mockResolvedValue([]);
  });
  let finishPruning = async () => {
    for (let [data] of queues.get('shub/trg/whk/prune/1').add.mock.calls)
      await run('whk/prune', data);
  };

  it('prunes an absent target after an empty complete scan', async () => {
    invocation.listWebhookTargets.mockResolvedValue({
      status: 'success',
      data: { targets: [], nextPageToken: null }
    });
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    await finishPruning();
    expect(links).toHaveLength(0);
  });

  it('refreshes discovered links before independent link jobs or pruning can run', async () => {
    invocation.listWebhookTargets.mockResolvedValue({
      status: 'success',
      data: { targets: [discovered], nextPageToken: null }
    });
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    await finishPruning();
    expect(links).toHaveLength(1);
    expect(links[0].lastDiscoveredAt.getTime()).toBeGreaterThan(Date.now() - HOUR);
  });

  it.each(['failed', 'partial'])(
    'keeps absent links after a %s discovery page',
    async outcome => {
      invocation.listWebhookTargets.mockResolvedValue(
        outcome === 'failed'
          ? { status: 'error', error: { message: 'Rate limited' } }
          : { status: 'success', data: { targets: [], nextPageToken: null, isPartial: true } }
      );
      await run('whk/search', { triggerRegistrationInstanceId: instance.id, pageToken: 2 });
      await finishPruning();
      expect(links).toHaveLength(1);
      expect(queues.get('shub/trg/whk/prune/1').add).not.toHaveBeenCalled();
    }
  );

  it('remembers partial earlier pages when the last page succeeds', async () => {
    invocation.listWebhookTargets.mockResolvedValueOnce({
      status: 'success',
      data: { targets: [], nextPageToken: 2, isPartial: true }
    });
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    let continuation = queues.get('shub/trg/whk/search/1').add.mock.calls[0][0];
    invocation.listWebhookTargets.mockResolvedValueOnce({
      status: 'success',
      data: { targets: [], nextPageToken: null }
    });
    await run('whk/search', continuation);
    await finishPruning();
    expect(links).toHaveLength(1);
    expect(queues.get('shub/trg/whk/prune/1').add).not.toHaveBeenCalled();
  });

  it('keeps a link absent from this scan until it has been unseen for the grace period', async () => {
    links[0].lastDiscoveredAt = new Date(Date.now() - HOUR);
    invocation.listWebhookTargets.mockResolvedValue({
      status: 'success',
      data: { targets: [], nextPageToken: null }
    });
    await run('whk/search', { triggerRegistrationInstanceId: instance.id });
    await finishPruning();
    expect(links).toHaveLength(1);
  });
});

describe('durable provider lifecycle claims', () => {
  it('does not invoke provider cleanup while a registration or renewal can still finish', async () => {
    db.triggerWebhookTarget.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      run('whk/unregister', { triggerWebhookTargetId: target.id })
    ).rejects.toThrow();
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
  });

  it('does not start a provider call the claim cannot outlast', async () => {
    target.status = 'creating';
    db.triggerWebhookTarget.count.mockResolvedValue(0);
    await expect(run('whk/register', { triggerWebhookTargetId: target.id })).rejects.toThrow();
    expect(invocation.registerWebhook).not.toHaveBeenCalled();
    expect(
      db.triggerWebhookTarget.count.mock.calls[0][0].where.renewalClaimUntil.gt.getTime()
    ).toBeGreaterThan(Date.now() + 15 * 60 * 1000);
  });

  it('retries a failed registration under a new operation identity', async () => {
    target.status = 'creating';
    target.renewalOperationId = null;
    for (let id of [1n, 2n, 3n, 4n]) nextSnowflake.mockReturnValueOnce(id);
    invocation.registerWebhook.mockResolvedValueOnce({
      status: 'error',
      invocation: { oid: 9n },
      error: { code: 'unavailable', message: 'Service unavailable' }
    });
    await expect(run('whk/register', { triggerWebhookTargetId: target.id })).rejects.toThrow();
    expect(invocation.registerWebhook.mock.calls[0][0].operationId).toBe('register:1');
    expect(target.renewalOperationId).toBeNull();
    expect(target.status).toBe('creating');
    expect(instanceError).not.toHaveBeenCalled();

    await run('whk/register', { triggerWebhookTargetId: target.id }, 1);
    expect(invocation.registerWebhook.mock.calls[1][0].operationId).toBe('register:3');
    expect(db.slateWebhookRegistration.create).toHaveBeenCalled();
  });

  it('ends in the failed state when the last attempt throws before a result is saved', async () => {
    target.status = 'creating';
    invocation.createInvocationWithState.mockRejectedValue(new Error('stack unavailable'));

    await expect(
      run('whk/register', { triggerWebhookTargetId: target.id }, 3)
    ).rejects.toThrow('stack unavailable');
    expect(target.status).toBe('creating');
    expect(instanceError).not.toHaveBeenCalled();

    await expect(
      run('whk/register', { triggerWebhookTargetId: target.id }, 4)
    ).rejects.toThrow('stack unavailable');
    expect(target.status).toBe('failed');
    expect(target.renewalOperationId).toBeNull();
    expect(instanceError).toHaveBeenCalledTimes(1);
    expect(instanceError).toHaveBeenCalledWith({
      triggerRegistrationInstanceOid: instance.oid,
      triggerWebhookTargetOid: target.oid,
      registrationAttemptOid: undefined,
      code: 'webhook_registration_failed',
      message: expect.stringContaining('after 5 attempts')
    });
    expect(instanceError.mock.calls[0]![0].message).not.toContain('stack unavailable');
    expect(invocation.registerWebhook).not.toHaveBeenCalled();
  });

  it('leaves a saved provider result to the cleanup queue when the last attempt cannot commit', async () => {
    target.status = 'creating';
    target.renewalOperationId = null;
    db.$transaction.mockRejectedValue(new Error('database unavailable'));

    await expect(
      run('whk/register', { triggerWebhookTargetId: target.id }, 4)
    ).rejects.toThrow('database unavailable');

    expect(db.triggerWebhookRenewalResult.upsert).toHaveBeenCalled();
    expect(target.status).toBe('creating');
    expect(target.renewalOperationId).toBe('register:10');
    expect(instanceError).not.toHaveBeenCalled();
  });

  it('reports a last attempt that could not start while an earlier one holds the target', async () => {
    target.status = 'creating';
    db.triggerWebhookTarget.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      run('whk/register', { triggerWebhookTargetId: target.id }, 3)
    ).rejects.toThrow();
    expect(instanceError).not.toHaveBeenCalled();

    await expect(
      run('whk/register', { triggerWebhookTargetId: target.id }, 4)
    ).rejects.toThrow();
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerRegistrationInstanceOid: instance.oid,
        triggerWebhookTargetOid: target.oid,
        code: 'webhook_registration_failed'
      })
    );
    expect(target.status).toBe('creating');
    expect(invocation.registerWebhook).not.toHaveBeenCalled();
  });

  it('resumes a saved provider result without touching infrastructure or its operation identity', async () => {
    target.status = 'creating';
    target.registrationUrlKey = 'saved-key';
    target.renewalOperationId = 'saved-operation';
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    vi.mocked(getTriggerInfrastructure).mockRejectedValue(new Error('unavailable'));
    db.triggerWebhookRenewalResult.findUnique.mockResolvedValue({
      operationId: 'saved-operation',
      secretOid: 8n,
      invocationOid: 9n,
      registrationIdentifier: 'saved-hook',
      nextRenewalAt: null,
      expiresAt: null,
      renewAfter: null,
      deliveryBindingId: 'binding',
      routingKeys: ['mailbox-a']
    });
    await run('whk/register', { triggerWebhookTargetId: target.id }, 1);
    expect(getTriggerInfrastructure).not.toHaveBeenCalled();
    expect(invocation.registerWebhook).not.toHaveBeenCalled();
    expect(db.triggerDeliveryRoute.createMany).toHaveBeenCalledWith({
      data: [
        { oid: 10n, bindingId: 'binding', routingKey: 'mailbox-a', webhookRegistrationOid: 7n }
      ],
      skipDuplicates: true
    });
    expect(db.triggerWebhookRenewalResult.delete).toHaveBeenCalledWith({
      where: { operationId: 'saved-operation' }
    });
  });

  it('looks up the delivery config for the tenant, integration, trigger group and OAuth app', async () => {
    target.status = 'creating';
    registration.authConfig.oauthCredentials = { clientId: 'client-id' };
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    await run('whk/register', { triggerWebhookTargetId: target.id });
    expect(getTriggerInfrastructure).toHaveBeenCalledWith({
      tenant: registration.tenant,
      slate: registration.slate,
      triggerGroup: target.triggerGroup,
      oauthClientId: 'client-id'
    });
  });

  it('records a missing delivery config under its own code and message', async () => {
    target.status = 'creating';
    let { badRequestError, ServiceError } = await import('@lowerdeck/error');
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    vi.mocked(getTriggerInfrastructure).mockRejectedValue(
      new ServiceError(
        badRequestError({
          code: 'trigger_delivery_config_missing',
          message: 'Delivery is not set up.'
        })
      )
    );
    await expect(
      run('whk/register', { triggerWebhookTargetId: target.id }, 4)
    ).rejects.toThrow();
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'trigger_delivery_config_missing',
        message: 'Delivery is not set up.',
        triggerRegistrationInstanceOid: instance.oid
      })
    );
    expect(target.status).toBe('failed');
    expect(invocation.registerWebhook).not.toHaveBeenCalled();
  });
});

describe('shared delivery routes', () => {
  let delivery = { bindingId: 'binding', infrastructure: { opaque: true } };

  it('stores the routing keys of a managed-delivery registration with the registration', async () => {
    target.status = 'creating';
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    vi.mocked(getTriggerInfrastructure).mockResolvedValue(delivery as any);
    invocation.registerWebhook.mockResolvedValue({
      status: 'success',
      invocation: { oid: 9n },
      data: {
        webhookRegistrationPayload: { hook: 42 },
        webhookRegistrationIdentifier: '42',
        routingKeys: ['mailbox-a']
      }
    });
    await run('whk/register', { triggerWebhookTargetId: target.id });
    expect(invocation.registerWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ infrastructure: delivery.infrastructure })
    );
    expect(db.triggerDeliveryRoute.createMany).toHaveBeenCalledWith({
      data: [
        { oid: 10n, bindingId: 'binding', routingKey: 'mailbox-a', webhookRegistrationOid: 7n }
      ],
      skipDuplicates: true
    });
  });

  it('fails a managed-delivery registration that names no routing key', async () => {
    target.status = 'creating';
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    vi.mocked(getTriggerInfrastructure).mockResolvedValue(delivery as any);
    await run('whk/register', { triggerWebhookTargetId: target.id }, 4);
    expect(db.slateWebhookRegistration.create).not.toHaveBeenCalled();
    expect(db.triggerWebhookTargetRegistrationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'webhook_routing_keys_missing' })
      })
    );
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'webhook_registration_failed' })
    );
  });

  it('leaves the provider resource in place while another registration receives the same key', async () => {
    db.triggerDeliveryRoute.findMany.mockResolvedValue([
      { bindingId: 'binding', routingKey: 'mailbox-a' }
    ]);
    db.triggerDeliveryRoute.count.mockResolvedValue(1);
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.triggerDeliveryRoute.count.mock.calls[0][0].where).toEqual({
      OR: [{ bindingId: 'binding', routingKey: 'mailbox-a' }],
      webhookRegistrationOid: { not: 7n },
      webhookRegistration: { status: 'active', triggerWebhookTarget: { status: 'active' } }
    });
    expect(db.triggerDeliveryRoute.deleteMany).toHaveBeenCalledWith({
      where: { webhookRegistrationOid: 7n }
    });
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'deleted' }) })
    );
  });

  it('leaves the provider resource in place for a registration that is not committed yet', async () => {
    db.triggerDeliveryRoute.findMany.mockResolvedValue([
      { bindingId: 'binding', routingKey: 'mailbox-a' }
    ]);
    db.triggerWebhookRenewalResult.count.mockImplementation(async ({ where }: any) =>
      where.OR ? 1 : 0
    );
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.triggerWebhookRenewalResult.count.mock.calls[0][0].where).toEqual({
      OR: [{ deliveryBindingId: 'binding', routingKeys: { has: 'mailbox-a' } }],
      targetOid: { not: target.oid },
      operationId: undefined
    });
  });

  it('removes the provider resource when the last registration for a key is removed', async () => {
    db.triggerDeliveryRoute.findMany.mockResolvedValue([
      { bindingId: 'binding', routingKey: 'mailbox-a' }
    ]);
    await run('whk/unregister', { triggerWebhookTargetId: target.id });
    expect(invocation.unregisterWebhook).toHaveBeenCalled();
    expect(db.triggerDeliveryRoute.deleteMany).toHaveBeenCalledWith({
      where: { webhookRegistrationOid: 7n }
    });
  });

  it('holds a binding shard from the provider call until the result is saved', async () => {
    target.status = 'creating';
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    vi.mocked(getTriggerInfrastructure).mockResolvedValue(delivery as any);
    let heldDuringCall: unknown[] = [];
    let heldDuringSave: unknown[] = [];
    invocation.registerWebhook.mockImplementation(async () => {
      heldDuringCall = [...locks.held];
      return {
        status: 'success',
        invocation: { oid: 9n },
        data: {
          webhookRegistrationPayload: { hook: 42 },
          webhookRegistrationIdentifier: '42',
          routingKeys: ['mailbox-a']
        }
      };
    });
    db.triggerWebhookRenewalResult.upsert.mockImplementation(async ({ create }: any) => {
      heldDuringSave = [...locks.held];
      return create;
    });

    await run('whk/register', { triggerWebhookTargetId: target.id });

    expect(heldDuringCall).toEqual([`binding:${target.oid % 8n}`]);
    expect(heldDuringSave).toEqual(heldDuringCall);
    expect(locks.held).toEqual([]);
    expect(db.slateWebhookRegistration.create).toHaveBeenCalled();
  });

  it('takes no delivery lock for a registration without managed delivery', async () => {
    target.status = 'creating';
    await run('whk/register', { triggerWebhookTargetId: target.id });
    expect(invocation.registerWebhook).toHaveBeenCalled();
    expect(locks.taken).toEqual([]);
  });

  it('holds every binding shard from the shared check through the provider removal', async () => {
    db.triggerDeliveryRoute.findMany.mockResolvedValue([
      { bindingId: 'binding', routingKey: 'mailbox-a' }
    ]);
    let heldDuringCheck: unknown[] = [];
    let heldDuringRemoval: unknown[] = [];
    db.triggerDeliveryRoute.count.mockImplementation(async () => {
      heldDuringCheck = [...locks.held];
      return 0;
    });
    invocation.unregisterWebhook.mockImplementation(async () => {
      heldDuringRemoval = [...locks.held];
      return { status: 'success', invocation: { oid: 9n } };
    });

    await run('whk/unregister', { triggerWebhookTargetId: target.id });

    let allShards = Array.from({ length: 8 }, (_, shard) => `binding:${shard}`);
    expect(heldDuringCheck).toEqual([allShards]);
    expect(heldDuringRemoval).toEqual([allShards]);
    expect(locks.held).toEqual([]);
  });
});

describe('persisted registration results', () => {
  it('resumes a persisted initial registration result without repeating the provider call', async () => {
    target.status = 'creating';
    target.registrationUrlKey = 'saved-key';
    target.renewalOperationId = 'saved-operation';
    db.triggerWebhookRenewalResult.findUnique.mockResolvedValue({
      operationId: 'saved-operation',
      secretOid: 8n,
      invocationOid: 9n,
      registrationIdentifier: 'saved-hook',
      nextRenewalAt: null,
      expiresAt: null,
      renewAfter: null
    });
    await run('whk/register', { triggerWebhookTargetId: target.id });
    expect(invocation.registerWebhook).not.toHaveBeenCalled();
    expect(db.slateWebhookRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          urlKey: 'saved-key',
          secretOid: 8n,
          registrationIdentifier: 'saved-hook'
        })
      })
    );
    expect(db.triggerWebhookRenewalResult.delete).toHaveBeenCalledWith({
      where: { operationId: 'saved-operation' }
    });
  });
});

it('removes the provider hook of a target whose delivery config was removed and records why it cannot register again', async () => {
  // The state the config removal leaves a target in that connections still use.
  target.status = 'deleting';
  target.unregistrationStarted = true;
  db.triggerRegistrationWebhook.findMany.mockResolvedValue([activeLink]);
  db.triggerDeliveryRoute.findMany.mockResolvedValue([
    { bindingId: 'whr_config', routingKey: 'mailbox-a' }
  ]);
  let { badRequestError, ServiceError } = await import('@lowerdeck/error');
  let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
  vi.mocked(getTriggerInfrastructure).mockRejectedValue(
    new ServiceError(
      badRequestError({
        code: 'trigger_delivery_config_missing',
        message: 'Delivery is not set up.'
      })
    )
  );

  await run('whk/unregister', { triggerWebhookTargetId: target.id });

  expect(invocation.unregisterWebhook).toHaveBeenCalledTimes(1);
  expect(db.triggerDeliveryRoute.deleteMany).toHaveBeenCalledWith({
    where: { webhookRegistrationOid: 7n }
  });
  expect(db.slateWebhookRegistration.update).toHaveBeenCalledWith({
    where: { oid: 7n },
    data: { status: 'deleted' }
  });
  expect(target.status).toBe('creating');
  let jobs = queues.get('shub/trg/whk/register/1').addManyWithOps.mock.calls[0]![0];
  expect(jobs).toHaveLength(1);

  await expect(run('whk/register', jobs[0].data, 4)).rejects.toThrow();
  expect(target.status).toBe('failed');
  expect(instanceError).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'trigger_delivery_config_missing',
      message: 'Delivery is not set up.'
    })
  );
  expect(invocation.registerWebhook).not.toHaveBeenCalled();
});

it('records infrastructure setup failures without inventing a provider invocation', async () => {
  target.status = 'creating';
  let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
  vi.mocked(getTriggerInfrastructure).mockRejectedValueOnce(
    new Error('configuration unavailable')
  );
  await expect(
    run('whk/register', { triggerWebhookTargetId: target.id }, 4)
  ).rejects.toThrow();
  expect(instanceError).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'trigger_infrastructure_setup_failed',
      triggerRegistrationInstanceOid: instance.oid
    })
  );
  expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ renewalClaimToken: expect.any(String) }),
      data: { renewalOperationId: null, status: 'failed' }
    })
  );
  expect(invocation.registerWebhook).not.toHaveBeenCalled();
  expect(db.triggerWebhookTargetRegistrationAttempt.create).not.toHaveBeenCalled();
});
