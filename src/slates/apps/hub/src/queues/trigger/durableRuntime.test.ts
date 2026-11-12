import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 15000 });

let queues = new Map<string, any>();
let db = Object.fromEntries(
  [
    'triggerRegistrationInstance',
    'triggerRegistrationInstanceError',
    'triggerRegistrationSchedule',
    'triggerPollingRun',
    'triggerRawEvent',
    'triggerEventDispatch',
    'triggerRawEventDispatch',
    'triggerWebhookExpansion',
    'triggerRegistrationWebhook',
    'triggerWebhookTarget',
    'triggerWebhookRenewalResult',
    'triggerDeliveryRoute',
    'slateWebhookRegistration'
  ].map(name => [
    name,
    Object.fromEntries(
      [
        'findUnique',
        'findUniqueOrThrow',
        'findFirst',
        'findMany',
        'count',
        'update',
        'updateMany',
        'create',
        'createMany',
        'createManyAndReturn',
        'delete',
        'deleteMany',
        'upsert'
      ].map(method => [method, vi.fn()])
    )
  ])
) as Record<string, any>;
let invocation = {
  createInvocationWithState: vi.fn(),
  pollTriggerGroup: vi.fn(),
  expandWebhook: vi.fn(),
  renewWebhook: vi.fn(),
  unregisterWebhook: vi.fn()
};
let secrets = {
  DANGEROUSLY_decryptSecret: vi.fn(),
  createSecret: vi.fn(),
  DANGEROUSLY_deleteSecret: vi.fn()
};
let mappingQueue = { addManyWithOps: vi.fn() };
let instanceError = vi.fn();
let instance: any;
let schedule: any;
let inbox: any;
let target: any;
let nextId = 100n;
class RetryError extends Error {}

vi.mock('@lowerdeck/queue', async importOriginal => ({
  getDatabaseConflictCode: (await importOriginal<typeof import('@lowerdeck/queue')>())
    .getDatabaseConflictCode,
  createQueue: ({ name, jobOpts }: any) => {
    let queue: any = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      jobOpts,
      process: (handler: any) => {
        queue.handler = handler;
        return queue;
      }
    };
    queues.set(name, queue);
    return queue;
  },
  QueueRetryError: RetryError
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: (_options: any, handler: any) => ({ handler })
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: (_id: string, fn: () => unknown) => fn() })
}));
vi.mock('./_webhookTargetLock', () => ({
  webhookTargetLock: { usingLock: (_id: string, fn: () => unknown) => fn() }
}));
vi.mock('../../db', () => ({ db }));
vi.mock('../../services/triggerInfrastructure', () => ({
  getTriggerInfrastructure: vi.fn(async () => undefined)
}));
vi.mock('./_instanceError', () => ({ createTriggerRegistrationInstanceError: instanceError }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('../../id', () => ({
  getId: () => ({ id: `generated-${++nextId}`, oid: nextId }),
  snowflake: { nextId: () => ++nextId }
}));
vi.mock('../../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ id: 'version' }))
}));
vi.mock('../../services/slateWebhookRegistration', () => ({
  generateWebhookRegistrationUrlKey: () => 'url-key'
}));
vi.mock('../../lib/webhookUrl', () => ({
  getWebhookUrl: () => 'https://example.invalid/hook'
}));
vi.mock('../../services/secret', () => ({ secretService: secrets }));
vi.mock('../../services/slateInvocation', () => ({ slateInvocationService: invocation }));
vi.mock('../../services/tenant', () => ({ globalTenant: { oid: 0n } }));
vi.mock('./payloadOffload', () => ({ triggerRawEventPayloadOffloadQueue: { add: vi.fn() } }));
vi.mock('../../subspace', () => ({ getSubspaceClient: () => null }));
vi.mock('./map', () => ({ triggerMapQueue: mappingQueue }));

let run = (name: string, data: any) => queues.get(name).handler(data, { attemptsMade: 0 });
let success = (data: any) => ({ status: 'success', data, invocation: { oid: 60n } });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  queues.clear();
  db.$transaction = vi.fn(async (fn: any) => fn(db));
  db.$queryRaw = vi.fn(async () => [{ oid: 1n }]);
  for (let table of Object.values(db)) {
    if (typeof table !== 'object') continue;
    table.updateMany.mockResolvedValue({ count: 1 });
    table.findMany.mockResolvedValue([]);
  }
  instance = {
    id: 'instance',
    oid: 2n,
    triggerRegistrationOid: 3n,
    state: { cursor: 'before' },
    stateClaimToken: 'fence',
    stateClaimUntil: new Date(Date.now() + 60_000),
    selection: { resource: 'chosen' },
    triggerGroup: {
      key: 'events',
      spec: { invocation: { type: 'polling', intervalSeconds: 900 } }
    },
    triggerRegistration: {
      oid: 3n,
      tenantOid: 1n,
      status: 'active',
      tenant: { oid: 1n, disableCallbacks: false },
      slate: {},
      instance: {},
      instanceConfig: { value: {} },
      authConfig: null
    }
  };
  schedule = {
    oid: 4n,
    id: 'schedule',
    triggerRegistrationInstance: instance,
    intervalSeconds: 900,
    nextRunAt: new Date(0),
    firstRunAt: null
  };
  inbox = {
    oid: 5n,
    id: 'expansion',
    triggerRegistrationInstanceOid: 2n,
    triggerRegistrationInstance: instance,
    webhookRegistration: { oid: 6n, tenantOid: 1n, status: 'active', secretOid: 8n },
    webhookEventOid: 7n,
    deliveryId: 'delivery',
    payload: { notification: true },
    completedAt: null,
    nextAttemptAt: new Date(0)
  };
  target = {
    oid: 9n,
    id: 'target',
    status: 'active',
    tenantOid: 1n,
    tenant: instance.triggerRegistration.tenant,
    triggerGroup: {
      key: 'events',
      spec: { invocation: { type: 'webhook', supportsRenewal: true } }
    },
    unregistrationStarted: false,
    renewalOperationId: null,
    renewalNextAttemptAt: new Date(0),
    webhookRegistration: {
      oid: 6n,
      secretOid: 8n,
      registrationIdentifier: 'old',
      urlKey: 'key'
    },
    targetIdentifier: 'target-id',
    webhookTargetPayload: {}
  };
  db.triggerRegistrationInstance.findFirst.mockResolvedValue(instance);
  db.triggerRegistrationInstance.findMany.mockResolvedValue([{ oid: 2n }]);
  db.triggerRegistrationSchedule.findUnique.mockResolvedValue(schedule);
  db.triggerWebhookExpansion.findUnique.mockResolvedValue(inbox);
  db.triggerWebhookTarget.findUnique.mockResolvedValue(target);
  db.triggerWebhookTarget.findUniqueOrThrow.mockResolvedValue(target);
  db.triggerWebhookTarget.count.mockResolvedValue(1);
  db.triggerRawEvent.createManyAndReturn.mockResolvedValue([{ id: 'raw', oid: 10n }]);
  db.triggerRawEvent.findUnique.mockResolvedValue({
    id: 'raw',
    oid: 10n,
    triggerIds: ['a', 'b']
  });
  secrets.DANGEROUSLY_decryptSecret.mockResolvedValue({ payload: { saved: true } });
  secrets.createSecret.mockResolvedValue({ oid: 11n });
  invocation.createInvocationWithState.mockResolvedValue({});
  invocation.pollTriggerGroup.mockResolvedValue(
    success({ events: [], updatedState: { cursor: 'after' } })
  );
  invocation.expandWebhook.mockResolvedValue(
    success({ events: [], updatedState: { cursor: 'after' } })
  );
});

