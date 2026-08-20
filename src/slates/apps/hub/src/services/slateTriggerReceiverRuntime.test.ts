import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AcceptedWebhookVerificationProofAuthority,
  assertScopedInvocationIsolation,
  createScopedInvocationArtifactBoundary,
  runScopedRemoteInvocation,
  sanitizeScopedInvocationValue,
  ScopedInvocationGrantAuthority,
  type ScopedInvocationGrantBindings
} from '../lib/invocation/types';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/triggerWebhook', () => ({
  getTriggerWebhookBaseUrl: (id: string) => `https://hooks.test/triggers/${id}`,
  getReceiverWebhookBaseUrl: (id: string) => `https://hooks.test/receivers/${id}`
}));
vi.mock('../queues/trigger/eventQueues', () => ({
  slateTriggerEventInputArchiveQueue: { add: vi.fn() },
  slateTriggerEventProcessQueue: { add: vi.fn() },
  slateTriggerEventSendQueue: { add: vi.fn() },
  slateTriggerWebhookDispatchOutboxQueue: { add: vi.fn() }
}));
vi.mock('../signal', () => ({
  signal: {},
  getTenantAndSenderForSignal: vi.fn(),
  getTenantForSignal: vi.fn()
}));
vi.mock('./slateError', () => ({ slateErrorService: {} }));
vi.mock('./slateInvocation', () => ({ slateInvocationService: {} }));
vi.mock('./slateInstanceAuthHandler', () => ({ slateAuthHandlerService: {} }));
vi.mock('./slateSession', () => ({ slateSessionService: {} }));
import { db } from '../db';
import { slateInvocationService } from './slateInvocation';
import {
  negotiateWebhookCapabilityAdvertisement,
  SlateTriggerReceiverCore
} from './slateTriggerReceiverCore';
import {
  collectGraphAuthorityRecords,
  claimTelegramWebhookMutationLease,
  computeHubWebhookWireRequestHash,
  computeHubWebhookActionSpecHashV1,
  isTelegramWebhookMutationLeaseCurrent,
  releaseTelegramWebhookMutationLease,
  SlateTriggerReceiverRuntime,
  validateBootstrapProposalAuthority,
  validateHubProviderWebhookResult,
  type HubWebhookItemAdapter,
  type HubWebhookProviderRule,
  type HubWebhookWireRequest
} from './slateTriggerReceiverRuntime';
import { RegistrationLeaseLostError } from './slateTriggerReceiverRuntime';
import { slateTriggerRegistrationLifecycleService } from './slateTriggerRegistrationLifecycle';
import { slateTriggerReceiverSecretService } from './slateTriggerReceiverSecret';

afterEach(() => {
  vi.useRealTimers();
});

describe('per-trigger callback event filtering', () => {
  let callbackReceiver = {
    deliveryMode: 'callback_v2',
    eventTypes: ['legacy.receiver.filter']
  } as any;

  it('treats an empty callback trigger filter as all events for that trigger', () => {
    let core = new SlateTriggerReceiverCore();

    expect(
      core.resolveTriggerDestinations({
        receiver: callbackReceiver,
        receiverTrigger: { eventTypes: [] } as any,
        eventType: 'issue.created'
      }).shouldDeliver
    ).toBe(true);
  });

  it('uses an exact allow-list for each callback trigger', () => {
    let core = new SlateTriggerReceiverCore();
    let receiverTrigger = { eventTypes: ['issue.created'] } as any;

    expect(
      core.resolveTriggerDestinations({
        receiver: callbackReceiver,
        receiverTrigger,
        eventType: 'issue.created'
      }).shouldDeliver
    ).toBe(true);
    expect(
      core.resolveTriggerDestinations({
        receiver: callbackReceiver,
        receiverTrigger,
        eventType: 'issue.updated'
      }).shouldDeliver
    ).toBe(false);
  });

  it('keeps receiver-wide filtering for legacy delivery mode', () => {
    let core = new SlateTriggerReceiverCore();
    let receiver = {
      deliveryMode: 'legacy_signal_event',
      eventTypes: ['legacy.allowed']
    } as any;
    let receiverTrigger = { eventTypes: [] } as any;

    expect(
      core.resolveTriggerDestinations({
        receiver,
        receiverTrigger,
        eventType: 'legacy.blocked'
      }).shouldDeliver
    ).toBe(false);
  });

  it('skips persisted callback events before creating a Signal event', async () => {
    let core = new SlateTriggerReceiverCore();
    let createSignalEvent = vi
      .spyOn(core, 'createSignalEvent')
      .mockResolvedValue('signal-event');
    let update = vi.fn(async () => ({}));
    (db as any).slateTriggerEvent = { update };
    (db as any).$transaction = vi.fn();

    await core.dispatchTriggerEvent({
      receiverTrigger: {
        eventTypes: ['issue.created'],
        receiver: { ...callbackReceiver, eventTypes: [] }
      } as any,
      action: { id: 'trigger-1', key: 'issues' } as any,
      event: {
        oid: 1n,
        id: 'event-1',
        type: 'issue.updated',
        sourceId: 'source-1',
        input: null,
        output: {},
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
        signalEventId: ''
      }
    });

    expect(update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { deliveryStatus: 'skipped' }
    });
    expect(createSignalEvent).not.toHaveBeenCalled();
    expect((db as any).$transaction).not.toHaveBeenCalled();
  });

  it('keeps a filtered persisted event retryable until its callback lifecycle is recorded', async () => {
    let core = new SlateTriggerReceiverCore();
    let update = vi.fn(async () => ({}));
    (db as any).slateTriggerEvent = { update };
    let recordLifecycle = vi
      .spyOn(core, 'recordCallbackEventLifecycle')
      .mockRejectedValueOnce(new Error('lifecycle unavailable'))
      .mockResolvedValueOnce(null as any);
    let input = {
      receiverTrigger: {
        eventTypes: ['issue.created'],
        receiver: { ...callbackReceiver, eventTypes: [] }
      } as any,
      action: { id: 'trigger-1', key: 'issues' } as any,
      event: {
        oid: 1n,
        id: 'event-1',
        type: 'issue.updated',
        sourceId: 'source-1',
        input: null,
        output: {},
        createdAt: new Date('2026-08-20T00:00:00.000Z'),
        signalEventId: ''
      }
    };

    await expect(core.dispatchTriggerEvent(input)).rejects.toThrow('lifecycle unavailable');
    expect(update).not.toHaveBeenCalled();

    await expect(core.dispatchTriggerEvent(input)).resolves.toBeUndefined();
    expect(recordLifecycle).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({
      where: { oid: 1n },
      data: { deliveryStatus: 'skipped' }
    });
  });

  it('records an ordinary filtered mapped event as skipped without creating Signal delivery', async () => {
    let action = { oid: 4n, id: 'trigger-action-1', key: 'issues' } as any;
    let receiver = {
      oid: 2n,
      id: 'receiver-1',
      status: 'active',
      deliveryMode: 'callback_v2',
      eventTypes: [],
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-1',
      slate: { oid: 5n },
      slateInstance: { oid: 6n }
    } as any;
    let receiverTrigger = {
      oid: 3n,
      id: 'receiver-trigger-1',
      actionOid: action.oid,
      eventTypes: ['issue.created'],
      action,
      receiver
    } as any;
    let eventInput = {
      oid: 1n,
      id: 'event-input-1',
      status: 'pending',
      attemptCount: 0,
      input: { value: true },
      webhookDispatchOutbox: null,
      receiverTrigger
    } as any;
    let createdEvent = { oid: 7n, id: 'event-1' };
    let eventInputUpdate = vi.fn(async () => ({}));
    (db as any).slateTriggerEventInput = {
      findFirst: vi.fn(async () => eventInput),
      update: eventInputUpdate
    };
    (db as any).slateTriggerReceiver = { update: vi.fn(async () => ({})) };
    (db as any).slateTriggerEvent = {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => createdEvent)
    };

    let core = new SlateTriggerReceiverCore();
    vi.spyOn(core, 'getInvocationContext').mockResolvedValue({
      action,
      version: {},
      config: {},
      auth: {}
    } as any);
    vi.spyOn(core, 'createInvocationStack').mockResolvedValue({} as any);
    vi.spyOn(core, 'recordTriggerInvocation').mockResolvedValue(undefined);
    let recordLifecycle = vi
      .spyOn(core, 'recordCallbackEventLifecycle')
      .mockResolvedValue(null as any);
    let createSignalEvent = vi
      .spyOn(core, 'createSignalEvent')
      .mockResolvedValue('signal-event');
    let previousMapper = (slateInvocationService as any).invokeTriggerMapper;
    (slateInvocationService as any).invokeTriggerMapper = vi.fn(async () => ({
      status: 'success',
      invocation: { oid: 8n },
      data: {
        id: 'source-1',
        type: 'issue.updated',
        output: { issue: 1 }
      }
    }));

    try {
      await new SlateTriggerReceiverRuntime(core).processTriggerEventInput({
        eventInputId: eventInput.id
      });
    } finally {
      (slateInvocationService as any).invokeTriggerMapper = previousMapper;
    }

    expect(createSignalEvent).not.toHaveBeenCalled();
    expect(recordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ status: 'skipped' }) })
    );
    expect(recordLifecycle).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ status: 'succeeded' }) })
    );
    expect((db as any).slateTriggerEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'issue.updated',
        deliveryStatus: 'skipped',
        signalEventId: ''
      })
    });
  });

  it('terminalizes a filtered webhook outbox without building or enqueueing Signal delivery', async () => {
    let action = { oid: 14n, id: 'trigger-action-2', key: 'issues' } as any;
    let receiver = {
      oid: 12n,
      id: 'receiver-2',
      status: 'active',
      deliveryMode: 'callback_v2',
      eventTypes: [],
      callbackId: 'callback-2',
      callbackInstanceId: 'callback-instance-2',
      slate: { oid: 15n },
      slateInstance: { oid: 16n }
    } as any;
    let receiverTrigger = {
      oid: 13n,
      id: 'receiver-trigger-2',
      actionOid: action.oid,
      eventTypes: ['issue.created'],
      action,
      receiver
    } as any;
    let webhookDispatchOutbox = {
      oid: 17n,
      id: 'outbox-1',
      status: 'pending',
      localEventId: 'local-event-1',
      localSourceId: 'local-source-1'
    };
    let eventInput = {
      oid: 11n,
      id: 'event-input-2',
      status: 'pending',
      attemptCount: 0,
      input: { value: true },
      webhookDispatchOutbox,
      receiverTrigger
    } as any;
    let outboxUpdate = vi.fn(async () => ({ count: 1 }));
    let replayUpdate = vi.fn(async () => ({ count: 1 }));
    let eventCreate = vi.fn(async () => ({ oid: 18n, id: 'local-event-1' }));
    let eventInputUpdate = vi.fn(async () => ({}));
    let transactionStore = {
      slateTriggerWebhookDispatchOutbox: {
        findUniqueOrThrow: vi.fn(async () => webhookDispatchOutbox),
        updateMany: outboxUpdate
      },
      slateTriggerWebhookReplayClaim: { updateMany: replayUpdate },
      slateTriggerEvent: { create: eventCreate },
      slateTriggerEventInput: { update: eventInputUpdate }
    };
    (db as any).$transaction = vi.fn(
      async (operation: (tx: typeof transactionStore) => Promise<unknown>) =>
        await operation(transactionStore)
    );
    (db as any).slateTriggerEventInput = {
      findFirst: vi.fn(async () => eventInput),
      update: eventInputUpdate
    };
    (db as any).slateTriggerReceiver = { update: vi.fn(async () => ({})) };
    (db as any).slateTriggerEvent = { findFirst: vi.fn(async () => null) };

    let core = new SlateTriggerReceiverCore();
    vi.spyOn(core, 'getInvocationContext').mockResolvedValue({
      action,
      version: {},
      config: {},
      auth: {}
    } as any);
    vi.spyOn(core, 'createInvocationStack').mockResolvedValue({} as any);
    vi.spyOn(core, 'recordTriggerInvocation').mockResolvedValue(undefined);
    let recordLifecycle = vi
      .spyOn(core, 'recordCallbackEventLifecycle')
      .mockResolvedValue(null as any);
    let buildSignalRequest = vi.spyOn(core, 'buildIdempotentSignalEventRequest');
    let previousMapper = (slateInvocationService as any).invokeTriggerMapper;
    (slateInvocationService as any).invokeTriggerMapper = vi.fn(async () => ({
      status: 'success',
      invocation: { oid: 19n },
      data: {
        id: 'provider-source-ignored',
        type: 'issue.updated',
        output: { issue: 2 }
      }
    }));

    try {
      await new SlateTriggerReceiverRuntime(core).processTriggerEventInput({
        eventInputId: eventInput.id
      });
    } finally {
      (slateInvocationService as any).invokeTriggerMapper = previousMapper;
    }

    expect(buildSignalRequest).not.toHaveBeenCalled();
    expect(outboxUpdate).toHaveBeenCalledWith({
      where: {
        oid: webhookDispatchOutbox.oid,
        status: { in: ['pending', 'retryable', 'leased'] }
      },
      data: expect.objectContaining({
        status: 'delivered',
        safeTerminalCode: 'event_type_filtered'
      })
    });
    expect(replayUpdate).toHaveBeenCalledWith({
      where: { eventInputOid: eventInput.oid },
      data: { status: 'delivered', leaseExpiresAt: null }
    });
    expect(eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ deliveryStatus: 'skipped', signalEventId: '' })
    });
    expect(recordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ status: 'skipped' }) })
    );
  });
});

let wireRequest: HubWebhookWireRequest = {
  url: 'https://hooks.test/inbound',
  method: 'OPTIONS',
  headers: [
    ['X-Duplicate', 'one'],
    ['X-Duplicate', 'two']
  ],
  body: { present: true, base64: Buffer.from([0, 255, 1]).toString('base64') }
};

describe('inactive webhook trigger routing', () => {
  let receiverFixture = () => {
    let action = (key: string) => ({
      id: key,
      key,
      spec: {
        type: 'action.trigger',
        invocation: {
          type: 'webhook',
          autoRegistration: false,
          autoUnregistration: false,
          http: { methods: ['POST'] }
        }
      }
    });
    let trigger = (id: string, overrides: Record<string, unknown> = {}) => ({
      oid: BigInt(id.length),
      id,
      source: 'webhook',
      tombstonedAt: null,
      ingressDisabledAt: null,
      action: action(id),
      ...overrides
    });
    let receiver: any = {
      oid: 1n,
      id: 'receiver',
      status: 'active',
      triggers: [
        trigger('old-tombstoned', {
          tombstonedAt: new Date('2030-01-01T00:00:00.000Z')
        }),
        trigger('old-disabled', {
          ingressDisabledAt: new Date('2030-01-01T00:00:00.000Z')
        }),
        trigger('active-replacement')
      ]
    };
    return receiver;
  };

  it('fans legacy and captured receiver webhooks out only to the active replacement', async () => {
    let receiver = receiverFixture();
    (db as any).slateTriggerReceiver = {
      findFirst: vi.fn(async () => receiver)
    };
    let runtime = new SlateTriggerReceiverRuntime({} as any);
    let legacyHandle = vi.fn(async () => ({ status: 'handled' }));
    let capturedHandle = vi.fn(async () => ({
      status: 'rejected',
      code: 'no_matching_rule'
    }));
    (runtime as any).handleWebhookForReceiverTrigger = legacyHandle;
    (runtime as any).executeCapturedExactWebhook = capturedHandle;

    await runtime.handleReceiverWebhook({
      receiverId: receiver.id,
      request: {
        url: 'https://hooks.test/receiver',
        method: 'POST',
        headers: {},
        body: null
      }
    });
    await runtime.handleCapturedReceiverWebhook({
      receiverId: receiver.id,
      request: wireRequest
    });

    expect(legacyHandle).toHaveBeenCalledOnce();
    expect(legacyHandle.mock.calls[0]![0].receiverTrigger.id).toBe('active-replacement');
    expect(capturedHandle).toHaveBeenCalledOnce();
    expect(
      capturedHandle.mock.calls[0]![0].receiverTriggers.map((trigger: any) => trigger.id)
    ).toEqual(['active-replacement']);
  });

  it.each(['tombstonedAt', 'ingressDisabledAt'] as const)(
    'rejects an exact captured webhook when %s is set',
    async inactiveField => {
      let receiver = receiverFixture();
      let receiverTrigger = {
        ...receiver.triggers[2],
        [inactiveField]: new Date('2030-01-01T00:00:00.000Z'),
        receiver
      };
      let runtime = new SlateTriggerReceiverRuntime({
        getReceiverTriggerWithRelations: vi.fn(async () => receiverTrigger)
      } as any);
      let execute = vi.fn();
      (runtime as any).executeCapturedExactWebhook = execute;

      await expect(
        runtime.handleCapturedTriggerWebhook({
          receiverTriggerId: receiverTrigger.id,
          request: wireRequest
        })
      ).resolves.toEqual({
        status: 'rejected',
        code: 'routing_projection_unavailable'
      });
      expect(execute).not.toHaveBeenCalled();
    }
  );
});

