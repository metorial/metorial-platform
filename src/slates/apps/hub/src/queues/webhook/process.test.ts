import { beforeEach, describe, expect, it, vi } from 'vitest';

let queues = new Map<string, any>();
let webhookEvents = {
  getById: vi.fn(),
  beginAttempt: vi.fn(),
  recordInvocation: vi.fn(),
  resolveRetryableFailure: vi.fn(),
  resolveNonRetryableFailure: vi.fn(),
  resolveSuccess: vi.fn(),
  setSlateResponse: vi.fn(),
  trySetResponseOverride: vi.fn(),
  markSkipped: vi.fn()
};
let routingDrops = { recordDrop: vi.fn() };
let routingMatchers = { matchWebhookEvents: vi.fn() };
let invocation = { createInvocation: vi.fn(), processWebhookRequest: vi.fn() };
let decrypt = vi.fn();
let publishResolved = vi.fn();
let createRawEvents = vi.fn();
let createExpansionInbox = vi.fn();
let offloadQueue = { add: vi.fn() };
let db = {
  triggerRegistrationWebhook: { findMany: vi.fn() },
  slateWebhookEvent: { deleteMany: vi.fn() }
};

vi.mock('@slates/proto', () => ({ SLATES_WEBHOOK_ERROR_DEFAULTS: {} }));
vi.mock('@lowerdeck/queue', () => ({
  createQueue: ({ name }: { name: string }) => {
    let queue = {
      add: vi.fn(),
      process: (handler: any) => {
        queue.handler = handler;
        return queue;
      },
      handler: null as any
    };
    queues.set(name, queue);
    return queue;
  }
}));
vi.mock('../../db', () => ({ db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://unused' } } }));
vi.mock('../../internal', () => ({
  slateWebhookEventServiceInternal: webhookEvents,
  triggerRoutingDropServiceInternal: routingDrops,
  triggerRoutingMatcherServiceInternal: routingMatchers
}));
vi.mock('../../lib/slateVersion', () => ({
  getLatestSlateVersionSupportingTriggerGroup: vi.fn(async () => ({ id: 'version' }))
}));
vi.mock('../../lib/webhookEventBus', () => ({ publishWebhookEventResolved: publishResolved }));
vi.mock('../../services', () => ({
  secretService: { DANGEROUSLY_decryptSecret: decrypt },
  slateInvocationService: invocation
}));
vi.mock('../../services/tenant', () => ({ globalTenant: { oid: 0n } }));
vi.mock('../trigger/_rawEvent', () => ({ createTriggerRawEvents: createRawEvents }));
vi.mock('../trigger/webhookExpand', () => ({
  createWebhookExpansionInbox: createExpansionInbox
}));
vi.mock('./payloadOffload', () => ({ webhookEventPayloadOffloadQueue: offloadQueue }));

let event: any;
let run = () =>
  queues.get('shub/whk/process').handler(
    { webhookEventId: event.id },
    {
      attemptsMade: 0,
      opts: { attempts: 25 }
    }
  );
let succeed = (data: any) =>
  invocation.processWebhookRequest.mockResolvedValue({
    status: 'success',
    invocation: { oid: 20n },
    data
  });

beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  queues.clear();

  event = {
    id: 'evt',
    oid: 1n,
    request: {
      method: 'POST',
      url: 'https://hub.invalid/receive/key',
      headers: {},
      body: null
    },
    webhookRegistration: {
      oid: 2n,
      secretOid: 3n,
      slate: {},
      triggerGroup: { key: 'events' },
      tenant: { oid: 4n },
      triggerWebhookTarget: null
    }
  };
  webhookEvents.getById.mockResolvedValue(event);
  webhookEvents.beginAttempt.mockResolvedValue(1);
  decrypt.mockResolvedValue({ payload: {} });
  invocation.createInvocation.mockResolvedValue({});
  routingMatchers.matchWebhookEvents.mockResolvedValue([]);
  createRawEvents.mockResolvedValue({ hadCandidates: false, hasRemainingCandidates: false });

  await import('./process');
});

describe('processWebhookEventQueue - skipped events', () => {
  it('marks the event skipped when the integration says so and answers with a plain 200', async () => {
    succeed({
      events: [],
      response: { status: 401, headers: {}, body: null },
      skipped: { reason: 'invalid_signature' }
    });

    await run();

    expect(webhookEvents.setSlateResponse).toHaveBeenCalledWith({
      eventOid: 1n,
      response: { status: 401, headers: {}, body: null }
    });
    expect(webhookEvents.markSkipped).toHaveBeenCalledWith({
      eventOid: 1n,
      reason: 'invalid_signature'
    });
    expect(webhookEvents.trySetResponseOverride).toHaveBeenCalledWith({
      eventOid: 1n,
      override: { webhookEventId: 'evt' }
    });
    expect(webhookEvents.resolveSuccess).toHaveBeenCalledWith({ eventOid: 1n });
    expect(publishResolved).toHaveBeenCalledWith('evt');
    expect(offloadQueue.add).toHaveBeenCalledWith({ webhookEventId: 'evt' });
    expect(createRawEvents).not.toHaveBeenCalled();
    expect(routingMatchers.matchWebhookEvents).not.toHaveBeenCalled();
  });

  it('falls back to skipping when an older integration rejects with no events and a 4xx', async () => {
    succeed({ events: [], response: { status: 403, headers: {}, body: null } });

    await run();

    expect(webhookEvents.markSkipped).toHaveBeenCalledWith({
      eventOid: 1n,
      reason: 'integration_rejected_request'
    });
    expect(webhookEvents.trySetResponseOverride).toHaveBeenCalledWith({
      eventOid: 1n,
      override: { webhookEventId: 'evt' }
    });
    expect(createRawEvents).not.toHaveBeenCalled();
  });

  it('does not skip a 5xx response so the provider still sees the integration failure', async () => {
    succeed({ events: [], response: { status: 500, headers: {}, body: null } });

    await run();

    expect(webhookEvents.markSkipped).not.toHaveBeenCalled();
    expect(webhookEvents.trySetResponseOverride).not.toHaveBeenCalled();
    expect(webhookEvents.resolveSuccess).toHaveBeenCalledWith({ eventOid: 1n });
  });

  it.each([408, 425, 429])('preserves a retryable HTTP %s response', async status => {
    let response = { status, headers: { 'retry-after': '30' }, body: null };
    succeed({ events: [], response });

    await run();

    expect(webhookEvents.setSlateResponse).toHaveBeenCalledWith({ eventOid: 1n, response });
    expect(webhookEvents.markSkipped).not.toHaveBeenCalled();
    expect(webhookEvents.trySetResponseOverride).not.toHaveBeenCalled();
    expect(webhookEvents.resolveSuccess).toHaveBeenCalledWith({ eventOid: 1n });
  });

  it.each([429, 503])('retries an explicit skip with retryable HTTP %s', async status => {
    succeed({
      events: [],
      response: { status, headers: {}, body: null },
      skipped: { reason: 'verification_unavailable' }
    });

    await expect(run()).rejects.toThrow('verification_unavailable');

    expect(webhookEvents.recordInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: 'verification_unavailable' })
    );
    expect(webhookEvents.resolveRetryableFailure).toHaveBeenCalledWith({
      eventOid: 1n,
      isFinalAttempt: false
    });
    expect(webhookEvents.markSkipped).not.toHaveBeenCalled();
    expect(webhookEvents.resolveSuccess).not.toHaveBeenCalled();
    expect(publishResolved).not.toHaveBeenCalled();
    expect(offloadQueue.add).not.toHaveBeenCalled();
  });

  it('finalizes a retryable explicit skip on the last attempt', async () => {
    succeed({
      events: [],
      response: { status: 503, headers: {}, body: null },
      skipped: { reason: 'verification_unavailable' }
    });

    await queues
      .get('shub/whk/process')
      .handler({ webhookEventId: event.id }, { attemptsMade: 24, opts: { attempts: 25 } });

    expect(webhookEvents.recordInvocation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' })
    );
    expect(webhookEvents.resolveRetryableFailure).not.toHaveBeenCalled();
    expect(webhookEvents.markSkipped).toHaveBeenCalledWith({
      eventOid: 1n,
      reason: 'verification_unavailable'
    });
    expect(webhookEvents.resolveSuccess).toHaveBeenCalledWith({ eventOid: 1n });
    expect(offloadQueue.add).toHaveBeenCalledWith({ webhookEventId: 'evt' });
  });

  it('finalizes an explicit skip with a non-retryable status', async () => {
    succeed({
      events: [],
      response: { status: 401, headers: {}, body: null },
      skipped: { reason: 'duplicate_delivery' }
    });

    await run();

    expect(webhookEvents.markSkipped).toHaveBeenCalledWith({
      eventOid: 1n,
      reason: 'duplicate_delivery'
    });
    expect(webhookEvents.trySetResponseOverride).toHaveBeenCalledWith({
      eventOid: 1n,
      override: { webhookEventId: 'evt' }
    });
    expect(createRawEvents).not.toHaveBeenCalled();
  });

  it('does not skip a 2xx response without events', async () => {
    succeed({ events: [], response: { status: 200, headers: {}, body: null }, skipped: null });

    await run();

    expect(webhookEvents.markSkipped).not.toHaveBeenCalled();
    expect(webhookEvents.trySetResponseOverride).not.toHaveBeenCalled();
    expect(webhookEvents.resolveSuccess).toHaveBeenCalledWith({ eventOid: 1n });
  });

  it('does not skip when events were extracted even if the response is a 4xx', async () => {
    succeed({
      events: [{ payload: { a: 1 }, triggerIds: ['t'], matchers: [], idempotencyKey: 'k' }],
      response: { status: 400, headers: {}, body: null }
    });

    await run();

    expect(webhookEvents.markSkipped).not.toHaveBeenCalled();
    expect(routingMatchers.matchWebhookEvents).toHaveBeenCalled();
  });
});