describe('durable trigger state', () => {
  it('commits state-only poll results and passes saved state and selection', async () => {
    await import('./poll');
    await run('shub/trg/poll/2', { scheduleId: 'schedule' });
    expect(invocation.pollTriggerGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        state: { cursor: 'before' },
        selection: { resource: 'chosen' }
      })
    );
    expect(db.triggerRegistrationInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stateClaimToken: 'fence',
          stateClaimUntil: { gt: expect.any(Date) }
        }),
        data: expect.objectContaining({ state: { cursor: 'after' } })
      })
    );
    expect(db.triggerPollingRun.create).toHaveBeenCalled();
    expect(db.triggerRawEvent.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('preserves omitted state, clears explicit null, and rejects stale or disabled commits', async () => {
    let { commitTriggerInstance } = await import('./_state');
    let write = vi.fn();
    await commitTriggerInstance(instance, undefined, write);
    expect(
      db.triggerRegistrationInstance.updateMany.mock.lastCall[0].data.state
    ).toBeUndefined();
    await commitTriggerInstance(instance, null, write);
    expect(
      db.triggerRegistrationInstance.updateMany.mock.lastCall[0].data.state
    ).not.toBeUndefined();
    db.triggerRegistrationInstance.updateMany.mockResolvedValue({ count: 0 });
    write.mockClear();
    await expect(
      commitTriggerInstance(instance, { cursor: 'stale' }, write)
    ).rejects.toBeInstanceOf(RetryError);
    expect(write).not.toHaveBeenCalled();
    expect(
      db.triggerRegistrationInstance.updateMany.mock.lastCall[0].where.triggerRegistration
    ).toEqual({ status: 'active', tenant: { disableCallbacks: false } });
  });

  it('leaves cursor untouched on upstream errors and rejects duplicate/not-due schedule jobs', async () => {
    await import('./poll');
    invocation.pollTriggerGroup.mockResolvedValue({
      status: 'error',
      error: { code: 'upstream', message: 'failed' },
      invocation: { oid: 60n }
    });
    await run('shub/trg/poll/2', { scheduleId: 'schedule' });
    expect(
      db.triggerRegistrationInstance.updateMany.mock.calls.every(
        ([call]: any) => call.data.state === undefined
      )
    ).toBe(true);
    expect(db.triggerRawEvent.createManyAndReturn).not.toHaveBeenCalled();
    invocation.pollTriggerGroup.mockClear();
    db.triggerRegistrationSchedule.updateMany.mockResolvedValue({ count: 0 });
    await run('shub/trg/poll/2', { scheduleId: 'schedule' });
    expect(invocation.pollTriggerGroup).not.toHaveBeenCalled();
    expect(db.triggerRegistrationSchedule.updateMany.mock.lastCall[0].where.nextRunAt).toEqual(
      { equals: schedule.nextRunAt, lte: expect.any(Date) }
    );
  });

  it('writes raw events and their dispatch outbox in the state transaction', async () => {
    let { commitTriggerInstance } = await import('./_state');
    let { persistTriggerRawEvents } = await import('./_rawEvent');
    await commitTriggerInstance(instance, { cursor: 'next' }, tx =>
      persistTriggerRawEvents(tx, {
        source: 'polling',
        events: [
          {
            triggerRegistrationInstanceOids: [2n],
            payload: {},
            triggerIds: ['event'],
            idempotencyKey: 'key'
          }
        ]
      }).then(() => undefined)
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.triggerRawEvent.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
    let outbox = db.triggerRawEventDispatch.createMany.mock.lastCall[0];
    expect(outbox).toEqual({
      data: [{ rawEventOid: 10n, nextAttemptAt: expect.any(Date) }],
      skipDuplicates: true
    });
    expect(outbox.data[0].nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(queues.get('shub/trg/evt/map/1').addManyWithOps).not.toHaveBeenCalled();
  });

  it('does not persist tenant-disabled raw events', async () => {
    let { createTriggerRawEvents } = await import('./_rawEvent');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([]);
    let result = await createTriggerRawEvents({
      source: 'webhook',
      events: [{ triggerRegistrationInstanceOids: [2n], payload: {}, triggerIds: ['event'] }]
    });
    expect(result).toMatchObject({ hadCandidates: true, hasRemainingCandidates: false });
    expect(db.triggerRawEvent.createManyAndReturn).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/evt/map/1').addManyWithOps).not.toHaveBeenCalled();
  });

  it('enqueues mapping with the scanner job id only after the raw event commit', async () => {
    let { createTriggerRawEvents } = await import('./_rawEvent');
    let mapping = queues.get('shub/trg/evt/map/1');
    db.$transaction = vi.fn(async (fn: any) => {
      let result = await fn(db);
      expect(mapping.addManyWithOps).not.toHaveBeenCalled();
      return result;
    });

    await createTriggerRawEvents({
      source: 'webhook',
      events: [{ triggerRegistrationInstanceOids: [2n], payload: {}, triggerIds: ['event'] }]
    });

    expect(mapping.addManyWithOps).toHaveBeenCalledWith([
      { data: { rawEventId: 'raw' }, opts: { id: 'raw' } }
    ]);
  });

  it('keeps committed raw events when the immediate enqueue fails', async () => {
    let { createTriggerRawEvents } = await import('./_rawEvent');
    queues
      .get('shub/trg/evt/map/1')
      .addManyWithOps.mockRejectedValue(new Error('Redis unavailable'));

    let result = await createTriggerRawEvents({
      source: 'webhook',
      events: [{ triggerRegistrationInstanceOids: [2n], payload: {}, triggerIds: ['event'] }]
    });

    expect(result.created).toEqual([{ id: 'raw', oid: 10n }]);
    expect(db.triggerRawEventDispatch.createMany).toHaveBeenCalled();
  });

  it('enqueues polled raw events for mapping once the state commit lands', async () => {
    invocation.pollTriggerGroup.mockResolvedValue(
      success({
        events: [{ payload: {}, triggerIds: ['event'], idempotencyKey: 'key' }],
        updatedState: { cursor: 'after' }
      })
    );
    await import('./poll');
    let mapping = queues.get('shub/trg/evt/map/1');
    db.$transaction = vi.fn(async (fn: any) => {
      let result = await fn(db);
      expect(mapping.addManyWithOps).not.toHaveBeenCalled();
      return result;
    });

    await run('shub/trg/poll/2', { scheduleId: 'schedule' });

    expect(mapping.addManyWithOps).toHaveBeenCalledWith([
      { data: { rawEventId: 'raw' }, opts: { id: 'raw' } }
    ]);
  });

  it('stages null-payload reconciliation in the same schedule transaction', async () => {
    instance.triggerGroup.spec.invocation = { type: 'webhook', supportsExpansion: true };
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([
      { webhookRegistration: { oid: 6n, id: 'hook', secretOid: 8n } }
    ]);
    db.triggerWebhookExpansion.createManyAndReturn.mockResolvedValue([{ id: 'reconcile' }]);
    await import('./poll');
    let expand = queues.get('shub/trg/whk/expand/1');
    db.$transaction = vi.fn(async (fn: any) => {
      let result = await fn(db);
      expect(expand.addManyWithOps).not.toHaveBeenCalled();
      return result;
    });

    await run('shub/trg/poll/2', { scheduleId: 'schedule' });

    expect(invocation.pollTriggerGroup).not.toHaveBeenCalled();
    expect(db.triggerWebhookExpansion.createManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            webhookRegistrationOid: 6n,
            deliveryId: 'schedule:1970-01-01T00:00:00.000Z:hook'
          })
        ]
      })
    );
    expect(expand.addManyWithOps).toHaveBeenCalledWith([
      { data: { expansionId: 'reconcile' }, opts: { id: 'reconcile' } }
    ]);
  });

  it('does not stack reconciliation behind one that is still pending', async () => {
    instance.triggerGroup.spec.invocation = { type: 'webhook', supportsExpansion: true };
    db.triggerRegistrationWebhook.findMany.mockResolvedValue([
      { webhookRegistration: { oid: 6n, id: 'hook', secretOid: 8n } },
      { webhookRegistration: { oid: 16n, id: 'other', secretOid: 18n } }
    ]);
    db.triggerWebhookExpansion.findMany.mockResolvedValue([{ webhookRegistrationOid: 6n }]);
    db.triggerWebhookExpansion.createManyAndReturn.mockResolvedValue([{ id: 'reconcile' }]);
    await import('./poll');

    await run('shub/trg/poll/2', { scheduleId: 'schedule' });

    expect(db.triggerWebhookExpansion.findMany.mock.lastCall[0].where).toMatchObject({
      triggerRegistrationInstanceOid: 2n,
      completedAt: null,
      payload: { equals: expect.anything() }
    });
    expect(db.triggerWebhookExpansion.createManyAndReturn.mock.lastCall[0].data).toEqual([
      expect.objectContaining({ webhookRegistrationOid: 16n })
    ]);

    db.triggerWebhookExpansion.findMany.mockResolvedValue([
      { webhookRegistrationOid: 6n },
      { webhookRegistrationOid: 16n }
    ]);
    db.triggerWebhookExpansion.createManyAndReturn.mockClear();
    db.triggerRegistrationSchedule.updateMany.mockClear();
    queues.get('shub/trg/whk/expand/1').addManyWithOps.mockClear();

    await run('shub/trg/poll/2', { scheduleId: 'schedule' });

    expect(db.triggerWebhookExpansion.createManyAndReturn).not.toHaveBeenCalled();
    expect(queues.get('shub/trg/whk/expand/1').addManyWithOps).not.toHaveBeenCalled();
    expect(
      db.triggerRegistrationSchedule.updateMany.mock.calls.some(
        ([call]: any) => call.data.lastRunAt instanceof Date
      )
    ).toBe(true);
  });
});