let itemAdapter: HubWebhookItemAdapter = {
  id: 'graph.body_value.v1',
  candidates: [
    {
      candidateId: 'candidate-1',
      index: 0,
      bindingHash: 'a'.repeat(64),
      deliveryIds: ['delivery-1']
    },
    {
      candidateId: 'candidate-2',
      index: 1,
      bindingHash: 'b'.repeat(64),
      deliveryIds: ['delivery-2']
    }
  ]
};

describe('Telegram receiver-wide mutation authority', () => {
  let installReceiverStore = (initial?: Partial<Record<string, unknown>>) => {
    let state: any = {
      oid: 41n,
      id: 'telegram-receiver',
      telegramWebhookMutationVersion: 0,
      telegramWebhookGeneration: 3,
      telegramWebhookRemoteKnown: true,
      telegramWebhookRefCount: 2,
      telegramWebhookAllowedUpdates: ['message'],
      telegramWebhookUrl: 'https://hooks.test/receivers/telegram-receiver',
      telegramWebhookSecretFingerprint: 'a'.repeat(64),
      telegramWebhookLeaseToken: null,
      telegramWebhookLeaseExpiresAt: null,
      ...initial
    };
    let receiverStore = {
      findUniqueOrThrow: vi.fn(async () => ({
        oid: state.oid,
        id: state.id,
        telegramWebhookMutationVersion: state.telegramWebhookMutationVersion,
        telegramWebhookGeneration: state.telegramWebhookGeneration,
        telegramWebhookRemoteKnown: state.telegramWebhookRemoteKnown,
        telegramWebhookRefCount: state.telegramWebhookRefCount,
        telegramWebhookAllowedUpdates: [...state.telegramWebhookAllowedUpdates],
        telegramWebhookUrl: state.telegramWebhookUrl,
        telegramWebhookSecretFingerprint: state.telegramWebhookSecretFingerprint
      })),
      findFirst: vi.fn(async ({ where }: any) => {
        let ref = where.telegramWebhookRefCount;
        let refMatches =
          !ref ||
          (ref.gt !== undefined && state.telegramWebhookRefCount > ref.gt) ||
          (ref.lte !== undefined && state.telegramWebhookRefCount <= ref.lte);
        return state.oid === where.oid &&
          state.telegramWebhookLeaseToken === where.telegramWebhookLeaseToken &&
          state.telegramWebhookMutationVersion === where.telegramWebhookMutationVersion &&
          state.telegramWebhookGeneration === where.telegramWebhookGeneration &&
          (where.telegramWebhookRemoteKnown === undefined ||
            state.telegramWebhookRemoteKnown === where.telegramWebhookRemoteKnown) &&
          refMatches
          ? { oid: state.oid }
          : null;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let leaseAvailable =
          state.telegramWebhookLeaseToken === null ||
          (state.telegramWebhookLeaseExpiresAt instanceof Date &&
            state.telegramWebhookLeaseExpiresAt <=
              (where.OR?.[1]?.telegramWebhookLeaseExpiresAt?.lte ?? new Date(0)));
        let matches =
          state.oid === where.oid &&
          state.telegramWebhookMutationVersion === where.telegramWebhookMutationVersion &&
          (where.telegramWebhookLeaseToken === undefined ||
            state.telegramWebhookLeaseToken === where.telegramWebhookLeaseToken) &&
          (where.OR === undefined || leaseAvailable);
        if (!matches) return { count: 0 };
        if (data.telegramWebhookMutationVersion?.increment) {
          state.telegramWebhookMutationVersion +=
            data.telegramWebhookMutationVersion.increment;
        }
        if ('telegramWebhookLeaseToken' in data) {
          state.telegramWebhookLeaseToken = data.telegramWebhookLeaseToken;
        }
        if ('telegramWebhookLeaseExpiresAt' in data) {
          state.telegramWebhookLeaseExpiresAt = data.telegramWebhookLeaseExpiresAt;
        }
        return { count: 1 };
      })
    };
    (db as any).slateTriggerReceiver = receiverStore;
    (db as any).slateTriggerReceiverSecret = {
      aggregate: vi.fn(async () => ({
        _max: { secretVersion: state.telegramWebhookGeneration }
      }))
    };
    return { state, receiverStore };
  };

  it('permits exactly one concurrent worker and rejects stale token/version authority', async () => {
    let { state } = installReceiverStore();
    let attempts = await Promise.allSettled([
      claimTelegramWebhookMutationLease('telegram-receiver'),
      claimTelegramWebhookMutationLease('telegram-receiver')
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);
    let lease = (attempts.find(result => result.status === 'fulfilled') as any).value;
    await expect(isTelegramWebhookMutationLeaseCurrent(lease)).resolves.toBe(true);
    await expect(
      isTelegramWebhookMutationLeaseCurrent({ ...lease, token: 'stale-worker' })
    ).resolves.toBe(false);
    await releaseTelegramWebhookMutationLease({ ...lease, token: 'stale-worker' });
    expect(state.telegramWebhookLeaseToken).toBe(lease.token);
    await releaseTelegramWebhookMutationLease(lease);
    expect(state.telegramWebhookLeaseToken).toBeNull();
  });

  it('reclaims only expired leases and enforces exact final/non-final refcount CAS', async () => {
    let now = new Date('2030-01-01T00:00:00.000Z');
    let { state } = installReceiverStore({
      telegramWebhookMutationVersion: 8,
      telegramWebhookLeaseToken: 'expired-worker',
      telegramWebhookLeaseExpiresAt: new Date(now.getTime() - 1)
    });
    let lease = await claimTelegramWebhookMutationLease('telegram-receiver', now);
    expect(lease.mutationVersion).toBe(9);
    await expect(isTelegramWebhookMutationLeaseCurrent(lease, 'non_final')).resolves.toBe(
      true
    );
    await expect(isTelegramWebhookMutationLeaseCurrent(lease, 'final')).resolves.toBe(false);
    state.telegramWebhookRefCount = 1;
    await expect(isTelegramWebhookMutationLeaseCurrent(lease, 'final')).resolves.toBe(true);

    installReceiverStore({
      telegramWebhookLeaseToken: 'fresh-worker',
      telegramWebhookLeaseExpiresAt: new Date(now.getTime() + 1)
    });
    await expect(claimTelegramWebhookMutationLease('telegram-receiver', now)).rejects.toThrow(
      'telegram_webhook_lease_busy'
    );
  });

  it('programs one receiver URL/token with the exact attached-trigger union and commits singleton authority', async () => {
    let secretToken = 'receiver-wide-secret';
    let secretFingerprint = createHash('sha256').update(secretToken, 'utf8').digest('hex');
    let { state } = installReceiverStore({
      telegramWebhookSecretFingerprint: secretFingerprint
    });
    state.telegramWebhookLeaseToken = 'lease-token';
    state.telegramWebhookMutationVersion = 4;
    let actionContract: any = {
      id: 'message_received',
      type: 'action.trigger',
      capabilities: { webhookAutoRegistrationV1: true },
      invocation: {
        type: 'webhook',
        autoRegistration: true,
        autoUnregistration: true,
        http: {
          methods: ['POST'],
          ingress: {
            kind: 'receiver_route',
            baseline: 'receiver_path_secret',
            verification: {
              mechanism: 'hub',
              baseline: 'receiver_path_secret',
              allowedSecretRefs: [
                {
                  source: 'registration',
                  name: 'telegram_secret_token',
                  registrationKey: 'secretToken',
                  encoding: 'utf8'
                }
              ],
              rules: []
            }
          }
        }
      }
    };
    actionContract.specHash = computeHubWebhookActionSpecHashV1(actionContract);
    let sibling: any = {
      id: 'callback-trigger',
      source: 'webhook',
      tombstonedAt: null,
      remoteRegistrationKnown: true,
      registrationStatus: 'registered',
      action: { key: 'callback_query_received' }
    };
    let receiverTrigger: any = {
      oid: 51n,
      id: 'message-trigger',
      source: 'webhook',
      tombstonedAt: null,
      remoteRegistrationKnown: false,
      registrationStatus: 'registering',
      registrationGeneration: 4,
      registrationVersion: 7,
      state: {},
      action: { key: 'message_received', spec: actionContract },
      receiver: {
        id: 'telegram-receiver',
        slate: {
          slateIdentifierOnRegistry: 'telegram',
          slateIdOnRegistry: 'telegram'
        },
        triggers: [] as any[]
      }
    };
    receiverTrigger.receiver.triggers = [receiverTrigger, sibling];
    let authority: any = {
      receiverTrigger,
      version: {},
      actionId: 'message_received',
      actionContract,
      specHash: actionContract.specHash,
      registrationStatus: 'registering',
      registrationGeneration: 4,
      registrationVersion: 7,
      capturedSecretVersions: { telegram_secret_token: 9 }
    };
    let register = vi.fn(async () => ({
      status: 'success',
      invocation: { oid: 1n },
      data: {
        registrationDetails: {
          secretToken,
          allowedUpdates: ['callback_query', 'message']
        },
        capturedSecrets: {
          telegram_secret_token: { value: secretToken, version: 3 }
        }
      }
    }));
    let commit = vi.fn(async () => 'committed');
    let previousRegister = (slateInvocationService as any).registerWebhook;
    let previousResolve = (slateTriggerReceiverSecretService as any)
      .resolveRegistrationDetails;
    let previousCommit = (slateTriggerReceiverSecretService as any).commitRegistrationResult;
    (slateInvocationService as any).registerWebhook = register;
    (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = vi.fn(
      async () => ({ secretToken, allowedUpdates: ['callback_query'] })
    );
    (slateTriggerReceiverSecretService as any).commitRegistrationResult = commit;
    let core: any = {
      getInvocationContext: vi.fn(async () => ({
        action: receiverTrigger.action,
        version: {},
        config: {},
        auth: {}
      })),
      negotiateWebhookCapabilities: vi.fn(async () => ({
        registration: { status: 'v1' },
        verification: { status: 'v1' },
        bootstrapCapture: { status: 'v1' }
      })),
      security: {
        webhookAuthorityResolver: {
          resolveRegistration: vi.fn(async () => authority)
        }
      },
      createInvocationStack: vi.fn(async () => ({})),
      recordTriggerInvocation: vi.fn(async () => {})
    };
    try {
      await new SlateTriggerReceiverRuntime(core).registerWebhookForReceiverTrigger({
        receiverTrigger,
        claim: {
          receiverTriggerId: receiverTrigger.id,
          registrationGeneration: 4,
          registrationTransitionVersion: 3,
          registrationLeaseToken: 'registration-lease',
          registrationLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z'),
          intent: 'register',
          status: 'registering'
        },
        telegramLease: {
          receiverOid: 41n,
          receiverId: 'telegram-receiver',
          token: 'lease-token',
          mutationVersion: 4,
          generation: 3,
          remoteKnown: true,
          refCount: 1,
          allowedUpdates: ['callback_query'],
          webhookUrl: 'https://hooks.test/receivers/telegram-receiver',
          secretFingerprint
        }
      });
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookBaseUrl: 'https://hooks.test/receivers/telegram-receiver',
          registrationDetails: expect.objectContaining({
            secretToken,
            allowedUpdates: expect.arrayContaining([
              'callback_query',
              'message',
              'edited_message'
            ]),
            singletonGeneration: 3,
            rotateSecret: false
          }),
          capturedSecretVersions: { telegram_secret_token: 3 }
        })
      );
      expect(commit).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramAuthority: expect.objectContaining({
            generation: 3,
            refCount: 2,
            webhookUrl: 'https://hooks.test/receivers/telegram-receiver',
            secretFingerprint
          })
        })
      );
    } finally {
      (slateInvocationService as any).registerWebhook = previousRegister;
      (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = previousResolve;
      (slateTriggerReceiverSecretService as any).commitRegistrationResult = previousCommit;
    }
  });

  it.each([
    'lease_loss',
    'cancellation',
    'record_failure',
    'validation_failure',
    'transaction_throw',
    'stale_cas',
    'cleanup_retry'
  ] as const)('compensates a successful Telegram setWebhook after %s', async failure => {
    let { state } = installReceiverStore({
      telegramWebhookMutationVersion: 1,
      telegramWebhookGeneration: 0,
      telegramWebhookRemoteKnown: false,
      telegramWebhookRefCount: 0,
      telegramWebhookAllowedUpdates: [],
      telegramWebhookUrl: null,
      telegramWebhookSecretFingerprint: null,
      telegramWebhookLeaseToken: 'create-lease',
      telegramWebhookLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z')
    });
    let actionContract: any = {
      id: 'message_received',
      type: 'action.trigger',
      capabilities: { webhookAutoRegistrationV1: true },
      invocation: {
        type: 'webhook',
        autoRegistration: true,
        autoUnregistration: true,
        http: {
          methods: ['POST'],
          ingress: {
            kind: 'receiver_route',
            baseline: 'receiver_path_secret',
            verification: {
              mechanism: 'hub',
              baseline: 'receiver_path_secret',
              allowedSecretRefs: [
                {
                  source: 'registration',
                  name: 'telegram_secret_token',
                  registrationKey: 'secretToken',
                  encoding: 'utf8'
                }
              ],
              rules: []
            }
          }
        }
      }
    };
    actionContract.specHash = computeHubWebhookActionSpecHashV1(actionContract);
    let receiverTrigger: any = {
      oid: 51n,
      id: 'message-trigger',
      source: 'webhook',
      tombstonedAt: null,
      remoteRegistrationKnown: false,
      registrationStatus: 'registering',
      registrationGeneration: 1,
      registrationVersion: 1,
      state: {},
      action: { key: 'message_received', spec: actionContract },
      receiver: {
        oid: 41n,
        id: 'telegram-receiver',
        slate: {
          slateIdentifierOnRegistry: 'telegram',
          slateIdOnRegistry: 'telegram'
        },
        triggers: [] as any[]
      }
    };
    receiverTrigger.receiver.triggers = [receiverTrigger];
    let authority: any = {
      receiverTrigger,
      version: {},
      actionId: 'message_received',
      actionContract,
      specHash: actionContract.specHash,
      registrationStatus: 'registering',
      registrationGeneration: 1,
      registrationVersion: 1,
      capturedSecretVersions: { telegram_secret_token: 1 }
    };
    let remoteCreated = false;
    let register = vi.fn(async () => {
      remoteCreated = true;
      return {
        status: 'success',
        invocation: { oid: 1n },
        data: {
          registrationDetails: {
            secretToken: 'new-token',
            singletonGeneration: 1
          },
          capturedSecrets: {
            telegram_secret_token: {
              value: 'new-token',
              version: failure === 'validation_failure' ? 2 : 1
            }
          }
        }
      };
    });
    let cleanupAttempts = 0;
    let unregister = vi.fn(async () => {
      cleanupAttempts++;
      return {
        status: failure === 'cleanup_retry' && cleanupAttempts === 1 ? 'error' : 'success',
        invocation: { oid: BigInt(cleanupAttempts + 1) },
        data: {}
      };
    });
    let commit = vi.fn(async () => {
      if (failure === 'transaction_throw' || failure === 'cleanup_retry') {
        throw new Error('injected transaction throw');
      }
      return failure === 'stale_cas' ? 'stale' : 'committed';
    });
    let previousRegister = (slateInvocationService as any).registerWebhook;
    let previousUnregister = (slateInvocationService as any).unregisterWebhook;
    let previousCommit = (slateTriggerReceiverSecretService as any).commitRegistrationResult;
    (slateInvocationService as any).registerWebhook = register;
    (slateInvocationService as any).unregisterWebhook = unregister;
    (slateTriggerReceiverSecretService as any).commitRegistrationResult = commit;
    let record = vi.fn(async ({ type }: any) => {
      if (failure === 'record_failure' && type === 'webhook_register') {
        throw new Error('injected invocation record failure');
      }
    });
    let core: any = {
      getReceiverTriggerWithRelations: vi.fn(async () => receiverTrigger),
      getInvocationContext: vi.fn(async () => ({
        action: receiverTrigger.action,
        version: {},
        config: {},
        auth: {}
      })),
      negotiateWebhookCapabilities: vi.fn(async () => ({
        registration: { status: 'v1' },
        verification: { status: 'v1' },
        bootstrapCapture: { status: 'v1' }
      })),
      security: {
        webhookAuthorityResolver: {
          resolveRegistration: vi.fn(async () => authority)
        }
      },
      createInvocationStack: vi.fn(async () => ({})),
      recordTriggerInvocation: record
    };
    try {
      await expect(
        new SlateTriggerReceiverRuntime(core).registerWebhookForReceiverTrigger({
          receiverTrigger,
          claim: {
            receiverTriggerId: receiverTrigger.id,
            registrationGeneration: 1,
            registrationTransitionVersion: 1,
            registrationLeaseToken: 'registration-lease',
            registrationLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z'),
            intent: 'register',
            status: 'registering'
          },
          telegramLease: {
            receiverOid: 41n,
            receiverId: 'telegram-receiver',
            token: 'create-lease',
            mutationVersion: 1,
            generation: 0,
            remoteKnown: false,
            refCount: 0,
            allowedUpdates: [],
            webhookUrl: null,
            secretFingerprint: null
          },
          assertLeaseOwned: () => {
            if (remoteCreated && failure === 'lease_loss') {
              throw new RegistrationLeaseLostError();
            }
            if (remoteCreated && failure === 'cancellation') {
              throw new Error('operation cancelled');
            }
          }
        })
      ).rejects.toThrow();
      expect(register).toHaveBeenCalledOnce();
      expect(unregister).toHaveBeenCalledTimes(failure === 'cleanup_retry' ? 2 : 1);
      expect(unregister).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookBaseUrl: 'https://hooks.test/receivers/telegram-receiver',
          registrationDetails: null
        })
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'webhook_unregister' })
      );
      expect(state.telegramWebhookRefCount).toBe(0);
      expect(state.telegramWebhookLeaseToken).toBeNull();
    } finally {
      (slateInvocationService as any).registerWebhook = previousRegister;
      (slateInvocationService as any).unregisterWebhook = previousUnregister;
      (slateTriggerReceiverSecretService as any).commitRegistrationResult = previousCommit;
    }
  });

  it('durably decrements each detach once and only the 1->0 winner deletes upstream', async () => {
    let secretToken = 'receiver-wide-secret';
    let secretFingerprint = createHash('sha256').update(secretToken, 'utf8').digest('hex');
    let action = (key: string) => ({
      key,
      spec: {
        id: key,
        type: 'action.trigger',
        invocation: {
          type: 'webhook',
          autoRegistration: true,
          autoUnregistration: true,
          http: {}
        }
      }
    });
    let receiver: any = {
      oid: 41n,
      id: 'telegram-receiver',
      telegramWebhookMutationVersion: 4,
      telegramWebhookGeneration: 3,
      telegramWebhookRemoteKnown: true,
      telegramWebhookRefCount: 2,
      telegramWebhookAllowedUpdates: ['callback_query', 'message'],
      telegramWebhookUrl: 'https://hooks.test/receivers/telegram-receiver',
      telegramWebhookSecretFingerprint: secretFingerprint,
      telegramWebhookLeaseToken: 'lease-a',
      telegramWebhookLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z'),
      slate: {
        slateIdentifierOnRegistry: 'telegram',
        slateIdOnRegistry: 'telegram'
      }
    };
    let triggerA: any = {
      oid: 51n,
      id: 'message-trigger',
      receiverOid: receiver.oid,
      registrationGeneration: 4,
      registrationStatus: 'unregistering',
      remoteRegistrationKnown: true,
      telegramDetachMutationId: null,
      telegramDetachGeneration: null,
      telegramDetachFinal: null,
      telegramDetachRemoteAppliedAt: null,
      telegramDetachCompletedAt: null,
      tombstonedAt: null,
      source: 'webhook',
      state: {},
      action: action('message_received'),
      receiver
    };
    let triggerB: any = {
      ...triggerA,
      oid: 52n,
      id: 'callback-trigger',
      registrationGeneration: 5,
      registrationStatus: 'registered',
      action: action('callback_query_received')
    };
    receiver.triggers = [triggerA, triggerB];
    let records = new Map([
      [triggerA.id, triggerA],
      [triggerB.id, triggerB]
    ]);
    let triggerStore = {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.oid !== undefined) {
          return (
            [...records.values()].find(
              item =>
                item.oid === where.oid &&
                item.registrationGeneration === where.registrationGeneration
            ) ?? null
          );
        }
        if (where.telegramDetachMutationId?.not === null) {
          return (
            [...records.values()].find(
              item =>
                item.id !== where.id?.not &&
                item.telegramDetachMutationId !== null &&
                item.telegramDetachCompletedAt === null
            ) ?? null
          );
        }
        return null;
      }),
      findMany: vi.fn(async ({ where, take }: any) => {
        let rows = [...records.values()].filter(
          item =>
            item.id !== where.id?.not &&
            item.remoteRegistrationKnown &&
            item.telegramDetachMutationId === null
        );
        return take ? rows.slice(0, take) : rows;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let item = [...records.values()].find(record => record.oid === where.oid);
        if (!item) return { count: 0 };
        if (
          where.telegramDetachMutationId !== undefined &&
          typeof where.telegramDetachMutationId === 'string' &&
          item.telegramDetachMutationId !== where.telegramDetachMutationId
        ) {
          return { count: 0 };
        }
        if (
          where.telegramDetachRemoteAppliedAt === null &&
          item.telegramDetachRemoteAppliedAt !== null
        ) {
          return { count: 0 };
        }
        if (
          where.telegramDetachRemoteAppliedAt?.not === null &&
          item.telegramDetachRemoteAppliedAt === null
        ) {
          return { count: 0 };
        }
        Object.assign(item, data);
        return { count: 1 };
      })
    };
    let receiverStore = {
      findFirst: vi.fn(async ({ where }: any) =>
        receiver.oid === where.oid &&
        receiver.telegramWebhookLeaseToken === where.telegramWebhookLeaseToken &&
        receiver.telegramWebhookMutationVersion === where.telegramWebhookMutationVersion
          ? receiver
          : null
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (
          receiver.oid !== where.oid ||
          receiver.telegramWebhookLeaseToken !== where.telegramWebhookLeaseToken ||
          receiver.telegramWebhookMutationVersion !== where.telegramWebhookMutationVersion ||
          (typeof where.telegramWebhookRefCount === 'number' &&
            receiver.telegramWebhookRefCount !== where.telegramWebhookRefCount)
        ) {
          return { count: 0 };
        }
        Object.assign(receiver, data);
        return { count: 1 };
      })
    };
    let tx = {
      slateTriggerReceiver: receiverStore,
      slateTriggerReceiverTrigger: triggerStore
    };
    (db as any).$transaction = vi.fn(
      async (operation: (tx: any) => Promise<any>) => await operation(tx)
    );
    (db as any).slateTriggerReceiver = receiverStore;
    (db as any).slateTriggerReceiverTrigger = triggerStore;
    let register = vi.fn(async () => ({
      status: 'success',
      invocation: { oid: 1n },
      data: {
        capturedSecrets: {
          telegram_secret_token: { value: secretToken, version: 3 }
        }
      }
    }));
    let unregister = vi.fn(async () => ({
      status: 'success',
      invocation: { oid: 2n },
      data: {}
    }));
    let previousRegister = (slateInvocationService as any).registerWebhook;
    let previousUnregister = (slateInvocationService as any).unregisterWebhook;
    let previousResolve = (slateTriggerReceiverSecretService as any)
      .resolveRegistrationDetails;
    let previousRevoke = (slateTriggerReceiverSecretService as any).revokeRegistrationSecrets;
    let previousMark = (slateTriggerRegistrationLifecycleService as any)
      .markRemoteRegistrationRemoved;
    let previousSucceed = (slateTriggerRegistrationLifecycleService as any).succeed;
    (slateInvocationService as any).registerWebhook = register;
    (slateInvocationService as any).unregisterWebhook = unregister;
    (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = vi.fn(
      async () => ({ secretToken, singletonGeneration: 3 })
    );
    (slateTriggerReceiverSecretService as any).revokeRegistrationSecrets = vi.fn();
    (slateTriggerRegistrationLifecycleService as any).markRemoteRegistrationRemoved = vi.fn(
      async () => true
    );
    (slateTriggerRegistrationLifecycleService as any).succeed = vi.fn();
    let crashAfterFirstRemoteMutation = true;
    let core: any = {
      getReceiverTriggerWithRelations: vi.fn(async (id: string) => records.get(id)),
      getInvocationContext: vi.fn(async ({ receiverTrigger }: any) => ({
        action: receiverTrigger.action,
        version: {},
        config: {},
        auth: {}
      })),
      createInvocationStack: vi.fn(async () => ({})),
      recordTriggerInvocation: vi.fn(async ({ type }: any) => {
        if (crashAfterFirstRemoteMutation && type === 'webhook_register') {
          crashAfterFirstRemoteMutation = false;
          throw new Error('injected crash after Telegram setWebhook');
        }
      }),
      security: {
        webhookAuthorityResolver: {
          resolveRegistration: vi.fn(async ({ receiverTriggerId }: any) => ({
            receiverTrigger: records.get(receiverTriggerId),
            capturedSecretVersions: { telegram_secret_token: 3 }
          }))
        }
      }
    };
    let runtime = new SlateTriggerReceiverRuntime(core);
    let claim = (trigger: any) => ({
      receiverTriggerId: trigger.id,
      registrationGeneration: trigger.registrationGeneration,
      registrationTransitionVersion: 1,
      registrationLeaseToken: `registration-${trigger.id}`,
      registrationLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z'),
      intent: 'unregister' as const,
      status: 'unregistering' as const
    });
    try {
      await expect(
        runtime.unregisterWebhookForReceiverTrigger({
          receiverTrigger: triggerA,
          claim: claim(triggerA),
          telegramLease: {
            receiverOid: receiver.oid,
            receiverId: receiver.id,
            token: 'lease-a',
            mutationVersion: 4,
            generation: 3,
            remoteKnown: true,
            refCount: 2,
            allowedUpdates: ['callback_query', 'message'],
            webhookUrl: receiver.telegramWebhookUrl,
            secretFingerprint
          }
        })
      ).rejects.toThrow('injected crash after Telegram setWebhook');
      expect(receiver.telegramWebhookRefCount).toBe(1);
      expect(register).toHaveBeenCalledOnce();
      expect(unregister).not.toHaveBeenCalled();
      expect(triggerA.telegramDetachRemoteAppliedAt).toBeInstanceOf(Date);
      expect(triggerA.telegramDetachCompletedAt).toBeNull();

      receiver.telegramWebhookLeaseToken = 'lease-a-retry';
      receiver.telegramWebhookMutationVersion = 5;
      await runtime.unregisterWebhookForReceiverTrigger({
        receiverTrigger: triggerA,
        claim: claim(triggerA),
        telegramLease: {
          receiverOid: receiver.oid,
          receiverId: receiver.id,
          token: 'lease-a-retry',
          mutationVersion: 5,
          generation: 3,
          remoteKnown: true,
          refCount: 1,
          allowedUpdates: ['callback_query'],
          webhookUrl: receiver.telegramWebhookUrl,
          secretFingerprint
        }
      });
      expect(register).toHaveBeenCalledOnce();
      expect(triggerA.telegramDetachCompletedAt).toBeInstanceOf(Date);

      receiver.telegramWebhookLeaseToken = 'lease-b';
      receiver.telegramWebhookMutationVersion = 6;
      triggerB.registrationStatus = 'unregistering';
      await runtime.unregisterWebhookForReceiverTrigger({
        receiverTrigger: triggerB,
        claim: claim(triggerB),
        telegramLease: {
          receiverOid: receiver.oid,
          receiverId: receiver.id,
          token: 'lease-b',
          mutationVersion: 6,
          generation: 3,
          remoteKnown: true,
          refCount: 1,
          allowedUpdates: ['callback_query'],
          webhookUrl: receiver.telegramWebhookUrl,
          secretFingerprint
        }
      });
      expect(receiver.telegramWebhookRefCount).toBe(0);
      expect(receiver.telegramWebhookRemoteKnown).toBe(false);
      expect(unregister).toHaveBeenCalledOnce();

      receiver.telegramWebhookLeaseToken = 'lease-b-retry';
      receiver.telegramWebhookMutationVersion = 7;
      await runtime.unregisterWebhookForReceiverTrigger({
        receiverTrigger: triggerB,
        claim: claim(triggerB),
        telegramLease: {
          receiverOid: receiver.oid,
          receiverId: receiver.id,
          token: 'lease-b-retry',
          mutationVersion: 7,
          generation: 3,
          remoteKnown: false,
          refCount: 0,
          allowedUpdates: [],
          webhookUrl: null,
          secretFingerprint: null
        }
      });
      expect(unregister).toHaveBeenCalledOnce();
      expect(triggerA.telegramDetachMutationId).toBe('telegram-detach:message-trigger:4');
      expect(triggerB.telegramDetachMutationId).toBe('telegram-detach:callback-trigger:5');
      expect(triggerA.telegramDetachCompletedAt).toBeInstanceOf(Date);
      expect(triggerB.telegramDetachCompletedAt).toBeInstanceOf(Date);
    } finally {
      (slateInvocationService as any).registerWebhook = previousRegister;
      (slateInvocationService as any).unregisterWebhook = previousUnregister;
      (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = previousResolve;
      (slateTriggerReceiverSecretService as any).revokeRegistrationSecrets = previousRevoke;
      (slateTriggerRegistrationLifecycleService as any).markRemoteRegistrationRemoved =
        previousMark;
      (slateTriggerRegistrationLifecycleService as any).succeed = previousSucceed;
    }
  });
});