describe('durable webhook expansion handoff', () => {
  it('persists the authenticated routed notification before resolving success', async () => {
    let payload = { delivery: 'verified' };
    succeed({ events: [{ payload, triggerIds: [], matchers: [] }], requiresExpansion: true });
    routingMatchers.matchWebhookEvents.mockResolvedValue([
      {
        event: { payload, triggerIds: [], matchers: [] },
        triggerRegistrationInstanceOids: [8n]
      }
    ]);
    createExpansionInbox.mockResolvedValue({
      hadCandidates: true,
      hasRemainingCandidates: true
    });
    await run();
    expect(createRawEvents).not.toHaveBeenCalled();
    expect(decrypt).toHaveBeenCalledWith(expect.objectContaining({ secretOid: 3n }));
    expect(createExpansionInbox).toHaveBeenCalledWith({
      webhookEventOid: 1n,
      webhookEventId: 'evt',
      webhookRegistrationOid: 2n,
      events: [expect.objectContaining({ payload, triggerRegistrationInstanceOids: [8n] })]
    });
    expect(createExpansionInbox.mock.invocationCallOrder[0]).toBeLessThan(
      webhookEvents.resolveSuccess.mock.invocationCallOrder[0]!
    );
  });

  it('does not acknowledge success if durable handoff fails', async () => {
    succeed({
      events: [{ payload: {}, triggerIds: [], matchers: [] }],
      requiresExpansion: true
    });
    createExpansionInbox.mockRejectedValue(new Error('database unavailable'));
    await expect(run()).rejects.toThrow('database unavailable');
    expect(webhookEvents.resolveSuccess).not.toHaveBeenCalled();
    expect(offloadQueue.add).not.toHaveBeenCalled();
  });
});