describe('dispatch recovery', () => {
  it('recovers the commit-before-enqueue gap and keeps outbox through failed child dispatch', async () => {
    await import('./dispatch');
    db.triggerRawEventDispatch.findMany.mockResolvedValue([
      { rawEventOid: 10n, rawEvent: { id: 'raw' } }
    ]);
    await run('shub/trg/dispatch/1', { cutoff: new Date().toISOString() });
    expect(queues.get('shub/trg/evt/map/1').addManyWithOps).toHaveBeenCalledWith([
      { data: { rawEventId: 'raw' }, opts: { id: 'raw' } }
    ]);
    expect(db.triggerRawEventDispatch.deleteMany).not.toHaveBeenCalled();
    mappingQueue.addManyWithOps.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(run('shub/trg/evt/map/1', { rawEventId: 'raw' })).rejects.toThrow();
    expect(db.triggerRawEventDispatch.deleteMany).not.toHaveBeenCalled();
    await run('shub/trg/evt/map/1', { rawEventId: 'raw' });
    expect(db.triggerRawEventDispatch.deleteMany).toHaveBeenCalledWith({
      where: { rawEventOid: 10n }
    });
    expect(queues.get('shub/trg/evt/map/1').jobOpts.removeOnFail).toBe(true);
  });
});