describe('Google and Word retiring-resource cleanup', () => {
  it.each([
    [
      'google-calendar',
      {
        channelId: 'active-channel',
        resourceId: 'active-resource',
        channelToken: 'active-token',
        expiration: '2000000000000',
        retiringChannelId: 'retiring-channel',
        retiringResourceId: 'retiring-resource',
        retiringChannelToken: 'retiring-token',
        retiringValidUntil: '1893455999999'
      },
      { channelId: 'retiring-channel', resourceId: 'retiring-resource' }
    ],
    [
      'word-online',
      {
        subscriptionId: 'active-subscription',
        expirationDateTime: '2030-01-02T00:00:00.000Z',
        clientState: 'active-state',
        retiringSubscriptionId: 'retiring-subscription',
        retiringClientState: 'retiring-state',
        retiringValidUntil: '2029-12-31T23:59:59.999Z',
        subscriptions: [
          { subscriptionId: 'active-subscription' },
          { subscriptionId: 'retiring-subscription' }
        ]
      },
      { subscriptionId: 'retiring-subscription' }
    ]
  ] as const)(
    'deletes expired %s overlap and CAS-removes only retiring authority',
    async (integrationId, details, cleanupDetails) => {
      let receiverTrigger: any = {
        id: 'trigger',
        registrationGeneration: 4,
        registrationVersion: 7,
        registrationStatus: 'registered',
        remoteRegistrationKnown: true,
        tombstonedAt: null,
        state: {},
        action: { key: 'delivery' },
        receiver: {
          id: 'receiver',
          slate: {
            slateIdentifierOnRegistry: integrationId,
            slateIdOnRegistry: integrationId
          }
        }
      };
      let recordTriggerInvocation = vi.fn(async () => {});
      let core: any = {
        getReceiverTriggerWithRelations: vi.fn(async () => receiverTrigger),
        getInvocationContext: vi.fn(async () => ({
          action: receiverTrigger.action,
          version: {},
          config: {},
          auth: {}
        })),
        createInvocationStack: vi.fn(async () => ({})),
        recordTriggerInvocation
      };
      let unregister = vi.fn(async () => ({
        status: 'success',
        invocation: { oid: 1n },
        data: {}
      }));
      let resolveDetails = vi.fn(async () => structuredClone(details));
      let commitCleanup = vi.fn(async () => 'committed');
      let previousUnregister = (slateInvocationService as any).unregisterWebhook;
      let previousResolve = (slateTriggerReceiverSecretService as any)
        .resolveRegistrationDetails;
      let previousCommit = (slateTriggerReceiverSecretService as any)
        .cleanupRetiringRegistrationDetails;
      (slateInvocationService as any).unregisterWebhook = unregister;
      (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = resolveDetails;
      (slateTriggerReceiverSecretService as any).cleanupRetiringRegistrationDetails =
        commitCleanup;
      try {
        let runtime = new SlateTriggerReceiverRuntime(core);
        await expect(
          runtime.cleanupRetiringWebhookRegistration({
            receiverTriggerId: 'trigger',
            registrationGeneration: 4,
            registrationVersion: 7,
            now: new Date('2030-01-01T00:00:00.000Z')
          })
        ).resolves.toBe('cleaned');
        expect(unregister).toHaveBeenCalledWith(
          expect.objectContaining({ registrationDetails: cleanupDetails })
        );
        let persisted = commitCleanup.mock.calls[0]![0].registrationDetails;
        expect(JSON.stringify(persisted)).not.toContain('retiring-');
        expect(persisted).toMatchObject(
          integrationId === 'google-calendar'
            ? { channelId: 'active-channel', resourceId: 'active-resource' }
            : { subscriptionId: 'active-subscription' }
        );
        expect(recordTriggerInvocation).toHaveBeenCalledOnce();
      } finally {
        (slateInvocationService as any).unregisterWebhook = previousUnregister;
        (slateTriggerReceiverSecretService as any).resolveRegistrationDetails =
          previousResolve;
        (slateTriggerReceiverSecretService as any).cleanupRetiringRegistrationDetails =
          previousCommit;
      }
    }
  );

  it('does not delete an active resource represented by an initial no-overlap placeholder', async () => {
    let receiverTrigger: any = {
      id: 'trigger',
      registrationGeneration: 1,
      registrationVersion: 1,
      registrationStatus: 'registered',
      remoteRegistrationKnown: true,
      tombstonedAt: null,
      action: { key: 'delivery' },
      receiver: {
        slate: {
          slateIdentifierOnRegistry: 'google-calendar',
          slateIdOnRegistry: 'google-calendar'
        }
      }
    };
    let core: any = {
      getReceiverTriggerWithRelations: vi.fn(async () => receiverTrigger)
    };
    let unregister = vi.fn();
    let previousUnregister = (slateInvocationService as any).unregisterWebhook;
    let previousResolve = (slateTriggerReceiverSecretService as any)
      .resolveRegistrationDetails;
    let previousCommit = (slateTriggerReceiverSecretService as any)
      .cleanupRetiringRegistrationDetails;
    (slateInvocationService as any).unregisterWebhook = unregister;
    (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = vi.fn(
      async () => ({
        channelId: 'active',
        resourceId: 'resource',
        channelToken: 'token',
        retiringChannelId: 'active',
        retiringResourceId: 'resource',
        retiringChannelToken: 'token',
        retiringValidUntil: '0'
      })
    );
    (slateTriggerReceiverSecretService as any).cleanupRetiringRegistrationDetails = vi.fn(
      async () => 'committed'
    );
    try {
      await expect(
        new SlateTriggerReceiverRuntime(core).cleanupRetiringWebhookRegistration({
          receiverTriggerId: 'trigger',
          registrationGeneration: 1,
          registrationVersion: 1,
          now: new Date('2030-01-01T00:00:00.000Z')
        })
      ).resolves.toBe('cleaned');
      expect(unregister).not.toHaveBeenCalled();
    } finally {
      (slateInvocationService as any).unregisterWebhook = previousUnregister;
      (slateTriggerReceiverSecretService as any).resolveRegistrationDetails = previousResolve;
      (slateTriggerReceiverSecretService as any).cleanupRetiringRegistrationDetails =
        previousCommit;
    }
  });
});

describe('post-create registration compensation guard', () => {
  let runScenario = async (d: {
    integrationId: 'google-calendar' | 'word-online';
    failure:
      | 'lease_loss'
      | 'cancellation'
      | 'record_failure'
      | 'validation_failure'
      | 'transaction_throw'
      | 'stale_cas';
    cleanupFailsOnce?: boolean;
  }) => {
    let contract: any = {
      id: 'changes',
      type: 'action.trigger',
      capabilities: { webhookAutoRegistrationV1: true },
      invocation: {
        type: 'webhook',
        autoRegistration: true,
        autoUnregistration: true,
        http: {
          methods: ['POST'],
          ingress: {
            kind: 'receiver_route',
            baseline: 'receiver_path_secret',
            verification: {
              mechanism: 'hub',
              baseline: 'receiver_path_secret',
              allowedSecretRefs: [
                {
                  source: 'registration',
                  name: 'registration_secret',
                  registrationKey: 'secret',
                  encoding: 'utf8'
                }
              ],
              rules: []
            }
          }
        }
      }
    };
    contract.specHash = computeHubWebhookActionSpecHashV1(contract);
    let receiverTrigger: any = {
      oid: 501n,
      id: `${d.integrationId}-trigger`,
      registrationGeneration: 4,
      registrationVersion: 7,
      registrationStatus: 'registering',
      remoteRegistrationKnown: false,
      state: {},
      action: { key: 'changes', spec: contract },
      receiver: {
        id: `${d.integrationId}-receiver`,
        slate: {
          slateIdentifierOnRegistry: d.integrationId,
          slateIdOnRegistry: d.integrationId
        },
        triggers: []
      }
    };
    receiverTrigger.receiver.triggers = [receiverTrigger];
    let authority: any = {
      receiverTrigger,
      version: {},
      actionId: 'changes',
      actionContract: contract,
      specHash: contract.specHash,
      registrationStatus: 'registering',
      registrationGeneration: 4,
      registrationVersion: 7,
      capturedSecretVersions: { registration_secret: 1 }
    };
    let registrationDetails =
      d.integrationId === 'google-calendar'
        ? {
            channelId: 'new-channel',
            resourceId: 'new-resource',
            retiringChannelId: 'old-channel',
            retiringResourceId: 'old-resource'
          }
        : {
            subscriptionId: 'new-subscription',
            retiringSubscriptionId: 'old-subscription'
          };
    let remoteCreated = false;
    let register = vi.fn(async () => {
      remoteCreated = true;
      return {
        status: 'success',
        invocation: { oid: 1n },
        data: {
          registrationDetails,
          capturedSecrets: {
            registration_secret: {
              value: 'captured-value',
              version: d.failure === 'validation_failure' ? 2 : 1
            }
          }
        }
      };
    });
    let cleanupAttempts = 0;
    let unregister = vi.fn(async () => {
      cleanupAttempts++;
      return {
        status: d.cleanupFailsOnce && cleanupAttempts === 1 ? 'error' : 'success',
        invocation: { oid: BigInt(cleanupAttempts + 1) }
      };
    });
    let commit = vi.fn(async () => {
      if (d.failure === 'transaction_throw') throw new Error('injected transaction throw');
      return d.failure === 'stale_cas' ? 'stale' : 'committed';
    });
    let previousRegister = (slateInvocationService as any).registerWebhook;
    let previousUnregister = (slateInvocationService as any).unregisterWebhook;
    let previousCommit = (slateTriggerReceiverSecretService as any).commitRegistrationResult;
    (slateInvocationService as any).registerWebhook = register;
    (slateInvocationService as any).unregisterWebhook = unregister;
    (slateTriggerReceiverSecretService as any).commitRegistrationResult = commit;
    let record = vi.fn(async ({ type }: any) => {
      if (d.failure === 'record_failure' && type === 'webhook_register') {
        throw new Error('injected invocation record failure');
      }
    });
    let core: any = {
      getInvocationContext: vi.fn(async () => ({
        action: receiverTrigger.action,
        version: {},
        config: {},
        auth: {}
      })),
      negotiateWebhookCapabilities: vi.fn(async () => ({
        registration: { status: 'v1' },
        verification: { status: 'v1' },
        bootstrapCapture: { status: 'v1' }
      })),
      security: {
        webhookAuthorityResolver: {
          resolveRegistration: vi.fn(async () => authority)
        }
      },
      createInvocationStack: vi.fn(async () => ({})),
      recordTriggerInvocation: record
    };
    try {
      await expect(
        new SlateTriggerReceiverRuntime(core).registerWebhookForReceiverTrigger({
          receiverTrigger,
          claim: {
            receiverTriggerId: receiverTrigger.id,
            registrationGeneration: 4,
            registrationTransitionVersion: 3,
            registrationLeaseToken: 'registration-lease',
            registrationLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z'),
            intent: 'register',
            status: 'registering'
          },
          assertLeaseOwned: () => {
            if (d.failure === 'lease_loss' && remoteCreated) {
              throw new RegistrationLeaseLostError();
            }
            if (d.failure === 'cancellation' && remoteCreated) {
              throw new Error('operation cancelled');
            }
          }
        })
      ).rejects.toThrow();
      expect(unregister).toHaveBeenCalledTimes(d.cleanupFailsOnce ? 2 : 1);
      expect(unregister).toHaveBeenLastCalledWith(
        expect.objectContaining({
          registrationDetails:
            d.integrationId === 'google-calendar'
              ? { channelId: 'new-channel', resourceId: 'new-resource' }
              : { subscriptionId: 'new-subscription' }
        })
      );
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'webhook_unregister' })
      );
    } finally {
      (slateInvocationService as any).registerWebhook = previousRegister;
      (slateInvocationService as any).unregisterWebhook = previousUnregister;
      (slateTriggerReceiverSecretService as any).commitRegistrationResult = previousCommit;
    }
  };

  it.each([
    ['google-calendar', 'lease_loss'],
    ['google-calendar', 'cancellation'],
    ['google-calendar', 'record_failure'],
    ['google-calendar', 'validation_failure'],
    ['google-calendar', 'transaction_throw'],
    ['google-calendar', 'stale_cas'],
    ['word-online', 'lease_loss'],
    ['word-online', 'cancellation'],
    ['word-online', 'record_failure'],
    ['word-online', 'validation_failure'],
    ['word-online', 'transaction_throw'],
    ['word-online', 'stale_cas']
  ] as const)(
    'compensates %s after %s before durable commit',
    async (integrationId, failure) => {
      await runScenario({ integrationId, failure });
    }
  );

  it('audits and retries an exact cleanup failure before preserving the original error', async () => {
    await runScenario({
      integrationId: 'google-calendar',
      failure: 'transaction_throw',
      cleanupFailsOnce: true
    });
  });
});

let verifiedRule: HubWebhookProviderRule = {
  id: 'delivery.v1',
  phase: 'delivery',
  result: { type: 'dispatch', scope: 'verified_items' },
  verify: {
    type: 'provider',
    verifierId: 'graph.change_notification.provider.v1',
    allowedSecretRefs: ['signing_secret']
  }
};

describe('Task 3 Hub webhook provider boundary', () => {
  it('projects Graph subscription and client-state authority with generation/spec bindings', () => {
    expect(
      collectGraphAuthorityRecords(
        {
          subscriptions: [
            {
              subscriptionId: 'subscription-a',
              clientStateSecretName: 'graph-state',
              resource: '/users/a/messages'
            },
            { subscriptionId: 'unbound' }
          ]
        },
        4,
        'a'.repeat(64),
        [{ name: 'graph-state', value: 'state-a' }]
      )
    ).toEqual([
      {
        subscriptionId: 'subscription-a',
        clientState: 'state-a',
        resource: '/users/a/messages',
        registrationGeneration: 4,
        specHash: 'a'.repeat(64)
      }
    ]);
  });

  it('accepts only current provider bootstrap sync authority for capture proposals', () => {
    let candidate = {
      candidateId: 'candidate',
      index: 0,
      bindingHash: 'a'.repeat(64),
      deliveryIds: ['delivery']
    };
    let authority: any = {
      rule: {
        phase: 'bootstrap',
        result: { type: 'sync_only' },
        verify: { type: 'provider', verifierId: 'notion.delivery.v1' }
      },
      registrationStatus: 'pending',
      actionId: 'action',
      specHash: 'b'.repeat(64),
      registrationGeneration: 2,
      registrationVersion: 3,
      itemAdapterId: 'graph.body_value.v1',
      hubInvocationId: 'invocation',
      candidateBindings: [candidate]
    };
    let proof: any = {
      originalRequestHash: 'c'.repeat(64),
      actionId: 'action',
      specHash: 'b'.repeat(64),
      registrationGeneration: 2,
      registrationVersion: 3,
      itemAdapterId: 'graph.body_value.v1',
      candidateBindings: [candidate]
    };
    let valid = (overrides: Record<string, unknown> = {}) =>
      validateBootstrapProposalAuthority({
        authority: { ...authority, ...overrides },
        proof,
        requestHash: 'c'.repeat(64),
        hubInvocationId: 'invocation'
      });
    expect(valid()).toBe(true);
    expect(valid({ rule: { ...authority.rule, phase: 'delivery' } })).toBe(false);
    expect(valid({ rule: { ...authority.rule, phase: 'lifecycle' } })).toBe(false);
    expect(valid({ rule: { ...authority.rule, result: { type: 'dispatch' } } })).toBe(false);
    expect(valid({ rule: { ...authority.rule, verify: { type: 'raw_hmac' } } })).toBe(false);
    expect(valid({ registrationStatus: 'registered' })).toBe(false);
    expect(valid({ registrationGeneration: 3 })).toBe(false);
    expect(valid({ specHash: 'd'.repeat(64) })).toBe(false);
  });

  it.each([
    [
      'wholly absent verifier',
      { scopedInvocationGrantV1: true },
      {},
      'verification',
      { status: 'legacy', code: 'capability_absent' }
    ],
    [
      'provider verifier only',
      { scopedInvocationGrantV1: true, webhookInboundVerificationV1: true },
      {},
      'verification',
      {
        status: 'fail_closed',
        code: 'webhook_verification_capabilities_inconsistent'
      }
    ],
    [
      'action verifier only',
      { scopedInvocationGrantV1: true },
      { webhookInboundVerificationV1: true },
      'verification',
      {
        status: 'fail_closed',
        code: 'webhook_verification_capabilities_inconsistent'
      }
    ],
    [
      'verifier without scoped grant',
      { webhookInboundVerificationV1: true },
      { webhookInboundVerificationV1: true },
      'verification',
      {
        status: 'fail_closed',
        code: 'webhook_verification_capabilities_inconsistent'
      }
    ],
    [
      'provider bootstrap only',
      {
        scopedInvocationGrantV1: true,
        webhookInboundVerificationV1: true,
        webhookInboundBootstrapCaptureV1: true
      },
      { webhookInboundVerificationV1: true },
      'bootstrapCapture',
      {
        status: 'fail_closed',
        code: 'webhook_bootstrap_capabilities_inconsistent'
      }
    ],
    [
      'action bootstrap only',
      { scopedInvocationGrantV1: true, webhookInboundVerificationV1: true },
      {
        webhookInboundVerificationV1: true,
        webhookInboundBootstrapCaptureV1: true
      },
      'bootstrapCapture',
      {
        status: 'fail_closed',
        code: 'webhook_bootstrap_capabilities_inconsistent'
      }
    ],
    [
      'registration mismatch',
      { scopedInvocationGrantV1: true, webhookSecretNegotiationV1: true },
      {},
      'registration',
      {
        status: 'fail_closed',
        code: 'webhook_registration_capabilities_inconsistent'
      }
    ]
  ] as const)(
    'closes capability downgrade matrix: %s',
    (_name, provider, action, operation, expected) => {
      let result = negotiateWebhookCapabilityAdvertisement({
        providerAvailable: true,
        provider,
        action
      });
      expect(result[operation]).toEqual(expected);
    }
  );

  it('fails all capability decisions closed when provider identification fails', () => {
    let result = negotiateWebhookCapabilityAdvertisement({
      providerAvailable: false,
      provider: {},
      action: {}
    });
    expect(result.registration.status).toBe('fail_closed');
    expect(result.verification.status).toBe('fail_closed');
    expect(result.bootstrapCapture.status).toBe('fail_closed');
  });

  it('hashes OPTIONS, ordered duplicate headers, and binary bodies deterministically', () => {
    let hash = computeHubWebhookWireRequestHash(wireRequest);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      computeHubWebhookWireRequestHash({
        ...wireRequest,
        headers: [...wireRequest.headers].reverse()
      })
    ).not.toBe(hash);
  });

  it('rejects contradictory scopes, invalid siblings, duplicate and unknown candidates', () => {
    expect(() =>
      validateHubProviderWebhookResult({
        result: { status: 'accepted', selection: { scope: 'receiver_trigger' } },
        rule: verifiedRule,
        itemAdapter
      })
    ).toThrow('contradicts');
    expect(() =>
      validateHubProviderWebhookResult({
        result: {
          status: 'rejected',
          code: 'credential_invalid',
          selection: { scope: 'receiver_trigger' }
        },
        rule: verifiedRule,
        itemAdapter
      })
    ).toThrow('contradictory');
    expect(() =>
      validateHubProviderWebhookResult({
        result: {
          status: 'accepted',
          selection: {
            scope: 'verified_items',
            itemAdapterId: 'graph.body_value.v1',
            acceptedCandidateIds: ['candidate-1', 'candidate-1']
          }
        },
        rule: verifiedRule,
        itemAdapter
      })
    ).toThrow('duplicate');
    expect(() =>
      validateHubProviderWebhookResult({
        result: {
          status: 'accepted',
          selection: {
            scope: 'verified_items',
            itemAdapterId: 'graph.body_value.v1',
            acceptedCandidateIds: ['unknown']
          }
        },
        rule: verifiedRule,
        itemAdapter
      })
    ).toThrow('unknown');
  });

  it('accepts only Hub-owned candidate IDs', () => {
    expect(
      validateHubProviderWebhookResult({
        result: {
          status: 'accepted',
          selection: {
            scope: 'verified_items',
            itemAdapterId: 'graph.body_value.v1',
            acceptedCandidateIds: ['candidate-2']
          }
        },
        rule: verifiedRule,
        itemAdapter
      })
    ).toEqual({
      status: 'accepted',
      selection: {
        scope: 'verified_items',
        itemAdapterId: 'graph.body_value.v1',
        acceptedCandidateIds: ['candidate-2']
      }
    });
  });
});