describe('authenticated expansion inbox', () => {
  let failed = (code: string, message: string) => ({
    status: 'error',
    error: { code, message },
    invocation: { oid: 60n }
  });
  let expansionWrites = () =>
    db.triggerWebhookExpansion.updateMany.mock.calls.map(([call]: any) => call);
  let stateWrites = () =>
    db.triggerRegistrationInstance.updateMany.mock.calls.map(([call]: any) => call.data.state);
  let failureWrites = () =>
    db.triggerRegistrationInstance.updateMany.mock.calls
      .map(([call]: any) => call)
      .filter((call: any) => 'expansionFailureCount' in call.data);
  let job = (id: string) => ({ data: { expansionId: id }, opts: { id } });
  let events = () =>
    success({
      events: [{ payload: {}, triggerIds: ['event'], idempotencyKey: 'key' }],
      updatedState: { cursor: 'after' }
    });

  beforeEach(() => {
    instance.triggerGroup.spec.invocation = { type: 'webhook', supportsExpansion: true };
    instance.expansionFailureCount = 0;
    instance.expansionRetryAt = null;
    inbox.attemptCount = 0;
    inbox.createdAt = new Date();
  });

  it('commits zero-event state updates and skips completed duplicates', async () => {
    await import('./webhookExpand');
    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });
    expect(invocation.expandWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        state: { cursor: 'before' },
        deliveryId: 'delivery',
        webhookRegistrationPayload: { saved: true }
      })
    );
    expect(db.triggerWebhookExpansion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completedAt: expect.any(Date) })
      })
    );
    inbox.completedAt = new Date();
    invocation.expandWebhook.mockClear();
    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
  });

  it('expands with the payload the registration holds now, not the one it had on arrival', async () => {
    await import('./webhookExpand');
    db.triggerWebhookExpansion.findUnique.mockResolvedValueOnce(inbox).mockResolvedValue({
      ...inbox,
      webhookRegistration: { secretOid: 11n }
    });

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(secrets.DANGEROUSLY_decryptSecret).toHaveBeenCalledWith(
      expect.objectContaining({ secretOid: 11n })
    );
  });

  it('backs off the row and its connection after a failed expansion without advancing state', async () => {
    await import('./webhookExpand');
    invocation.expandWebhook.mockResolvedValue(failed('rate_limit', 'slow down'));
    let startedAt = Date.now();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    let [counted] = failureWrites();
    expect(counted).toEqual({
      where: { oid: 2n, stateClaimToken: 'fence' },
      data: { expansionFailureCount: 1, expansionRetryAt: expect.any(Date) }
    });
    let retryAt = counted.data.expansionRetryAt;
    expect(retryAt.getTime()).toBeGreaterThanOrEqual(startedAt + 60_000);
    expect(retryAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(expansionWrites()).toEqual([
      {
        where: { oid: 5n, completedAt: null },
        data: {
          attemptCount: { increment: 1 },
          nextAttemptAt: retryAt,
          lastErrorCode: 'rate_limit'
        }
      },
      {
        where: {
          triggerRegistrationInstanceOid: 2n,
          completedAt: null,
          nextAttemptAt: { lt: retryAt }
        },
        data: { nextAttemptAt: retryAt }
      }
    ]);
    expect(failureWrites()).toHaveLength(1);
    expect(stateWrites().every((state: unknown) => state === undefined)).toBe(true);
    expect(db.triggerRawEvent.createManyAndReturn).not.toHaveBeenCalled();
    expect(instanceError).not.toHaveBeenCalled();
    expect(db.triggerRegistrationInstanceError.deleteMany).not.toHaveBeenCalled();
  });

  it('escalates the connection backoff whichever row fails, even one that never failed', async () => {
    await import('./webhookExpand');
    instance.expansionFailureCount = 6;
    instance.expansionRetryAt = new Date(Date.now() - 1_000);
    invocation.expandWebhook.mockResolvedValue(failed('unauthorized', 'Access was revoked'));
    let startedAt = Date.now();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    let [counted] = failureWrites();
    let retryAt = counted.data.expansionRetryAt;
    let [attempted, deferred] = expansionWrites();
    expect(counted.data.expansionFailureCount).toBe(7);
    expect(retryAt.getTime()).toBeGreaterThanOrEqual(startedAt + 60 * 60_000);
    expect(attempted.data.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(deferred).toEqual({
      where: {
        triggerRegistrationInstanceOid: 2n,
        completedAt: null,
        nextAttemptAt: { lt: retryAt }
      },
      data: { nextAttemptAt: retryAt }
    });

    instance.expansionFailureCount = 7;
    instance.expansionRetryAt = retryAt;
    invocation.expandWebhook.mockClear();
    db.triggerWebhookExpansion.updateMany.mockClear();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(expansionWrites()).toEqual([
      {
        where: { oid: 5n, completedAt: null, nextAttemptAt: { lt: retryAt } },
        data: { nextAttemptAt: retryAt }
      }
    ]);
    expect(failureWrites()).toHaveLength(1);
  });

  it('holds the siblings of a repeatedly failing row for the first backoff step only', async () => {
    await import('./webhookExpand');
    inbox.attemptCount = 5;
    invocation.expandWebhook.mockResolvedValue(failed('bad_payload', 'cannot expand'));
    let startedAt = Date.now();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    let [counted] = failureWrites();
    let retryAt = counted.data.expansionRetryAt;
    let [attempted, deferred] = expansionWrites();
    expect(counted.data.expansionFailureCount).toBe(1);
    expect(retryAt.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(attempted.data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      startedAt + 32 * 60_000
    );
    expect(deferred.where.nextAttemptAt).toEqual({ lt: retryAt });
    expect(deferred.data).toEqual({ nextAttemptAt: retryAt });
  });

  it('lets a less-failed row go first and releases never-failed rows once it succeeds', async () => {
    await import('./webhookExpand');
    let expand = queues.get('shub/trg/whk/expand/1');
    inbox.attemptCount = 2;
    db.triggerWebhookExpansion.findFirst.mockResolvedValue({ id: 'healthy' });

    await expect(
      run('shub/trg/whk/expand/1', { expansionId: 'expansion' })
    ).rejects.toBeInstanceOf(RetryError);

    expect(db.triggerWebhookExpansion.findFirst.mock.lastCall[0].where).toEqual({
      triggerRegistrationInstanceOid: 2n,
      completedAt: null,
      attemptCount: { lt: 2 },
      nextAttemptAt: { lte: expect.any(Date) },
      createdAt: { gt: expect.any(Date) }
    });
    expect(expand.addManyWithOps).toHaveBeenCalledWith([job('healthy')]);
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(db.triggerRegistrationInstance.updateMany).not.toHaveBeenCalled();
    expect(expansionWrites()).toHaveLength(0);

    inbox.attemptCount = 0;
    instance.expansionFailureCount = 1;
    instance.expansionRetryAt = new Date(Date.now() - 1_000);
    db.triggerWebhookExpansion.findFirst.mockClear();
    db.triggerWebhookExpansion.findMany.mockResolvedValue([{ id: 'waiting' }]);
    expand.addManyWithOps.mockClear();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(db.triggerWebhookExpansion.findFirst).not.toHaveBeenCalled();
    expect(invocation.expandWebhook).toHaveBeenCalledTimes(1);
    expect(db.triggerRegistrationInstance.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { expansionFailureCount: 0, expansionRetryAt: null }
    });
    expect(db.triggerWebhookExpansion.findMany.mock.lastCall[0].where).toEqual({
      triggerRegistrationInstanceOid: 2n,
      completedAt: null,
      attemptCount: 0
    });
    expect(expansionWrites()).toEqual([
      {
        where: { oid: 5n, completedAt: null },
        data: expect.objectContaining({ completedAt: expect.any(Date), lastErrorCode: null })
      },
      {
        where: { triggerRegistrationInstanceOid: 2n, completedAt: null, attemptCount: 0 },
        data: { nextAttemptAt: expect.any(Date) }
      }
    ]);
    expect(expand.addManyWithOps).toHaveBeenCalledWith([job('waiting')]);
  });

  it('clears the reported failure after a success without depending on that cleanup', async () => {
    await import('./webhookExpand');
    let cleared = db.triggerRegistrationInstanceError.deleteMany;
    db.$transaction = vi.fn(async (fn: any) => {
      let result = await fn(db);
      expect(cleared).not.toHaveBeenCalled();
      return result;
    });

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(cleared).toHaveBeenCalledWith({
      where: { triggerRegistrationInstanceOid: 2n, code: 'webhook_expansion_failed' }
    });
    expect(db.triggerRegistrationInstance.update).not.toHaveBeenCalled();

    db.$transaction = vi.fn(async (fn: any) => fn(db));
    cleared.mockRejectedValue(new Error('database unavailable'));

    await expect(
      run('shub/trg/whk/expand/1', { expansionId: 'expansion' })
    ).resolves.toBeUndefined();
  });

  it('doubles the backoff per failed attempt from one minute up to an hour', async () => {
    let { triggerWebhookExpansionBackoffMs, triggerWebhookExpandWorkerOpts } =
      await import('./_config');
    await import('./webhookExpand');
    expect([1, 2, 3, 6, 7, 12].map(triggerWebhookExpansionBackoffMs)).toEqual([
      60_000, 120_000, 240_000, 1_920_000, 3_600_000, 3_600_000
    ]);
    expect(triggerWebhookExpandWorkerOpts).toEqual({ concurrency: expect.any(Number) });

    inbox.attemptCount = 3;
    invocation.expandWebhook.mockResolvedValue(failed('rate_limit', 'slow down'));
    let startedAt = Date.now();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(expansionWrites()[0].data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      startedAt + 480_000
    );
  });

  it('closes the row and records an instance error once its attempts run out', async () => {
    let { Prisma } = await import('../../../prisma/generated/client');
    let { TRIGGER_WEBHOOK_EXPANSION_MAX_ATTEMPTS } = await import('./_config');
    await import('./webhookExpand');
    inbox.attemptCount = TRIGGER_WEBHOOK_EXPANSION_MAX_ATTEMPTS - 1;
    invocation.expandWebhook.mockResolvedValue(
      failed('invalid_grant', 'Token has been revoked')
    );

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    let [closed, deferred] = expansionWrites();
    expect(closed.data).toEqual({
      attemptCount: { increment: 1 },
      completedAt: expect.any(Date),
      payload: Prisma.DbNull,
      lastErrorCode: 'retries_exhausted'
    });
    expect(deferred.where).toMatchObject({
      triggerRegistrationInstanceOid: 2n,
      completedAt: null
    });
    expect(instanceError).toHaveBeenCalledWith({
      triggerRegistrationInstanceOid: 2n,
      code: 'webhook_expansion_failed',
      message: expect.stringContaining('Token has been revoked')
    });
    expect(instanceError.mock.invocationCallOrder[0]).toBeLessThan(
      db.triggerWebhookExpansion.updateMany.mock.invocationCallOrder[0]
    );
    expect(stateWrites().every((state: unknown) => state === undefined)).toBe(true);

    let unavailable = new Error('database unavailable');
    db.triggerWebhookExpansion.updateMany.mockClear();
    instanceError.mockRejectedValueOnce(unavailable);

    await expect(run('shub/trg/whk/expand/1', { expansionId: 'expansion' })).rejects.toBe(
      unavailable
    );

    expect(expansionWrites()).toHaveLength(0);
  });

  it('counts an exception from the call as an attempt, reports it, and stops at the limit', async () => {
    let { TRIGGER_WEBHOOK_EXPANSION_MAX_ATTEMPTS } = await import('./_config');
    await import('./webhookExpand');
    let crash = new Error('socket hang up');
    invocation.expandWebhook.mockRejectedValue(crash);

    await expect(run('shub/trg/whk/expand/1', { expansionId: 'expansion' })).rejects.toBe(
      crash
    );

    expect(expansionWrites()[0].data).toMatchObject({
      attemptCount: { increment: 1 },
      lastErrorCode: 'expansion_failed'
    });
    expect(instanceError).not.toHaveBeenCalled();

    inbox.attemptCount = TRIGGER_WEBHOOK_EXPANSION_MAX_ATTEMPTS - 1;

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'webhook_expansion_failed',
        message: expect.stringContaining('socket hang up')
      })
    );
  });

  it('counts a commit that fails outside the fence so it cannot call the provider forever', async () => {
    await import('./webhookExpand');
    let rejected = new Error('unsupported Unicode escape sequence');
    invocation.expandWebhook.mockResolvedValue(
      success({
        events: [{ payload: {}, triggerIds: ['event'], idempotencyKey: 'key' }],
        updatedState: { cursor: 'after' }
      })
    );
    db.triggerRawEvent.createManyAndReturn.mockRejectedValue(rejected);

    await expect(run('shub/trg/whk/expand/1', { expansionId: 'expansion' })).rejects.toBe(
      rejected
    );

    expect(expansionWrites().map((call: any) => call.data)).toEqual([
      {
        attemptCount: { increment: 1 },
        nextAttemptAt: expect.any(Date),
        lastErrorCode: 'expansion_failed'
      },
      { nextAttemptAt: expect.any(Date) }
    ]);
    expect(queues.get('shub/trg/evt/map/1').addManyWithOps).not.toHaveBeenCalled();
  });

  it.each([
    ['a write conflict', Object.assign(new Error('write conflict'), { code: 'P2034' })],
    [
      'a serialization failure',
      Object.assign(new Error('transaction failed'), { cause: { code: '40001' } })
    ],
    [
      'a deadlock reported by the driver',
      Object.assign(new Error('query failed'), {
        meta: { driverAdapterError: { code: '40P01' } }
      })
    ],
    ['a deadlock message', new Error('deadlock detected')]
  ])(
    'leaves %s in the commit to the queue without counting an attempt',
    async (_name, conflict) => {
      await import('./webhookExpand');
      invocation.expandWebhook.mockResolvedValue(events());
      db.triggerRawEvent.createManyAndReturn.mockRejectedValue(conflict);

      await expect(run('shub/trg/whk/expand/1', { expansionId: 'expansion' })).rejects.toBe(
        conflict
      );

      expect(expansionWrites()).toHaveLength(0);
      expect(failureWrites()).toHaveLength(0);
      expect(instanceError).not.toHaveBeenCalled();
    }
  );

  it('backs off instead of retrying forever when the group stops supporting expansion', async () => {
    await import('./webhookExpand');
    instance.triggerGroup.spec.invocation = { type: 'webhook' };

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(expansionWrites()[0].data).toMatchObject({
      attemptCount: { increment: 1 },
      lastErrorCode: 'expansion_unsupported'
    });
  });

  it('does not spend an attempt on a busy claim, a fenced commit, or a lost claim', async () => {
    await import('./webhookExpand');
    db.triggerRegistrationInstance.updateMany.mockResolvedValue({ count: 0 });
    db.triggerRegistrationInstance.count.mockResolvedValue(1);

    await expect(
      run('shub/trg/whk/expand/1', { expansionId: 'expansion' })
    ).rejects.toBeInstanceOf(RetryError);
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(expansionWrites()).toHaveLength(0);

    db.triggerRegistrationInstance.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });

    await expect(
      run('shub/trg/whk/expand/1', { expansionId: 'expansion' })
    ).rejects.toBeInstanceOf(RetryError);
    expect(invocation.expandWebhook).toHaveBeenCalledTimes(1);
    expect(expansionWrites()).toHaveLength(0);

    db.triggerRegistrationInstance.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });
    invocation.expandWebhook.mockResolvedValue(failed('rate_limit', 'slow down'));

    await expect(
      run('shub/trg/whk/expand/1', { expansionId: 'expansion' })
    ).rejects.toBeInstanceOf(RetryError);
    expect(invocation.expandWebhook).toHaveBeenCalledTimes(2);
    expect(expansionWrites()).toHaveLength(0);
    expect(instanceError).not.toHaveBeenCalled();
  });

  it('waits for the connection backoff instead of calling the provider', async () => {
    await import('./webhookExpand');
    let retryAt = new Date(Date.now() + 30 * 60_000);
    instance.expansionFailureCount = 6;
    instance.expansionRetryAt = retryAt;

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(expansionWrites()).toEqual([
      {
        where: { oid: 5n, completedAt: null, nextAttemptAt: { lt: retryAt } },
        data: { nextAttemptAt: retryAt }
      }
    ]);
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(db.triggerRegistrationInstance.updateMany).not.toHaveBeenCalled();

    instance.expansionRetryAt = new Date(Date.now() - 1_000);

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(invocation.expandWebhook).toHaveBeenCalledTimes(1);
  });

  it('treats a row stamped slightly ahead of the worker clock as due', async () => {
    await import('./webhookExpand');
    inbox.nextAttemptAt = new Date(Date.now() + 1_000);

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(invocation.expandWebhook).toHaveBeenCalledTimes(1);

    inbox.nextAttemptAt = new Date(Date.now() + 60_000);
    invocation.expandWebhook.mockClear();

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(invocation.expandWebhook).not.toHaveBeenCalled();
  });

  it('closes a row past the age cap without calling the provider and records the error', async () => {
    let { Prisma } = await import('../../../prisma/generated/client');
    let { TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS } = await import('./_config');
    await import('./webhookExpand');
    inbox.createdAt = new Date(Date.now() - TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS - 60_000);

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(expansionWrites()).toEqual([
      {
        where: { oid: 5n, completedAt: null },
        data: {
          completedAt: expect.any(Date),
          payload: Prisma.DbNull,
          lastErrorCode: 'expired'
        }
      }
    ]);
    expect(instanceError).toHaveBeenCalledWith({
      triggerRegistrationInstanceOid: 2n,
      code: 'webhook_expansion_failed',
      message: expect.stringContaining('24 hours')
    });
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(secrets.DANGEROUSLY_decryptSecret).not.toHaveBeenCalled();
    expect(db.triggerRegistrationInstance.updateMany).not.toHaveBeenCalled();
    expect(instanceError.mock.invocationCallOrder[0]).toBeLessThan(
      db.triggerWebhookExpansion.updateMany.mock.invocationCallOrder[0]
    );

    let unavailable = new Error('database unavailable');
    db.triggerWebhookExpansion.updateMany.mockClear();
    instanceError.mockRejectedValueOnce(unavailable);

    await expect(run('shub/trg/whk/expand/1', { expansionId: 'expansion' })).rejects.toBe(
      unavailable
    );

    expect(expansionWrites()).toHaveLength(0);
  });

  it('closes an expired row even while the connection is backing off', async () => {
    let { TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS } = await import('./_config');
    await import('./webhookExpand');
    let retryAt = new Date(Date.now() + 30 * 60_000);
    inbox.createdAt = new Date(Date.now() - TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS - 60_000);
    inbox.nextAttemptAt = retryAt;
    instance.expansionFailureCount = 6;
    instance.expansionRetryAt = retryAt;

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(expansionWrites().map((call: any) => call.data.lastErrorCode)).toEqual(['expired']);
    expect(instanceError).toHaveBeenCalledTimes(1);
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(db.triggerRegistrationInstance.updateMany).not.toHaveBeenCalled();
  });

  it('processes a row that is still inside the age cap', async () => {
    let { TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS } = await import('./_config');
    await import('./webhookExpand');
    inbox.createdAt = new Date(Date.now() - TRIGGER_WEBHOOK_EXPANSION_MAX_AGE_MS + 60_000);

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(invocation.expandWebhook).toHaveBeenCalledTimes(1);
    expect(expansionWrites().map((call: any) => call.data.lastErrorCode)).toEqual([null]);
    expect(instanceError).not.toHaveBeenCalled();
  });

  it('enqueues expanded raw events after the fenced commit without risking the attempt', async () => {
    await import('./webhookExpand');
    let mapping = queues.get('shub/trg/evt/map/1');
    invocation.expandWebhook.mockResolvedValue(
      success({
        events: [{ payload: {}, triggerIds: ['event'], idempotencyKey: 'key' }],
        updatedState: { cursor: 'after' }
      })
    );
    db.$transaction = vi.fn(async (fn: any) => {
      let result = await fn(db);
      expect(mapping.addManyWithOps).not.toHaveBeenCalled();
      return result;
    });

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(mapping.addManyWithOps).toHaveBeenCalledWith([
      { data: { rawEventId: 'raw' }, opts: { id: 'raw' } }
    ]);

    db.$transaction = vi.fn(async (fn: any) => fn(db));
    db.triggerWebhookExpansion.updateMany.mockClear();
    mapping.addManyWithOps.mockRejectedValue(new Error('Redis unavailable'));

    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });

    expect(expansionWrites().map((call: any) => call.data)).toEqual([
      expect.objectContaining({ completedAt: expect.any(Date), lastErrorCode: null })
    ]);
  });

  it('enqueues inbox rows with the scanner job id only after their commit', async () => {
    let { createWebhookExpansionInbox } = await import('./webhookExpand');
    let expand = queues.get('shub/trg/whk/expand/1');
    let delivery = {
      webhookEventOid: 7n,
      webhookEventId: 'event',
      webhookRegistrationOid: 6n,
      events: [{ triggerRegistrationInstanceOids: [2n], payload: {}, triggerIds: [] }]
    };
    db.triggerWebhookExpansion.createManyAndReturn.mockResolvedValue([{ id: 'expansion' }]);
    db.$transaction = vi.fn(async (fn: any) => {
      let result = await fn(db);
      expect(expand.addManyWithOps).not.toHaveBeenCalled();
      return result;
    });

    let result = await createWebhookExpansionInbox(delivery);

    expect(result).toMatchObject({ hadCandidates: true, hasRemainingCandidates: true });
    expect(db.triggerWebhookExpansion.createManyAndReturn.mock.lastCall[0].data).toEqual([
      expect.objectContaining({
        triggerRegistrationInstanceOid: 2n,
        webhookRegistrationOid: 6n,
        deliveryId: 'event:0'
      })
    ]);
    expect(expand.addManyWithOps).toHaveBeenCalledWith([job('expansion')]);

    db.$transaction = vi.fn(async (fn: any) => fn(db));
    db.triggerWebhookExpansion.findMany.mockResolvedValue([{ id: 'expansion' }]);
    expand.addManyWithOps.mockClear();

    await run('shub/trg/whk/expand/search/1', { cutoff: new Date().toISOString() });

    expect(expand.addManyWithOps).toHaveBeenCalledWith([job('expansion')]);

    expand.addManyWithOps.mockRejectedValue(new Error('Redis unavailable'));

    await expect(createWebhookExpansionInbox(delivery)).resolves.toMatchObject({
      hadCandidates: true,
      hasRemainingCandidates: true
    });
  });

  it('discards disabled inbox entries without invoking credentials', async () => {
    await import('./webhookExpand');
    db.triggerRegistrationInstance.updateMany.mockResolvedValue({ count: 0 });
    db.triggerRegistrationInstance.count.mockResolvedValue(0);
    await run('shub/trg/whk/expand/1', { expansionId: 'expansion' });
    expect(invocation.expandWebhook).not.toHaveBeenCalled();
    expect(db.triggerWebhookExpansion.updateMany.mock.lastCall[0].data.lastErrorCode).toBe(
      'registration_disabled'
    );
  });
});