describe('Task 8 registration lease authority', () => {
  it('abandons a non-cooperating provider after heartbeat ownership loss without persisting results', async () => {
    vi.useFakeTimers();
    let claim = {
      receiverTriggerId: 'trigger-lease',
      registrationGeneration: 4,
      registrationTransitionVersion: 2,
      registrationLeaseToken: 'lease-owner-a',
      registrationLeaseExpiresAt: new Date(Date.now() + 120_000),
      intent: 'register' as const,
      status: 'registering' as const
    };
    let renewSpy = vi
      .spyOn(slateTriggerRegistrationLifecycleService, 'renewLease')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    let commitResult = vi.fn();
    let resolveProvider!: (value: any) => void;
    let provider = vi.fn(
      () =>
        new Promise(resolve => {
          resolveProvider = resolve;
        })
    );
    let runtime = new SlateTriggerReceiverRuntime({} as any);
    let running = (runtime as any).withRegistrationLease(
      claim,
      async (assertLeaseOwned: () => void) => {
        let result = await provider();
        assertLeaseOwned();
        commitResult(result);
      }
    );
    for (let index = 0; index < 10 && provider.mock.calls.length === 0; index += 1) {
      await Promise.resolve();
    }
    expect(provider).toHaveBeenCalledOnce();
    let leaseLost = expect(running).rejects.toBeInstanceOf(RegistrationLeaseLostError);
    await vi.advanceTimersByTimeAsync(40_000);
    await leaseLost;
    resolveProvider({
      status: 'success',
      invocation: { oid: 10n },
      data: { registrationDetails: { remote: true }, state: null }
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(renewSpy).toHaveBeenCalledTimes(2);
    expect(commitResult).not.toHaveBeenCalled();
    renewSpy.mockRestore();
    vi.useRealTimers();
  });

  it('abandons a non-cooperating provider when heartbeat renewal throws', async () => {
    vi.useFakeTimers();
    let claim = {
      receiverTriggerId: 'trigger-lease-error',
      registrationGeneration: 6,
      registrationTransitionVersion: 3,
      registrationLeaseToken: 'lease-owner-error',
      registrationLeaseExpiresAt: new Date(Date.now() + 120_000),
      intent: 'register' as const,
      status: 'registering' as const
    };
    let renewSpy = vi
      .spyOn(slateTriggerRegistrationLifecycleService, 'renewLease')
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('database heartbeat unavailable'));
    let commitResult = vi.fn();
    let provider = vi.fn(() => new Promise(() => {}));
    let runtime = new SlateTriggerReceiverRuntime({} as any);
    let running = (runtime as any).withRegistrationLease(
      claim,
      async (assertLeaseOwned: () => void) => {
        let result = await provider();
        assertLeaseOwned();
        commitResult(result);
      }
    );
    for (let index = 0; index < 10 && provider.mock.calls.length === 0; index += 1) {
      await Promise.resolve();
    }
    let leaseLost = expect(running).rejects.toBeInstanceOf(RegistrationLeaseLostError);
    await vi.advanceTimersByTimeAsync(40_000);
    await leaseLost;
    expect(provider).toHaveBeenCalledOnce();
    expect(commitResult).not.toHaveBeenCalled();
    renewSpy.mockRestore();
    vi.useRealTimers();
  });

  it('retains known remote truth when automatic cleanup is unavailable', async () => {
    let succeed = vi
      .spyOn(slateTriggerRegistrationLifecycleService, 'succeed')
      .mockResolvedValue(true);
    let runtime = new SlateTriggerReceiverRuntime({} as any);
    let receiverTrigger: any = {
      id: 'trigger-cleanup',
      source: 'webhook',
      remoteRegistrationKnown: true,
      action: {
        id: 'action-cleanup',
        spec: {
          type: 'action.trigger',
          invocation: {
            type: 'webhook',
            autoRegistration: true,
            autoUnregistration: false
          }
        }
      },
      receiver: { slate: {}, triggers: [] }
    };
    let claim: any = {
      receiverTriggerId: 'trigger-cleanup',
      registrationGeneration: 5,
      registrationTransitionVersion: 1,
      registrationLeaseToken: 'lease-cleanup',
      registrationLeaseExpiresAt: new Date(Date.now() + 60_000),
      intent: 'delete',
      status: 'unregistering'
    };
    await expect(
      runtime.unregisterWebhookForReceiverTrigger({ receiverTrigger, claim })
    ).rejects.toThrow('registration_capability_unavailable');
    expect(succeed).not.toHaveBeenCalled();

    receiverTrigger.remoteRegistrationKnown = false;
    await expect(
      runtime.unregisterWebhookForReceiverTrigger({ receiverTrigger, claim })
    ).resolves.toBeUndefined();
    expect(succeed).toHaveBeenCalledWith(
      expect.objectContaining({ remoteRegistrationKnown: false })
    );
    succeed.mockRestore();
  });
});

describe('Manual callback registration persistence', () => {
  let claim = {
    receiverTriggerId: 'manual-callback-trigger',
    registrationGeneration: 4,
    registrationTransitionVersion: 6,
    registrationLeaseToken: 'manual-callback-lease',
    registrationLeaseExpiresAt: new Date('2030-01-01T00:01:00.000Z'),
    intent: 'register' as const,
    status: 'registering' as const
  };
  let receiverTrigger = (http: Record<string, unknown> = {}) => ({
    id: claim.receiverTriggerId,
    source: 'webhook',
    state: { cursor: 'current-trigger-state' },
    action: {
      id: 'manual-callback-action',
      key: 'callback_received',
      spec: {
        type: 'action.trigger',
        invocation: {
          type: 'webhook',
          autoRegistration: false,
          autoUnregistration: false,
          http
        }
      }
    },
    receiver: {
      slate: {
        slateIdentifierOnRegistry: 'manual-callback-provider',
        slateIdOnRegistry: 'manual-callback-provider'
      },
      triggers: []
    }
  });

  it.each(['committed', 'stale'] as const)(
    'handles an ordinary no-auto webhook without provider or lifecycle effects when the commit is %s',
    async commitStatus => {
      let trigger = receiverTrigger();
      let commit = vi
        .spyOn(slateTriggerReceiverSecretService, 'commitRegistrationResult')
        .mockResolvedValue(commitStatus);
      let succeed = vi
        .spyOn(slateTriggerRegistrationLifecycleService, 'succeed')
        .mockResolvedValue(true);
      let awaitManualBootstrap = vi
        .spyOn(slateTriggerRegistrationLifecycleService, 'awaitManualBootstrap')
        .mockResolvedValue(true);
      let previousRegister = (slateInvocationService as any).registerWebhook;
      let register = vi.fn();
      (slateInvocationService as any).registerWebhook = register;

      try {
        await expect(
          new SlateTriggerReceiverRuntime({} as any).registerWebhookForReceiverTrigger({
            receiverTrigger: trigger as any,
            claim
          })
        ).resolves.toBeUndefined();
        expect(commit).toHaveBeenCalledOnce();
        expect(commit).toHaveBeenCalledWith({
          claim,
          registrationDetails: null,
          remoteRegistrationKnown: false
        });
        expect(commit.mock.calls[0]![0]).not.toHaveProperty('state');
        expect(register).not.toHaveBeenCalled();
        expect(succeed).not.toHaveBeenCalled();
        expect(awaitManualBootstrap).not.toHaveBeenCalled();
      } finally {
        commit.mockRestore();
        succeed.mockRestore();
        awaitManualBootstrap.mockRestore();
        if (previousRegister === undefined) {
          delete (slateInvocationService as any).registerWebhook;
        } else {
          (slateInvocationService as any).registerWebhook = previousRegister;
        }
      }
    }
  );

  it('leaves manual bootstrap registration on the lifecycle wait path', async () => {
    let trigger = receiverTrigger({ registration: { mode: 'manual_bootstrap' } });
    let commit = vi
      .spyOn(slateTriggerReceiverSecretService, 'commitRegistrationResult')
      .mockResolvedValue('committed');
    let succeed = vi
      .spyOn(slateTriggerRegistrationLifecycleService, 'succeed')
      .mockResolvedValue(true);
    let awaitManualBootstrap = vi
      .spyOn(slateTriggerRegistrationLifecycleService, 'awaitManualBootstrap')
      .mockResolvedValue(false);
    let previousRegister = (slateInvocationService as any).registerWebhook;
    let register = vi.fn();
    (slateInvocationService as any).registerWebhook = register;

    try {
      await expect(
        new SlateTriggerReceiverRuntime({} as any).registerWebhookForReceiverTrigger({
          receiverTrigger: trigger as any,
          claim
        })
      ).resolves.toBeUndefined();
      expect(awaitManualBootstrap).toHaveBeenCalledWith(claim);
      expect(commit).not.toHaveBeenCalled();
      expect(register).not.toHaveBeenCalled();
      expect(succeed).not.toHaveBeenCalled();
    } finally {
      commit.mockRestore();
      succeed.mockRestore();
      awaitManualBootstrap.mockRestore();
      if (previousRegister === undefined) {
        delete (slateInvocationService as any).registerWebhook;
      } else {
        (slateInvocationService as any).registerWebhook = previousRegister;
      }
    }
  });

  it('preserves lifecycle completion for non-webhook triggers', async () => {
    let trigger = receiverTrigger() as any;
    trigger.source = 'polling';
    trigger.action.spec.invocation = { type: 'polling' };
    let commit = vi
      .spyOn(slateTriggerReceiverSecretService, 'commitRegistrationResult')
      .mockResolvedValue('committed');
    let succeed = vi
      .spyOn(slateTriggerRegistrationLifecycleService, 'succeed')
      .mockResolvedValue(true);

    try {
      await expect(
        new SlateTriggerReceiverRuntime({} as any).registerWebhookForReceiverTrigger({
          receiverTrigger: trigger,
          claim
        })
      ).resolves.toBeUndefined();
      expect(succeed).toHaveBeenCalledWith({
        ...claim,
        remoteRegistrationKnown: false
      });
      expect(commit).not.toHaveBeenCalled();
    } finally {
      commit.mockRestore();
      succeed.mockRestore();
    }
  });
});

describe('Task 3 immutable one-use scoped invocation grants', () => {
  let resolved = {
    tenantId: 'tenant-1',
    slateInstanceId: 'instance-1',
    configSchemaVersion: 3,
    configSchemaHash: 'schema-hash',
    hubInvocationId: 'hub-invocation-1',
    requestId: 'rpc-1',
    operation: 'webhook_verify' as const,
    actionId: 'webhook.delivery',
    specHash: 'a'.repeat(64),
    ruleId: 'delivery.v1',
    originalRequestHash: 'b'.repeat(64),
    dispatchRequestHash: 'b'.repeat(64),
    receiverId: 'receiver-1',
    receiverTriggerId: 'receiver-trigger-1',
    registrationStatus: 'registered',
    registrationGeneration: 4,
    registrationVersion: 5,
    projectedSecretVersions: { signing_secret: 9 },
    candidateBindings: []
  };
  let createAuthority = (now: () => number) =>
    new ScopedInvocationGrantAuthority({ resolve: async () => resolved }, now);
  let request = {
    requestId: 'rpc-1',
    operation: 'webhook_verify' as const,
    receiverTriggerId: 'receiver-trigger-1',
    hubInvocationId: 'hub-invocation-1'
  };
  let issue = async (authority: ScopedInvocationGrantAuthority) => {
    let resolution = await authority.resolve(request);
    return authority.issue({
      ttlMs: 1_000,
      request,
      authorityHandle: resolution.handle
    });
  };

  let expected = resolved;

  it('authenticates, atomically consumes once, and preserves authoritative bindings', async () => {
    let authority = createAuthority(() => 100);
    let envelope = await issue(authority);
    let bindings = await authority.redeem({ envelope, authenticated: true, expected });
    expect(bindings.projectedSecretVersions).toEqual({ signing_secret: 9 });
    expect(Object.isFrozen(bindings)).toBe(true);
    expect(authority.pendingCount).toBe(0);
    await expect(
      authority.redeem({ envelope, authenticated: true, expected })
    ).rejects.toThrow('already consumed');
  });

  it.each([
    ['tenantId', 'tenant-2'],
    ['slateInstanceId', 'instance-2'],
    ['configSchemaVersion', 4],
    ['configSchemaHash', 'other-schema-hash'],
    ['hubInvocationId', 'other-invocation'],
    ['requestId', 'rpc-2'],
    ['operation', 'webhook_handle'],
    ['actionId', 'other.action'],
    ['receiverId', 'receiver-2'],
    ['receiverTriggerId', 'receiver-trigger-2'],
    ['registrationGeneration', 5],
    ['registrationVersion', 6],
    ['projectedSecretVersions', { signing_secret: 10 }],
    ['specHash', 'c'.repeat(64)],
    ['ruleId', 'delivery.v2'],
    ['originalRequestHash', 'd'.repeat(64)],
    [
      'candidateBindings',
      [
        {
          candidateId: 'other',
          index: 0,
          bindingHash: 'e'.repeat(64),
          deliveryIds: ['delivery']
        }
      ]
    ]
  ] as const)('rejects mismatched %s before reuse', async (key, value) => {
    let authority = createAuthority(() => 100);
    let envelope = await issue(authority);
    await expect(
      authority.redeem({
        envelope,
        authenticated: true,
        expected: { ...expected, [key]: value } as unknown as ScopedInvocationGrantBindings
      })
    ).rejects.toThrow('binding validation failed');
    expect(authority.pendingCount).toBe(1);
    await expect(
      authority.redeem({ envelope, authenticated: true, expected })
    ).resolves.toMatchObject(expected);
    expect(authority.pendingCount).toBe(0);
  });

  it('rejects unauthenticated and expired redemption and consumes terminally', async () => {
    let now = 100;
    let authority = createAuthority(() => now);
    let envelope = await issue(authority);
    await expect(
      authority.redeem({ envelope, authenticated: false, expected })
    ).rejects.toThrow('unauthenticated');
    // Unauthenticated calls never touch the authenticated one-use store.
    expect(authority.pendingCount).toBe(1);
    now = 2_000;
    await expect(
      authority.redeem({ envelope, authenticated: true, expected })
    ).rejects.toThrow('binding validation failed');
    expect(authority.pendingCount).toBe(0);
  });

  it('revokes issued grants that never redeem', async () => {
    let authority = createAuthority(() => 100);
    let envelope = await issue(authority);
    expect(authority.pendingCount).toBe(1);
    await authority.revoke(envelope);
    expect(authority.pendingCount).toBe(0);
  });

  it('consumes authority handles exactly once and binds the exact invocation ID', async () => {
    let authority = createAuthority(() => 100);
    let resolution = await authority.resolve(request);
    await authority.issue({ request, authorityHandle: resolution.handle, ttlMs: 1_000 });
    await expect(
      authority.issue({ request, authorityHandle: resolution.handle, ttlMs: 1_000 })
    ).rejects.toThrow('already consumed');
    let other = await authority.resolve(request);
    await expect(
      authority.issue({
        request: { ...request, hubInvocationId: 'other-invocation' },
        authorityHandle: other.handle,
        ttlMs: 1_000
      })
    ).rejects.toThrow('authority handle');
  });

  it('releases unresolved authority idempotently with exact bindings and prevents later issue', async () => {
    let authority = createAuthority(() => 100);
    let resolution = await authority.resolve(request);
    expect(authority.resolutionCount).toBe(1);
    expect(Object.isFrozen(resolution.bindings)).toBe(true);
    expect(Object.isFrozen(resolution.bindings.projectedSecretVersions)).toBe(true);
    expect(Object.isFrozen(resolution.bindings.candidateBindings)).toBe(true);
    authority.release({ handle: resolution.handle, request });
    authority.release({ handle: resolution.handle, request });
    expect(authority.resolutionCount).toBe(0);
    await expect(
      authority.issue({ request, authorityHandle: resolution.handle, ttlMs: 1_000 })
    ).rejects.toThrow('already consumed');
    expect(() =>
      authority.release({
        handle: resolution.handle,
        request: { ...request, hubInvocationId: 'wrong-invocation' }
      })
    ).toThrow('release binding validation failed');
  });

  it('expires unresolved authority handles and makes them unusable', async () => {
    let now = 100;
    let authority = new ScopedInvocationGrantAuthority(
      { resolve: async () => resolved },
      () => now,
      10
    );
    let resolution = await authority.resolve(request);
    now = 111;
    await expect(
      authority.issue({ request, authorityHandle: resolution.handle, ttlMs: 1_000 })
    ).rejects.toThrow('already consumed');
    expect(authority.resolutionCount).toBe(0);
    authority.release({ handle: resolution.handle, request });
  });

  it('binds bootstrap authority issue and release to the exact accepted proof', async () => {
    let authority = new ScopedInvocationGrantAuthority(
      {
        resolve: async grantRequest => ({
          ...resolved,
          operation: grantRequest.operation
        })
      },
      () => 100
    );
    let bootstrapRequest = {
      ...request,
      operation: 'webhook_bootstrap_capture' as const,
      acceptedVerificationProofId: 'proof-1'
    };
    let wrongProofRequest = {
      ...bootstrapRequest,
      acceptedVerificationProofId: 'proof-2'
    };
    let issueResolution = await authority.resolve(bootstrapRequest);
    await expect(
      authority.issue({
        request: wrongProofRequest,
        authorityHandle: issueResolution.handle,
        ttlMs: 1_000
      })
    ).rejects.toThrow('authority handle');

    let releaseResolution = await authority.resolve(bootstrapRequest);
    expect(() =>
      authority.release({ handle: releaseResolution.handle, request: wrongProofRequest })
    ).toThrow('release binding validation failed');
    authority.release({ handle: releaseResolution.handle, request: bootstrapRequest });

    let validResolution = await authority.resolve(bootstrapRequest);
    await expect(
      authority.issue({
        request: bootstrapRequest,
        authorityHandle: validResolution.handle,
        ttlMs: 1_000
      })
    ).resolves.toMatchObject({ version: 'scoped_invocation_grant_v1' });
  });

  it('rejects an authority handle with the wrong version', async () => {
    let authority = createAuthority(() => 100);
    let resolution = await authority.resolve(request);
    await expect(
      authority.issue({
        request,
        authorityHandle: { ...resolution.handle, version: 'wrong' as any },
        ttlMs: 1_000
      })
    ).rejects.toThrow('authority handle');
  });

  it('consumes a durable tool grant globally across execution authorities', async () => {
    let rows = new Map<string, Readonly<ScopedInvocationGrantBindings>>();
    let store = {
      put: vi.fn(async (d: any) => rows.set(d.tokenHash, d.bindings)),
      consume: vi.fn(async (d: any) => {
        let binding = rows.get(d.tokenHash) ?? null;
        if (binding && !d.validate(binding)) {
          throw new Error('Scoped invocation grant binding validation failed');
        }
        rows.delete(d.tokenHash);
        return binding;
      }),
      revoke: vi.fn(async (d: any) => {
        rows.delete(d.tokenHash);
      })
    };
    let tool = {
      deploymentId: 'deployment-1',
      runtimeIdentityId: 'runtime-1',
      runtimeIdentityGeneration: 2,
      tenantId: 'tenant-1',
      slateInstanceId: 'instance-1',
      configSchemaVersion: 2,
      configSchemaHash: 'a'.repeat(64),
      hubInvocationId: 'invocation-1',
      requestId: 'tool-request-1',
      actionId: 'tool.read',
      operation: 'tool_invoke' as const,
      configSecretVersions: { 'config:token': 3 },
      authConfigId: 'auth-1',
      authSecretVersions: { 'auth:accessToken': 9 },
      receiverCallback: {
        receiverId: 'callback-receiver-1',
        receiverTriggerId: 'callback-trigger-1',
        triggerActionId: 'agent_status_change',
        specHash: 'c'.repeat(64),
        registrationGeneration: 7,
        registrationVersion: 8,
        projectedSecretVersions: { cursor_webhook_secret: 12 }
      }
    };
    let request = {
      requestId: tool.requestId,
      operation: tool.operation,
      deploymentId: tool.deploymentId,
      runtimeIdentityId: tool.runtimeIdentityId,
      runtimeIdentityGeneration: tool.runtimeIdentityGeneration,
      slateInstanceId: tool.slateInstanceId,
      actionId: tool.actionId,
      hubInvocationId: tool.hubInvocationId
    };
    let issuer = new ScopedInvocationGrantAuthority(
      { resolve: async () => tool },
      () => 100,
      30_000,
      store
    );
    let redeemer = new ScopedInvocationGrantAuthority(
      { resolve: async () => tool },
      () => 100,
      30_000,
      store
    );
    let resolution = await issuer.resolve(request);
    let envelope = await issuer.issue({
      request,
      authorityHandle: resolution.handle,
      ttlMs: 1_000
    });
    await expect(
      redeemer.redeem({
        envelope,
        authenticated: true,
        expected: {
          requestId: tool.requestId,
          operation: tool.operation,
          actionId: tool.actionId,
          deploymentId: tool.deploymentId,
          runtimeIdentityId: 'capturing-runtime',
          runtimeIdentityGeneration: tool.runtimeIdentityGeneration,
          hubInvocationId: tool.hubInvocationId
        }
      })
    ).rejects.toThrow('binding validation failed');
    expect(rows.size).toBe(1);
    let bindings = await redeemer.redeem({
      envelope,
      authenticated: true,
      expected: {
        requestId: tool.requestId,
        operation: tool.operation,
        actionId: tool.actionId,
        deploymentId: tool.deploymentId,
        runtimeIdentityId: tool.runtimeIdentityId,
        runtimeIdentityGeneration: tool.runtimeIdentityGeneration,
        hubInvocationId: tool.hubInvocationId
      }
    });
    expect(bindings).toMatchObject(tool);
    expect(Object.isFrozen(bindings.receiverCallback)).toBe(true);
    expect(Object.isFrozen(bindings.receiverCallback?.projectedSecretVersions)).toBe(true);
    await expect(
      issuer.redeem({
        envelope,
        authenticated: true,
        expected: {
          requestId: tool.requestId,
          operation: tool.operation,
          actionId: tool.actionId,
          deploymentId: tool.deploymentId,
          runtimeIdentityId: tool.runtimeIdentityId,
          runtimeIdentityGeneration: tool.runtimeIdentityGeneration,
          hubInvocationId: tool.hubInvocationId
        }
      })
    ).rejects.toThrow('already consumed');
  });
});

describe('Task 3 accepted-verification proofs and independent spec hashing', () => {
  it('matches the fixed cross-implementation producer fixture', () => {
    let action = {
      id: 'webhook.delivery',
      type: 'action.trigger',
      capabilities: {},
      invocation: {
        type: 'webhook',
        autoRegistration: true,
        autoUnregistration: false,
        http: {
          methods: ['POST', 'GET'],
          sync: {
            mode: 'match',
            match: [{ method: 'GET', hasQueryParam: 'challenge' }],
            timeoutMs: 2500
          },
          ingress: {
            kind: 'receiver_route',
            baseline: 'receiver_path_secret',
            verification: {
              mechanism: 'hub',
              baseline: 'receiver_path_secret',
              allowedSecretRefs: [
                {
                  source: 'registration',
                  name: 'signing_secret',
                  registrationKey: 'signing_secret',
                  encoding: 'utf8'
                }
              ],
              rules: [
                {
                  id: 'delivery.v1',
                  phase: 'delivery',
                  when: { methods: ['POST'] },
                  verify: {
                    type: 'raw_hmac',
                    secretName: 'signing_secret',
                    algorithm: 'sha256',
                    signature: {
                      headerName: 'X-Signature',
                      encoding: 'hex',
                      duplicateHeaderPolicy: 'reject',
                      multipleSignaturePolicy: 'any_valid'
                    },
                    message: [{ source: 'body' }, { source: 'literal', value: '.v1' }]
                  },
                  result: { type: 'dispatch', scope: 'receiver_trigger' },
                  replay: {
                    kind: 'enforced',
                    deduplicate: {
                      source: 'header',
                      headerName: 'X-Delivery-Id',
                      ttlSeconds: 86400,
                      scope: 'request'
                    }
                  }
                }
              ]
            }
          }
        }
      }
    };
    expect(computeHubWebhookActionSpecHashV1(action)).toBe(
      '1cc404e61c919b1ce942fb02c0014365df43f1cf961115ced5153f30a1184bf7'
    );
    expect(computeHubWebhookActionSpecHashV1({ ...action, id: 'changed' })).not.toBe(
      '1cc404e61c919b1ce942fb02c0014365df43f1cf961115ced5153f30a1184bf7'
    );
  });

  it('issues immutable expiring proof bindings and consumes exactly once', () => {
    let now = 100;
    let authority = new AcceptedWebhookVerificationProofAuthority(() => now);
    let proof = authority.issue({
      ttlMs: 1_000,
      bindings: {
        tenantId: 'tenant',
        slateInstanceId: 'instance',
        receiverId: 'receiver',
        receiverTriggerId: 'trigger',
        actionId: 'action',
        specHash: 'a'.repeat(64),
        ruleId: 'bootstrap',
        requestId: 'rpc',
        originalRequestHash: 'b'.repeat(64),
        registrationGeneration: 2,
        registrationVersion: 3,
        candidateBindings: []
      }
    });
    let binding = authority.consume({ proof, receiverTriggerId: 'trigger' });
    expect(Object.isFrozen(binding)).toBe(true);
    expect(() => authority.consume({ proof, receiverTriggerId: 'trigger' })).toThrow(
      'missing or consumed'
    );
  });

  it('integrates authoritative resolution, one-use issue, and the exact invocation ID', async () => {
    let request: HubWebhookWireRequest = {
      url: 'https://hooks.test/delivery',
      method: 'POST',
      headers: [],
      body: { present: false }
    };
    let rule = {
      id: 'delivery.v1',
      phase: 'delivery',
      when: { methods: ['POST'] },
      result: { type: 'dispatch', scope: 'receiver_trigger' },
      verify: {
        type: 'provider',
        verifierId: 'quickbooks.delivery.v1',
        allowedSecretRefs: ['signing_secret']
      }
    } as const;
    let actionContract: Record<string, any> = {
      id: 'webhook.delivery',
      type: 'action.trigger',
      capabilities: { webhookInboundVerificationV1: true },
      invocation: {
        type: 'webhook',
        autoRegistration: true,
        autoUnregistration: false,
        http: { methods: ['POST'] }
      }
    };
    actionContract.specHash = computeHubWebhookActionSpecHashV1(actionContract);
    let receiverTrigger: any = {
      id: 'trigger',
      action: { key: 'webhook.delivery', spec: actionContract },
      receiver: {
        id: 'receiver',
        tenant: { id: 'tenant' },
        slateInstance: { id: 'instance' }
      }
    };
    let currentRequest:
      | {
          requestId: string;
          operation: 'webhook_verify';
          receiverTriggerId: string;
          hubInvocationId: string;
        }
      | undefined;
    let grantAuthority = new ScopedInvocationGrantAuthority({
      resolve: async grantRequest => {
        currentRequest = { ...grantRequest, operation: 'webhook_verify' };
        return {
          tenantId: 'tenant',
          slateInstanceId: 'instance',
          configSchemaVersion: 1,
          configSchemaHash: 'schema',
          hubInvocationId: grantRequest.hubInvocationId,
          requestId: grantRequest.requestId,
          operation: 'webhook_verify',
          actionId: 'webhook.delivery',
          specHash: actionContract.specHash,
          ruleId: 'delivery.v1',
          originalRequestHash: computeHubWebhookWireRequestHash(request),
          dispatchRequestHash: computeHubWebhookWireRequestHash(request),
          receiverId: 'receiver',
          receiverTriggerId: 'trigger',
          registrationStatus: 'registered',
          registrationGeneration: 2,
          registrationVersion: 3,
          projectedSecretVersions: { signing_secret: 4 },
          candidateBindings: []
        };
      }
    });
    let issuedHandle: any;
    let mutateInvocationId = false;
    let replayHandle = false;
    let firstHandle: any;
    let resolver = {
      resolve: vi.fn(async (input: any) => {
        let grantRequest = {
          requestId: input.requestId,
          operation: input.operation,
          receiverTriggerId: input.receiverTriggerId,
          hubInvocationId: input.hubInvocationId
        };
        let resolution = await grantAuthority.resolve(grantRequest);
        issuedHandle = resolution.handle;
        firstHandle ??= resolution.handle;
        return {
          authorityHandle: resolution.handle,
          authority: {
            receiverTrigger,
            version: {},
            actionId: 'webhook.delivery',
            hubInvocationId: input.hubInvocationId,
            actionContract,
            specHash: actionContract.specHash,
            rule,
            registrationStatus: 'registered',
            registrationGeneration: 2,
            registrationVersion: 3,
            projectedSecretVersions: { signing_secret: 4 },
            candidateBindings: [],
            redactionSentinels: ['secret']
          }
        };
      }),
      release: vi.fn(async (input: any) =>
        grantAuthority.release({
          handle: input.authorityHandle,
          request: {
            requestId: input.requestId,
            operation: input.operation,
            receiverTriggerId: input.receiverTriggerId,
            hubInvocationId: input.hubInvocationId
          }
        })
      ),
      resolveAcceptedProof: vi.fn(),
      resolveRegistration: vi.fn()
    };
    let issue = vi.fn(async (input: any) => {
      if (!currentRequest) throw new Error('missing authoritative request');
      return grantAuthority.issue({
        ttlMs: 1_000,
        authorityHandle: replayHandle ? firstHandle : input.authorityHandle,
        request: {
          ...currentRequest,
          hubInvocationId: mutateInvocationId
            ? 'different-hub-invocation'
            : input.hubInvocationId
        }
      });
    });
    let core: any = {
      security: {
        webhookAuthorityResolver: resolver,
        scopedGrantIssuer: {
          issue,
          revoke: async (envelope: any) => grantAuthority.revoke(envelope)
        }
      },
      negotiateWebhookCapabilities: vi.fn(async () => ({
        registration: { status: 'v1' },
        verification: { status: 'v1' },
        bootstrapCapture: { status: 'unavailable', code: 'capability_absent' }
      })),
      createRestrictedInvocationStack: vi.fn(async (input: any) => ({
        hubInvocationId: input.hubInvocationId
      }))
    };
    let invoke = vi.fn(async ({ invocation, stack }: any) => {
      if (!currentRequest) throw new Error('missing authoritative request');
      let bindings = await grantAuthority.redeem({
        envelope: invocation,
        authenticated: true,
        expected: {
          tenantId: 'tenant',
          slateInstanceId: 'instance',
          configSchemaVersion: 1,
          configSchemaHash: 'schema',
          hubInvocationId: currentRequest.hubInvocationId,
          requestId: currentRequest.requestId,
          operation: 'webhook_verify',
          actionId: 'webhook.delivery',
          specHash: actionContract.specHash,
          ruleId: 'delivery.v1',
          originalRequestHash: computeHubWebhookWireRequestHash(request),
          dispatchRequestHash: computeHubWebhookWireRequestHash(request),
          receiverId: 'receiver',
          receiverTriggerId: 'trigger',
          registrationStatus: 'registered',
          registrationGeneration: 2,
          registrationVersion: 3,
          projectedSecretVersions: { signing_secret: 4 },
          candidateBindings: []
        }
      });
      expect(stack.hubInvocationId).toBe(bindings.hubInvocationId);
      return {
        status: 'success',
        invocation: { oid: 1n },
        data: { status: 'accepted', selection: { scope: 'receiver_trigger' } }
      };
    });
    (slateInvocationService as any).verifyWebhookRequest = invoke;
    let runtime = new SlateTriggerReceiverRuntime(core);

    await expect(
      runtime.verifyProviderWebhook({
        receiverTriggerId: 'trigger',
        request,
        ruleId: 'delivery.v1',
        requestId: 'rpc-integrated'
      })
    ).resolves.toMatchObject({ status: 'verified' });
    expect(resolver.resolve.mock.calls[0]![0].requestId).toBe('rpc-integrated');
    expect(resolver.resolve.mock.calls[0]![0].operation).toBe('webhook_verify');
    expect(issue.mock.calls[0]![0].authorityHandle).toBe(issuedHandle);
    expect(invoke).toHaveBeenCalledOnce();

    mutateInvocationId = true;
    await expect(
      runtime.verifyProviderWebhook({
        receiverTriggerId: 'trigger',
        request,
        ruleId: 'delivery.v1',
        requestId: 'rpc-mismatched-invocation'
      })
    ).rejects.toThrow('authority handle');
    expect(invoke).toHaveBeenCalledOnce();

    mutateInvocationId = false;
    replayHandle = true;
    await expect(
      runtime.verifyProviderWebhook({
        receiverTriggerId: 'trigger',
        request,
        ruleId: 'delivery.v1',
        requestId: 'rpc-replayed-handle'
      })
    ).rejects.toThrow('already consumed');
    expect(invoke).toHaveBeenCalledOnce();
  });

  it.each([
    'validation_failure',
    'legacy_fallback',
    'inconsistent_negotiation',
    'missing_issuer',
    'issue_failure',
    'timeout',
    'cancel',
    'success'
  ] as const)('releases authoritative resolution terminally on %s', async outcome => {
    let request: HubWebhookWireRequest = {
      url: 'https://hooks.test/release',
      method: 'POST',
      headers: [],
      body: { present: false }
    };
    let rule = {
      id: 'delivery.v1',
      phase: 'delivery',
      when: { methods: ['POST'] },
      result: { type: 'dispatch', scope: 'receiver_trigger' },
      verify: {
        type: 'provider',
        verifierId: 'quickbooks.delivery.v1',
        allowedSecretRefs: []
      }
    } as const;
    let actionContract: Record<string, any> = {
      id: 'webhook.delivery',
      type: 'action.trigger',
      capabilities: { webhookInboundVerificationV1: true },
      invocation: {
        type: 'webhook',
        autoRegistration: true,
        autoUnregistration: false,
        http: { methods: ['POST'] }
      }
    };
    actionContract.specHash = computeHubWebhookActionSpecHashV1(actionContract);
    let receiverTrigger: any = {
      id: 'trigger',
      action: { key: 'webhook.delivery', spec: actionContract },
      receiver: {
        id: 'receiver',
        tenant: { id: 'tenant' },
        slateInstance: { id: 'instance' }
      }
    };
    let release = vi.fn(async () => {});
    let resolver = {
      resolve: vi.fn(async ({ hubInvocationId }: any) => ({
        authorityHandle: {
          version: 'scoped_invocation_authority_v1',
          id: `handle-${outcome}`,
          token: `token-${outcome}`
        },
        authority: {
          receiverTrigger,
          version: {},
          actionId: 'webhook.delivery',
          hubInvocationId,
          actionContract,
          specHash:
            outcome === 'validation_failure' ? 'f'.repeat(64) : actionContract.specHash,
          rule,
          registrationStatus: 'registered',
          registrationGeneration: 1,
          registrationVersion: 1,
          projectedSecretVersions: {},
          candidateBindings: [],
          redactionSentinels: []
        }
      })),
      release,
      resolveAcceptedProof: vi.fn(),
      resolveRegistration: vi.fn()
    };
    let issue = vi.fn(async ({ requestId }: any) => {
      if (outcome === 'issue_failure') throw new Error('issue failed');
      return {
        version: 'scoped_invocation_grant_v1' as const,
        grantId: `grant-${outcome}`,
        token: `grant-token-${outcome}`,
        requestId
      };
    });
    let verificationDecision =
      outcome === 'legacy_fallback'
        ? ({ status: 'legacy', code: 'capability_absent' } as const)
        : outcome === 'inconsistent_negotiation'
          ? ({
              status: 'fail_closed',
              code: 'webhook_verification_capabilities_inconsistent'
            } as const)
          : ({ status: 'v1' } as const);
    let core: any = {
      security: {
        webhookAuthorityResolver: resolver,
        ...(outcome === 'missing_issuer'
          ? {}
          : { scopedGrantIssuer: { issue, revoke: vi.fn(async () => {}) } })
      },
      negotiateWebhookCapabilities: vi.fn(async () => ({
        registration: { status: 'legacy', code: 'capability_absent' },
        verification: verificationDecision,
        bootstrapCapture: { status: 'unavailable', code: 'capability_absent' }
      })),
      createRestrictedInvocationStack: vi.fn(async () => ({}))
    };
    (slateInvocationService as any).verifyWebhookRequest = vi.fn(async () => {
      if (outcome === 'timeout') throw new Error('provider timeout');
      if (outcome === 'cancel') throw new Error('provider cancelled');
      return {
        status: 'success',
        invocation: { oid: 1n },
        data: { status: 'accepted', selection: { scope: 'receiver_trigger' } }
      };
    });
    let runtime = new SlateTriggerReceiverRuntime(core);
    let invocation = runtime.verifyProviderWebhook({
      receiverTriggerId: 'trigger',
      request,
      ruleId: 'delivery.v1',
      requestId: `rpc-${outcome}`
    });
    if (outcome === 'success' || outcome === 'legacy_fallback') {
      await expect(invocation).resolves.toBeDefined();
    } else {
      await expect(invocation).rejects.toBeDefined();
    }
    expect(release).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: `rpc-${outcome}`,
        operation: 'webhook_verify'
      })
    );
  });

  it.each([
    ['Notion first-token', 'X-Notion-Token', 'notion_token', 'notion.delivery.v1'],
    ['Asana handshake', 'X-Hook-Secret', 'asana_hook_secret', 'asana.delivery.v1']
  ] as const)(
    'models authoritative %s verify-to-capture with one-use proof and CAS',
    async (flow, headerName, captureName, verifierId) => {
      let request: HubWebhookWireRequest = {
        url: 'https://hooks.test/bootstrap',
        method: 'POST',
        headers: [[headerName, 'handshake']],
        body: { present: false }
      };
      let rule = {
        id: 'bootstrap.v1',
        phase: 'bootstrap',
        when: {
          methods: ['POST'],
          registrationStatuses: ['pending'],
          matcher: { hasHeader: headerName }
        },
        result: { type: 'sync_only' },
        verify: {
          type: 'provider',
          verifierId,
          allowedSecretRefs: [],
          allowedBootstrapCaptureRefs: [captureName]
        }
      } as const;
      let actionContract: Record<string, any> = {
        id: 'webhook.bootstrap',
        type: 'action.trigger',
        capabilities: {
          webhookInboundVerificationV1: true,
          webhookInboundBootstrapCaptureV1: true
        },
        invocation: {
          type: 'webhook',
          autoRegistration: true,
          autoUnregistration: false,
          http: {
            methods: ['POST'],
            ingress: {
              kind: 'receiver_route',
              baseline: 'receiver_path_secret',
              verification: {
                mechanism: 'provider',
                baseline: 'receiver_path_secret',
                reason: 'fixture',
                allowedSecretRefs: [],
                rules: [rule]
              }
            }
          }
        }
      };
      actionContract.specHash = computeHubWebhookActionSpecHashV1(actionContract);
      let receiverTrigger: any = {
        id: 'trigger',
        action: { key: 'webhook.bootstrap', spec: actionContract },
        receiver: {
          id: 'receiver',
          tenant: { id: 'tenant' },
          slateInstance: { id: 'instance' }
        }
      };
      let authority: any = {
        receiverTrigger,
        version: {},
        actionId: 'webhook.bootstrap',
        actionContract,
        specHash: actionContract.specHash,
        rule,
        registrationStatus: 'pending',
        registrationGeneration: 2,
        registrationVersion: 3,
        projectedSecretVersions: { [captureName]: 3 },
        candidateBindings: [],
        redactionSentinels: ['captured']
      };
      let proofs = new AcceptedWebhookVerificationProofAuthority(() => 100);
      let revoke = vi.fn(async () => {});
      let commitStatus =
        flow === 'Asana handshake' ? ('duplicate' as const) : ('committed' as const);
      let committedResponse = {
        status: flow === 'Asana handshake' ? 202 : 200,
        headers: [['X-Committed', flow]],
        body: { present: false as const }
      };
      let compareAndSet = vi.fn(async () => ({
        status: commitStatus,
        committed: { response: committedResponse, registrationVersion: 3 }
      }));
      let releaseResolution = vi.fn(async () => {});
      let core: any = {
        security: {
          webhookAuthorityResolver: {
            resolve: vi.fn(async ({ hubInvocationId }: any) => ({
              authority: { ...authority, hubInvocationId },
              authorityHandle: {
                version: 'scoped_invocation_authority_v1',
                id: 'verify-handle',
                token: 'verify-token'
              }
            })),
            resolveAcceptedProof: vi.fn(async ({ hubInvocationId }: any) => ({
              authority: { ...authority, hubInvocationId },
              authorityHandle: {
                version: 'scoped_invocation_authority_v1',
                id: 'capture-handle',
                token: 'capture-token'
              }
            })),
            release: releaseResolution,
            resolveRegistration: vi.fn()
          },
          acceptedVerificationProofs: proofs,
          scopedGrantIssuer: {
            issue: vi.fn(async ({ requestId }: any) => ({
              version: 'scoped_invocation_grant_v1',
              grantId: 'grant',
              token: 'token',
              requestId
            })),
            revoke
          },
          bootstrapCaptureWriter: { compareAndSet }
        },
        negotiateWebhookCapabilities: vi.fn(async () => ({
          registration: { status: 'v1' },
          verification: { status: 'v1' },
          bootstrapCapture: { status: 'v1' }
        })),
        createRestrictedInvocationStack: vi.fn(async () => ({}))
      };
      (slateInvocationService as any).verifyWebhookRequest = vi.fn(async () => ({
        status: 'success',
        invocation: { oid: 1n },
        data: { status: 'accepted', selection: { scope: 'receiver_trigger' } }
      }));
      (slateInvocationService as any).captureWebhookBootstrap = vi.fn(async () => ({
        status: 'success',
        invocation: { oid: 2n },
        data: {
          status: 'accepted',
          capturedSecrets: { [captureName]: { value: 'captured', version: 3 } },
          response: { status: 200, headers: [], body: { present: false } }
        }
      }));
      let runtime = new SlateTriggerReceiverRuntime(core);
      let verified = await runtime.verifyProviderWebhook({
        receiverTriggerId: 'trigger',
        request,
        ruleId: 'bootstrap.v1',
        requestId: 'verify-rpc'
      });
      expect(verified.status).toBe('verified');
      let verifyResolutionInput =
        core.security.webhookAuthorityResolver.resolve.mock.calls[0]![0];
      let verifyIssueInput = core.security.scopedGrantIssuer.issue.mock.calls[0]![0];
      let verifyStackInput = core.createRestrictedInvocationStack.mock.calls[0]![0];
      expect(verifyIssueInput.authorityHandle.id).toBe('verify-handle');
      expect(verifyIssueInput.hubInvocationId).toBe(verifyResolutionInput.hubInvocationId);
      expect(verifyStackInput.hubInvocationId).toBe(verifyResolutionInput.hubInvocationId);
      if (verified.status !== 'verified' || !verified.acceptedProof)
        throw new Error('proof missing');
      let acceptedProof = verified.acceptedProof;
      let bindings = {
        receiverId: 'receiver',
        receiverTriggerId: 'trigger',
        actionId: 'webhook.bootstrap',
        specHash: actionContract.specHash,
        registrationGeneration: 2,
        registrationVersion: 3,
        ruleId: 'bootstrap.v1',
        requestId: 'verify-rpc',
        originalRequestHash: computeHubWebhookWireRequestHash(request),
        dispatchRequestHash: computeHubWebhookWireRequestHash(request),
        selectedItems: []
      };
      let capture =
        flow === 'Asana handshake'
          ? runtime.proposeProviderWebhookBootstrap({
              receiverTriggerId: 'trigger',
              proof: acceptedProof,
              request,
              bindings,
              requestId: 'capture-rpc'
            })
          : runtime.captureProviderWebhookBootstrap({
              receiverTriggerId: 'trigger',
              proof: acceptedProof,
              request,
              requestId: 'capture-rpc'
            });
      await expect(capture).resolves.toMatchObject(
        flow === 'Asana handshake'
          ? { status: 'accepted', bindings, response: { status: 200 } }
          : { status: commitStatus, response: committedResponse }
      );
      let captureResolutionInput =
        core.security.webhookAuthorityResolver.resolveAcceptedProof.mock.calls[0]![0];
      let captureIssueInput = core.security.scopedGrantIssuer.issue.mock.calls[1]![0];
      let captureStackInput = core.createRestrictedInvocationStack.mock.calls[1]![0];
      expect(captureIssueInput.authorityHandle.id).toBe('capture-handle');
      expect(captureIssueInput.hubInvocationId).toBe(captureResolutionInput.hubInvocationId);
      expect(captureStackInput.hubInvocationId).toBe(captureResolutionInput.hubInvocationId);
      expect(compareAndSet).toHaveBeenCalledTimes(flow === 'Asana handshake' ? 0 : 1);
      expect(revoke).toHaveBeenCalledTimes(2);
      expect(releaseResolution).toHaveBeenCalledTimes(2);
      await expect(
        flow === 'Asana handshake'
          ? runtime.proposeProviderWebhookBootstrap({
              receiverTriggerId: 'trigger',
              proof: acceptedProof,
              request,
              bindings
            })
          : runtime.captureProviderWebhookBootstrap({
              receiverTriggerId: 'trigger',
              proof: acceptedProof,
              request
            })
      ).rejects.toThrow('missing or consumed');
    }
  );

  it('returns the Braintree SDK challenge response without capture persistence or state mutation', async () => {
    let request: HubWebhookWireRequest = {
      url: 'https://hooks.test/braintree?bt_challenge=challenge',
      method: 'GET',
      headers: [],
      body: { present: false }
    };
    let rule = {
      id: 'braintree.challenge.v1',
      phase: 'bootstrap',
      when: { methods: ['GET'], matcher: { hasQueryParam: 'bt_challenge' } },
      result: { type: 'sync_only' },
      verify: {
        type: 'provider',
        verifierId: 'braintree.challenge.v1',
        allowedSecretRefs: [],
        allowedBootstrapCaptureRefs: []
      }
    } as const;
    let actionContract: Record<string, any> = {
      id: 'webhook_events',
      type: 'action.trigger',
      capabilities: {
        webhookInboundVerificationV1: true,
        webhookInboundBootstrapCaptureV1: true
      },
      invocation: {
        type: 'webhook',
        autoRegistration: false,
        autoUnregistration: false,
        http: {
          methods: ['GET', 'POST'],
          ingress: {
            kind: 'receiver_route',
            baseline: 'receiver_path_secret',
            verification: {
              mechanism: 'provider',
              baseline: 'receiver_path_secret',
              reason: 'Braintree SDK challenge',
              allowedSecretRefs: [],
              rules: [rule]
            }
          }
        }
      }
    };
    actionContract.specHash = computeHubWebhookActionSpecHashV1(actionContract);
    let receiverTrigger: any = {
      id: 'trigger',
      action: { key: 'webhook_events', spec: actionContract },
      receiver: {
        id: 'receiver',
        tenant: { id: 'tenant' },
        slateInstance: { id: 'instance' }
      }
    };
    let authority: any = {
      receiverTrigger,
      version: {},
      actionId: 'webhook_events',
      actionContract,
      specHash: actionContract.specHash,
      rule,
      registrationStatus: 'pending',
      registrationGeneration: 2,
      registrationVersion: 3,
      projectedSecretVersions: {},
      candidateBindings: [],
      redactionSentinels: []
    };
    let proofs = new AcceptedWebhookVerificationProofAuthority(() => 100);
    let originalRequestHash = computeHubWebhookWireRequestHash(request);
    let proof = proofs.issue({
      ttlMs: 1_000,
      bindings: {
        tenantId: 'tenant',
        slateInstanceId: 'instance',
        receiverId: 'receiver',
        receiverTriggerId: 'trigger',
        actionId: 'webhook_events',
        specHash: actionContract.specHash,
        ruleId: rule.id,
        requestId: 'verify-rpc',
        originalRequestHash,
        registrationGeneration: 2,
        registrationVersion: 3,
        candidateBindings: []
      }
    });
    let compareAndSet = vi.fn();
    let revoke = vi.fn(async () => {});
    let release = vi.fn(async () => {});
    let core: any = {
      security: {
        webhookAuthorityResolver: {
          resolveAcceptedProof: vi.fn(async ({ hubInvocationId }: any) => ({
            authority: { ...authority, hubInvocationId },
            authorityHandle: {
              version: 'scoped_invocation_authority_v1',
              id: 'capture-handle',
              token: 'capture-token'
            }
          })),
          release
        },
        acceptedVerificationProofs: proofs,
        scopedGrantIssuer: {
          issue: vi.fn(async ({ requestId }: any) => ({
            version: 'scoped_invocation_grant_v1',
            grantId: 'grant',
            token: 'token',
            requestId
          })),
          revoke
        },
        bootstrapCaptureWriter: { compareAndSet }
      },
      negotiateWebhookCapabilities: vi.fn(async () => ({
        registration: { status: 'legacy_fallback' },
        verification: { status: 'v1' },
        bootstrapCapture: { status: 'v1' }
      })),
      createRestrictedInvocationStack: vi.fn(async () => ({}))
    };
    let challengeResponse = {
      status: 200,
      headers: [['content-type', 'text/plain']],
      body: { present: true as const, base64: Buffer.from('sdk-response').toString('base64') }
    };
    let captureInvocation = vi.fn(async () => ({
      status: 'success',
      invocation: { oid: 2n },
      data: {
        status: 'accepted',
        capturedSecrets: {},
        response: challengeResponse
      }
    }));
    (slateInvocationService as any).captureWebhookBootstrap = captureInvocation;

    let runtime = new SlateTriggerReceiverRuntime(core);
    await expect(
      runtime.captureProviderWebhookBootstrap({
        receiverTriggerId: 'trigger',
        proof,
        request,
        requestId: 'capture-rpc'
      })
    ).resolves.toEqual({
      status: 'accepted',
      response: challengeResponse,
      registrationVersion: 3
    });
    expect(captureInvocation).toHaveBeenCalledOnce();
    expect(compareAndSet).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
});

describe('Task 3 trusted scoped execution boundary', () => {
  it('terminates a non-cooperative remote invocation and waits for exact acknowledgement', async () => {
    let terminate = vi.fn(async ({ hubInvocationId }: any) => ({
      status: 'terminated' as const,
      hubInvocationId
    }));
    let control: any = {
      timeoutMs: 2,
      terminate,
      assertIsolation: vi.fn()
    };
    let nonCooperative = new Promise<never>(() => {});
    await expect(
      runScopedRemoteInvocation({
        hubInvocationId: 'invocation-noncoop',
        invoke: () => nonCooperative,
        control
      })
    ).rejects.toThrow('confirmed remote termination');
    expect(terminate).toHaveBeenCalledWith({
      hubInvocationId: 'invocation-noncoop',
      reason: 'timeout'
    });
  });

  it('fails the actual restricted stack before transport when execution control is absent', async () => {
    let createInvocation = vi.fn();
    let persistence = vi.fn();
    let event = vi.fn();
    (slateInvocationService as any).createInvocation = createInvocation;
    let core = new SlateTriggerReceiverCore();
    await expect(
      core.createRestrictedInvocationStack({
        receiverTrigger: { receiver: { tenant: {} } } as any,
        version: {} as any,
        hubInvocationId: 'no-control-invocation',
        redactionSentinels: ['sentinel'],
        forbiddenValues: ['grant']
      })
    ).rejects.toThrow('termination control is unavailable');
    expect(createInvocation).not.toHaveBeenCalled();
    expect(persistence).not.toHaveBeenCalled();
    expect(event).not.toHaveBeenCalled();
  });

  it('drives trusted network, persistence, and event denial before restricted transport', async () => {
    let attempts: string[] = [];
    let denied = {
      network: () => {
        attempts.push('network');
        throw new Error('network denied');
      },
      persistence: () => {
        attempts.push('persistence');
        throw new Error('persistence denied');
      },
      event: () => {
        attempts.push('event');
        throw new Error('event denied');
      }
    };
    let createInvocation = vi.fn(async () => ({ trusted: true }));
    (slateInvocationService as any).createInvocation = createInvocation;
    let core = new SlateTriggerReceiverCore({
      scopedInvocationExecutionControl: {
        timeoutMs: 10,
        terminate: vi.fn(),
        assertIsolation: async ({ hubInvocationId, adversarialProbes }) => ({
          status: 'enforced',
          hubInvocationId,
          networkEgress: 'deny_all',
          sideEffects: 'deny_all',
          deniedEffects: adversarialProbes
        }),
        probeDeniedEffect: async ({ hubInvocationId, effect }) => {
          try {
            denied[effect]();
            throw new Error(`${effect} unexpectedly allowed`);
          } catch (error) {
            if ((error as Error).message.endsWith('unexpectedly allowed')) throw error;
          }
          return { status: 'denied', hubInvocationId, effect };
        }
      }
    });
    await expect(
      core.createRestrictedInvocationStack({
        receiverTrigger: { receiver: { tenant: {} } } as any,
        version: {} as any,
        hubInvocationId: 'attested-invocation',
        redactionSentinels: ['sentinel'],
        forbiddenValues: ['grant']
      })
    ).resolves.toEqual({ trusted: true });
    expect(attempts).toEqual(['network', 'persistence', 'event']);
    expect(createInvocation).toHaveBeenCalledOnce();
  });

  it('fails closed on mismatched termination acknowledgement', async () => {
    await expect(
      runScopedRemoteInvocation({
        hubInvocationId: 'expected-invocation',
        invoke: () => new Promise<never>(() => {}),
        control: {
          timeoutMs: 1,
          assertIsolation: vi.fn(),
          probeDeniedEffect: vi.fn(),
          terminate: async () => ({
            status: 'terminated',
            hubInvocationId: 'other-invocation'
          })
        }
      })
    ).rejects.toThrow('not acknowledged');
  });

  it('removes sentinels and all grant/handle metadata from scoped persistence inputs', () => {
    let sentinel = 'task3-persistence-sentinel';
    let sanitized = sanitizeScopedInvocationValue(
      {
        request: { ordinary: sentinel, grant: 'grant-secret' },
        response: { error: `failed with ${sentinel}` },
        logs: [`console output ${sentinel}`],
        traces: [{ url: `https://upstream.test/${sentinel}` }],
        sentry: new Error(`reported ${sentinel} handle-secret`)
      },
      {
        redactionSentinels: [sentinel],
        forbiddenValues: ['grant-secret', 'handle-secret'],
        executionControl: {} as any
      }
    );
    expect(JSON.stringify(sanitized)).not.toContain(sentinel);
    expect(JSON.stringify(sanitized)).not.toContain('grant-secret');
    expect((sanitized.sentry as Error).message).not.toContain('handle-secret');
  });

  it.each(['success', 'error', 'timeout', 'cancel', 'direct console'] as const)(
    'sanitizes injected persistence, log, trace, and Sentry sinks for %s',
    outcome => {
      let sentinel = `task3-${outcome}-sentinel`;
      let grant = `grant-${outcome}`;
      let captured: unknown[] = [];
      let observe = (value: unknown) => captured.push(value);
      let boundary = createScopedInvocationArtifactBoundary(
        {
          redactionSentinels: [sentinel],
          forbiddenValues: [grant, 'authority-handle-token'],
          executionControl: {} as any
        },
        {
          persistence: observe,
          logging: observe,
          tracing: observe,
          reporting: observe
        }
      );
      let artifact = {
        outcome,
        request: { invocation: { grantId: grant, token: grant }, ordinary: sentinel },
        response: { error: `provider ${outcome}: ${sentinel}` },
        directConsole: `console ${sentinel} authority-handle-token`
      };
      boundary.persistence(artifact);
      boundary.logging(artifact.directConsole);
      boundary.tracing([{ baggage: `${sentinel}/${grant}` }]);
      boundary.reporting(new Error(`${outcome}/${sentinel}/${grant}`));

      expect(captured).toHaveLength(4);
      for (let value of captured) {
        let serialized =
          value instanceof Error ? `${value.message}\n${value.stack}` : JSON.stringify(value);
        expect(serialized).not.toContain(sentinel);
        expect(serialized).not.toContain(grant);
        expect(serialized).not.toContain('authority-handle-token');
      }
    }
  );

  it('requires executable deny-all probes for network, persistence, and event effects', async () => {
    let attempts: string[] = [];
    let restrictedBoundary = {
      network: () => {
        attempts.push('network');
        throw new Error('network denied');
      },
      persistence: () => {
        attempts.push('persistence');
        throw new Error('persistence denied');
      },
      event: () => {
        attempts.push('event');
        throw new Error('event denied');
      }
    };
    let assertIsolation = vi.fn(async ({ hubInvocationId, adversarialProbes }: any) => ({
      status: 'enforced' as const,
      hubInvocationId,
      networkEgress: 'deny_all' as const,
      sideEffects: 'deny_all' as const,
      deniedEffects: adversarialProbes
    }));
    await assertScopedInvocationIsolation({
      hubInvocationId: 'invocation-deny-all',
      control: {
        timeoutMs: 10,
        assertIsolation,
        probeDeniedEffect: async ({ hubInvocationId, effect }: any) => {
          try {
            restrictedBoundary[effect as keyof typeof restrictedBoundary]();
          } catch {
            return { status: 'denied', hubInvocationId, effect };
          }
          throw new Error(`${effect} was not denied`);
        },
        terminate: vi.fn()
      } as any
    });
    expect(assertIsolation).toHaveBeenCalledWith({
      hubInvocationId: 'invocation-deny-all',
      networkEgress: 'deny_all',
      sideEffects: 'deny_all',
      adversarialProbes: ['network', 'persistence', 'event']
    });
    expect(attempts).toEqual(['network', 'persistence', 'event']);
  });
});