describe('renewal fencing and recovery', () => {
  it('commits encrypted replacement pointer and lease dates together', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    invocation.renewWebhook.mockResolvedValue(
      success({
        webhookRegistrationIdentifier: 'new',
        webhookRegistrationPayload: { new: true },
        expiresAt: '2030-01-01T00:00:00.000Z',
        renewAfter: '2029-12-31T00:00:00.000Z'
      })
    );
    db.triggerWebhookRenewalResult.upsert.mockImplementation(
      async ({ create }: any) => create
    );
    await run('shub/trg/whk/renew/1', { targetId: 'target' });
    expect(invocation.renewWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: expect.any(String),
        selection: { resource: 'chosen' }
      })
    );
    expect(db.slateWebhookRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 6n, status: 'active', secretOid: 8n },
        data: {
          secretOid: 11n,
          registrationIdentifier: 'new',
          expiresAt: new Date('2030-01-01'),
          renewAfter: new Date('2029-12-31')
        }
      })
    );
    expect(db.triggerWebhookRenewalResult.delete).toHaveBeenCalled();
    expect(db.triggerRegistrationInstanceError.deleteMany).toHaveBeenCalledWith({
      where: { triggerWebhookTargetOid: 9n, code: 'webhook_renewal_failed' }
    });
    expect(secrets.DANGEROUSLY_deleteSecret.mock.calls).toEqual([
      [{ tenant: target.tenant, secretOid: 8n }]
    ]);
    expect(db.triggerWebhookRenewalResult.delete.mock.invocationCallOrder[0]).toBeLessThan(
      secrets.DANGEROUSLY_deleteSecret.mock.invocationCallOrder[0]!
    );
  });

  it('keeps a committed renewal when the replaced payload cannot be deleted', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    invocation.renewWebhook.mockResolvedValue(
      success({ webhookRegistrationIdentifier: 'new', webhookRegistrationPayload: {} })
    );
    db.triggerWebhookRenewalResult.upsert.mockImplementation(
      async ({ create }: any) => create
    );
    secrets.DANGEROUSLY_deleteSecret.mockRejectedValue(new Error('unavailable'));

    await expect(run('shub/trg/whk/renew/1', { targetId: 'target' })).resolves.toBeUndefined();
    expect(db.triggerWebhookRenewalResult.delete).toHaveBeenCalled();
  });

  it('schedules the next renewal from the lease the result returned', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    db.triggerWebhookRenewalResult.upsert.mockImplementation(
      async ({ create }: any) => create
    );
    let savedLease = () => {
      let { expiresAt, renewAfter, nextRenewalAt } =
        db.triggerWebhookRenewalResult.upsert.mock.lastCall[0].create;
      return { expiresAt, renewAfter, nextRenewalAt };
    };
    let previous = {
      expiresAt: new Date(Date.now() + 60 * 60_000),
      renewAfter: new Date(Date.now() - 60_000)
    };
    Object.assign(target.webhookRegistration, previous);

    invocation.renewWebhook.mockResolvedValue(
      success({
        webhookRegistrationIdentifier: 'new',
        webhookRegistrationPayload: {},
        expiresAt: '2030-01-01T00:00:00.000Z'
      })
    );
    await run('shub/trg/whk/renew/1', { targetId: 'target' });

    expect(savedLease()).toEqual({
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      renewAfter: null,
      nextRenewalAt: new Date('2029-12-31T23:55:00.000Z')
    });

    invocation.renewWebhook.mockResolvedValue(
      success({ webhookRegistrationIdentifier: 'new', webhookRegistrationPayload: {} })
    );
    await run('shub/trg/whk/renew/1', { targetId: 'target' });

    expect(savedLease()).toMatchObject(previous);
  });

  it('hands a target no active connection uses to cleanup instead of rescheduling it', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([]);
    db.triggerWebhookTarget.findMany.mockResolvedValue([{ oid: 9n, id: 'target' }]);

    await run('shub/trg/whk/renew/1', { targetId: 'target' });

    expect(invocation.renewWebhook).not.toHaveBeenCalled();
    expect(db.triggerRegistrationWebhook.findMany.mock.lastCall[0].where).toEqual({
      triggerWebhookTargetOid: { in: [9n] },
      triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
    });
    expect(db.triggerWebhookTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'deleting' } })
    );
    expect(queues.get('shub/trg/whk/unregister/1').addManyWithOps).toHaveBeenCalledWith([
      {
        data: { triggerWebhookTargetId: 'target', triggerRegistrationId: undefined },
        opts: { id: 'target' }
      }
    ]);
  });

  it('leaves a durable replacement for cleanup if deletion fences the commit', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    invocation.renewWebhook.mockResolvedValue(
      success({ webhookRegistrationIdentifier: 'new', webhookRegistrationPayload: {} })
    );
    db.triggerWebhookRenewalResult.upsert.mockImplementation(
      async ({ create }: any) => create
    );
    db.triggerWebhookTarget.updateMany.mockImplementation(async ({ data }: any) => ({
      count: data.renewalOperationId === null ? 0 : 1
    }));
    await expect(run('shub/trg/whk/renew/1', { targetId: 'target' })).rejects.toBeInstanceOf(
      RetryError
    );
    expect(db.triggerWebhookRenewalResult.upsert).toHaveBeenCalled();
    expect(db.triggerWebhookRenewalResult.delete).not.toHaveBeenCalled();
    expect(db.slateWebhookRegistration.updateMany).not.toHaveBeenCalled();
    expect(secrets.DANGEROUSLY_deleteSecret).not.toHaveBeenCalled();
  });

  it('keeps failed rollback durable and does not renew legacy or tenant-disabled groups', async () => {
    await import('./webhookRenew');
    db.triggerWebhookRenewalResult.findUnique.mockResolvedValue({
      operationId: 'op',
      targetOid: 9n,
      target,
      instance,
      secretOid: 11n,
      oldRegistrationIdentifier: 'old',
      registrationIdentifier: 'new',
      createdAt: new Date()
    });
    target.status = 'deleted';
    invocation.unregisterWebhook.mockResolvedValue({ status: 'error', error: {} });
    await expect(
      run('shub/trg/whk/renew/cleanup/1', { operationId: 'op' })
    ).rejects.toBeInstanceOf(RetryError);
    expect(db.triggerWebhookRenewalResult.deleteMany).not.toHaveBeenCalled();
    target.status = 'active';
    target.triggerGroup.spec.invocation.supportsRenewal = undefined;
    await run('shub/trg/whk/renew/1', { targetId: 'target' });
    target.triggerGroup.spec.invocation.supportsRenewal = true;
    target.tenant.disableCallbacks = true;
    await run('shub/trg/whk/renew/1', { targetId: 'target' });
    expect(invocation.renewWebhook).not.toHaveBeenCalled();
  });

  it('drops an abandoned provider result locally once it is too old to roll back', async () => {
    await import('./webhookRenew');
    db.triggerWebhookRenewalResult.findUnique.mockResolvedValue({
      operationId: 'op',
      targetOid: 9n,
      target,
      instance,
      secretOid: 11n,
      oldRegistrationIdentifier: 'old',
      registrationIdentifier: 'new',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
    });
    target.status = 'deleted';
    await run('shub/trg/whk/renew/cleanup/1', { operationId: 'op' });
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.triggerWebhookRenewalResult.deleteMany).toHaveBeenCalledWith({
      where: { operationId: 'op' }
    });
    expect(secrets.DANGEROUSLY_deleteSecret).toHaveBeenCalledWith(
      expect.objectContaining({ secretOid: 11n })
    );
  });

  it('deletes the payload a registration being removed stops pointing at', async () => {
    await import('./webhookRenew');
    db.triggerWebhookRenewalResult.findUnique.mockResolvedValue({
      operationId: 'op',
      targetOid: 9n,
      target,
      instance,
      secretOid: 11n,
      oldRegistrationIdentifier: 'old',
      registrationIdentifier: 'old',
      routingKeys: [],
      createdAt: new Date()
    });
    target.status = 'deleting';

    await run('shub/trg/whk/renew/cleanup/1', { operationId: 'op' });

    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.slateWebhookRegistration.update).toHaveBeenCalledWith({
      where: { oid: 6n },
      data: { secretOid: 11n }
    });
    expect(secrets.DANGEROUSLY_deleteSecret.mock.calls).toEqual([
      [{ tenant: target.tenant, secretOid: 8n }]
    ]);
  });

  it('leaves a shared provider resource alone when rolling back an abandoned result', async () => {
    await import('./webhookRenew');
    db.triggerWebhookRenewalResult.findUnique.mockResolvedValue({
      operationId: 'op',
      targetOid: 9n,
      target,
      instance,
      secretOid: 11n,
      oldRegistrationIdentifier: '',
      registrationIdentifier: 'new',
      deliveryBindingId: 'binding',
      routingKeys: ['resource-a'],
      createdAt: new Date()
    });
    target.status = 'deleted';
    db.triggerDeliveryRoute.count.mockResolvedValue(1);
    await run('shub/trg/whk/renew/cleanup/1', { operationId: 'op' });
    expect(db.triggerDeliveryRoute.count.mock.calls[0][0].where).toMatchObject({
      OR: [{ bindingId: 'binding', routingKey: 'resource-a' }],
      webhookRegistrationOid: undefined
    });
    expect(invocation.unregisterWebhook).not.toHaveBeenCalled();
    expect(db.triggerWebhookRenewalResult.deleteMany).toHaveBeenCalledWith({
      where: { operationId: 'op' }
    });
  });

  it('rotates the renewing connection between retries', async () => {
    await import('./webhookRenew');
    let other = { ...instance, id: 'other', oid: 22n };
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance, other]);
    invocation.renewWebhook.mockResolvedValue({
      status: 'error',
      invocation: { oid: 60n },
      error: { code: 'unauthorized', message: 'Access was revoked' }
    });
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(10 * 5 * 60 * 1000));
      await run('shub/trg/whk/renew/1', { targetId: 'target' });
      vi.setSystemTime(new Date(11 * 5 * 60 * 1000));
      await run('shub/trg/whk/renew/1', { targetId: 'target' });
    } finally {
      vi.useRealTimers();
    }
    expect(
      invocation.createInvocationWithState.mock.calls.map(([call]: any) => call.session.id)
    ).toEqual(['instance', 'other']);
  });

  it('retries a failed renewal later under a new operation identity', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    invocation.renewWebhook.mockResolvedValue({
      status: 'error',
      invocation: { oid: 60n },
      error: { code: 'invocation_error', message: 'connection lost' }
    });
    let started = Date.now();
    await run('shub/trg/whk/renew/1', { targetId: 'target' });

    let updates = db.triggerWebhookTarget.updateMany.mock.calls.map(([call]: any) => call);
    expect(updates).toContainEqual(
      expect.objectContaining({ data: { renewalOperationId: null } })
    );
    let released = updates[updates.length - 1];
    expect(released.data).toMatchObject({ renewalClaimToken: null, renewalClaimUntil: null });
    expect(released.data.renewalNextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      started + 5 * 60 * 1000
    );
    expect(db.slateWebhookRegistration.updateMany).not.toHaveBeenCalled();
    expect(instanceError).not.toHaveBeenCalled();
  });

  it('surfaces a renewal that still fails after the subscription expired', async () => {
    await import('./webhookRenew');
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    target.webhookRegistration.expiresAt = new Date(Date.now() - 60_000);
    invocation.renewWebhook.mockResolvedValue({
      status: 'error',
      invocation: { oid: 60n },
      error: { code: 'unauthorized', message: 'Access was revoked' }
    });
    await run('shub/trg/whk/renew/1', { targetId: 'target' });
    expect(instanceError).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerRegistrationInstanceOid: instance.oid,
        triggerWebhookTargetOid: target.oid,
        code: 'webhook_renewal_failed',
        message: expect.stringContaining('Access was revoked')
      })
    );
  });

  it('replaces the delivery routes of a renewed managed-delivery registration', async () => {
    await import('./webhookRenew');
    let { getTriggerInfrastructure } = await import('../../services/triggerInfrastructure');
    vi.mocked(getTriggerInfrastructure).mockResolvedValue({
      bindingId: 'binding',
      infrastructure: { opaque: true }
    } as any);
    db.triggerRegistrationInstance.findMany.mockResolvedValue([instance]);
    invocation.renewWebhook.mockResolvedValue(
      success({
        webhookRegistrationIdentifier: 'new',
        webhookRegistrationPayload: {},
        routingKeys: ['resource-b']
      })
    );
    db.triggerWebhookRenewalResult.upsert.mockImplementation(
      async ({ create }: any) => create
    );
    await run('shub/trg/whk/renew/1', { targetId: 'target' });
    expect(invocation.renewWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ infrastructure: { opaque: true } })
    );
    expect(db.triggerDeliveryRoute.deleteMany).toHaveBeenCalledWith({
      where: { webhookRegistrationOid: 6n }
    });
    expect(db.triggerDeliveryRoute.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          bindingId: 'binding',
          routingKey: 'resource-b',
          webhookRegistrationOid: 6n
        })
      ],
      skipDuplicates: true
    });
  });
});

describe('mapped event recovery', () => {
  it('retries persisted mapped events even after their raw event was removed', async () => {
    await import('./dispatch');
    db.triggerEventDispatch.findMany.mockResolvedValue([
      { eventOid: 12n, event: { id: 'mapped-event' } }
    ]);
    await run('shub/trg/mapped/dispatch/1', { cutoff: new Date().toISOString() });
    expect(queues.get('shub/trg/evt/process/1').addManyWithOps).toHaveBeenCalledWith([
      { data: { eventId: 'mapped-event' }, opts: { id: 'mapped-event' } }
    ]);
    expect(db.triggerEventDispatch.deleteMany).not.toHaveBeenCalled();
  });
});
