import { describe, expect, it, vi } from 'vitest';
import { computeWebhookActionSpecHashV1 } from '@slates/proto';

let dbMocks = vi.hoisted(() => ({
  slateTriggerWebhookRequest: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn()
  },
  slateTriggerWebhookRequestPayload: { updateMany: vi.fn() },
  slateTriggerReceiverTrigger: { findUnique: vi.fn(), updateMany: vi.fn() },
  slateProvisionedTenantAppProjection: { findUnique: vi.fn() },
  slateProvisionedAppRouteSecret: { findMany: vi.fn() },
  slateTriggerEventInput: { create: vi.fn() },
  slateTriggerWebhookDispatchOutbox: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn()
  },
  slateTriggerWebhookReplayClaim: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn()
  },
  slateTriggerEvent: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(
    async (callback: (tx: any) => Promise<unknown>) => await callback(dbMocks)
  )
}));
let signalMocks = vi.hoisted(() => ({
  createIdempotent: vi.fn(),
  getByIdempotencyKey: vi.fn()
}));
let requestCryptoMocks = vi.hoisted(() => ({
  decrypt: vi.fn(),
  encrypt: vi.fn()
}));
let capturedSecretMocks = vi.hoisted(() => ({ persist: vi.fn() }));
let queueMocks = vi.hoisted(() => ({ addManyWithOps: vi.fn() }));

vi.mock('../db', () => ({ db: dbMocks }));

vi.mock('./slateTriggerReceiverSecret', () => ({
  slateTriggerReceiverSecretService: {
    persistCapturedRegistrationSecretsInTransaction: capturedSecretMocks.persist
  }
}));
vi.mock('../signal', () => ({ signal: { event: signalMocks } }));
vi.mock('../queues/trigger/eventQueues', () => ({
  slateTriggerEventProcessQueue: { addManyWithOps: queueMocks.addManyWithOps },
  slateTriggerEventSendQueue: { process: vi.fn(() => ({})) },
  slateTriggerWebhookDispatchOutboxQueue: { process: vi.fn(() => ({})) }
}));
vi.mock('./slateTriggerReceiver', () => ({ slateTriggerReceiverService: {} }));
vi.mock('./slateTriggerWebhookRequestCrypto', () => ({
  decryptWebhookRequestPayloadEnvelope: requestCryptoMocks.decrypt,
  encryptWebhookRequestPayload: requestCryptoMocks.encrypt
}));
import {
  WEBHOOK_OUTBOX_MAX_ATTEMPTS,
  SlateTriggerWebhookReplayService,
  classifySignalDispatchError,
  computeHubSignalIdempotencyKey,
  computeHubSignalRequestFingerprint,
  computeWebhookOutboxBackoffMs,
  hashAuthenticatedWebhookDeliveryId,
  WEBHOOK_OUTBOX_RETENTION_MS
} from './slateTriggerWebhookReplay';
import { runWithWebhookOutboxLeaseHeartbeat } from '../queues/trigger/send';
import { computeWebhookStateHash } from '../lib/webhookVerification';
import { computeWebhookWireRequestHash, type WebhookWireRequest } from '../lib/webhookWire';

let resetOutboxMocks = () => {
  for (let value of [
    ...Object.values(dbMocks.slateTriggerWebhookDispatchOutbox),
    ...Object.values(dbMocks.slateTriggerWebhookRequest),
    ...Object.values(dbMocks.slateTriggerWebhookRequestPayload),
    ...Object.values(dbMocks.slateTriggerReceiverTrigger),
    ...Object.values(dbMocks.slateProvisionedTenantAppProjection),
    ...Object.values(dbMocks.slateProvisionedAppRouteSecret),
    ...Object.values(dbMocks.slateTriggerEventInput),
    ...Object.values(dbMocks.slateTriggerWebhookReplayClaim),
    ...Object.values(dbMocks.slateTriggerEvent),
    signalMocks.createIdempotent,
    signalMocks.getByIdempotencyKey,
    requestCryptoMocks.decrypt,
    requestCryptoMocks.encrypt,
    capturedSecretMocks.persist,
    queueMocks.addManyWithOps
  ])
    value.mockReset();
};

let signalRequest = {
  tenantId: 'tenant-a',
  senderId: 'sender-a',
  idempotencyKey: 'stable-key',
  topics: ['users', 'orders', 'orders'],
  eventType: 'created',
  payloadJson: '{"z":1, "a":2}',
  headers: { 'X-Z': '2', 'x-a': '1' },
  onlyForDestinations: ['dest-b', 'dest-a', 'dest-a'],
  callbackId: 'callback-a',
  callbackInstanceId: 'instance-a',
  callbackSourceId: 'source-a',
  callbackTriggerId: 'trigger-a'
};

let commitWireRequest: WebhookWireRequest = {
  url: 'https://hooks.test/receiver',
  method: 'POST',
  headers: [['x-delivery-id', 'delivery-a']],
  body: { present: true, base64: Buffer.from('{"accepted":true}').toString('base64') }
};

let createProductionCommitFixture = (
  d: {
    proposedState?: boolean;
    stateCasCount?: number;
    sync?: boolean;
  } = {}
) => {
  let contract: any = {
    id: 'action-a',
    type: 'action.trigger',
    capabilities: { webhookInboundVerificationV1: true },
    invocation: {
      type: 'webhook',
      autoRegistration: false,
      autoUnregistration: false,
      http: {
        methods: ['POST'],
        ingress: {
          kind: 'receiver_route',
          baseline: 'receiver_path_secret',
          verification: {
            mechanism: 'path_secret_only',
            baseline: 'receiver_path_secret',
            reason: 'production atomic-commit fixture'
          }
        }
      }
    }
  };
  contract.specHash = computeWebhookActionSpecHashV1(contract);
  let originalRequestHash = computeWebhookWireRequestHash(commitWireRequest);
  let state = { cursor: 1 };
  let trigger = {
    oid: 21n,
    id: 'trigger-a',
    receiverOid: 22n,
    actionOid: 23n,
    registrationGeneration: 4,
    registrationVersion: 7,
    verificationMechanism: 'path_secret_only',
    verificationSpecHash: contract.specHash,
    state,
    action: { key: contract.id, spec: contract },
    receiver: {
      id: 'receiver-a',
      slateOid: 24n,
      slateInstanceOid: 25n,
      tenant: { id: 'tenant-a', signalTenantId: 'signal-tenant-a' },
      slate: { id: 'slate-a' },
      slateInstance: { id: 'instance-a' }
    }
  };
  let payload = {
    oid: 12n,
    tenantId: 'tenant-a',
    receiverId: 'receiver-a',
    encryptedRequest: 'encrypted-original',
    encryptionVersion: 1,
    aadVersion: 1,
    expiresAt: new Date('2026-08-14T00:01:00.000Z')
  };
  let request = {
    oid: 11n,
    id: 'request-a',
    tenantId: 'tenant-a',
    receiverOwnerId: 'receiver-a',
    selectedRule: null,
    authenticatedBoundaryKind: 'receiver_route',
    authenticatedBoundaryAt: new Date('2026-08-14T00:00:00.000Z'),
    authenticatedBindingHash: 'b'.repeat(64),
    processedAt: null,
    requestHash: originalRequestHash,
    payload
  };
  let bindings = {
    receiverId: request.payload.receiverId,
    receiverTriggerId: trigger.id,
    actionId: contract.id,
    specHash: contract.specHash,
    registrationGeneration: trigger.registrationGeneration,
    registrationVersion: trigger.registrationVersion,
    ruleId: 'path_secret_only',
    requestId: request.id,
    originalRequestHash,
    dispatchRequestHash: originalRequestHash,
    selectedItems: []
  };
  let input: any = {
    requestId: request.id,
    receiverId: request.payload.receiverId,
    originalRequestHash,
    dispatches: d.sync
      ? []
      : [
          {
            bindings,
            acceptedRequest: commitWireRequest,
            inputs: [{ accepted: true }],
            replayKeys: ['delivery-a'],
            replayTtlSeconds: 60,
            ...(d.proposedState
              ? {
                  proposedState: {
                    value: { cursor: 2 },
                    expectedPriorVersion: trigger.registrationVersion,
                    expectedPriorHash: computeWebhookStateHash(state)
                  }
                }
              : {})
          }
        ],
    syncs: d.sync
      ? [
          {
            bindings,
            response: { status: 200, headers: [], body: { present: false } },
            capturedSecrets: { clientState: { value: 'captured-secret', version: 3 } },
            replayKeys: ['delivery-a'],
            replayTtlSeconds: 120
          }
        ]
      : []
  };
  let memory = {
    payloadExpiry: payload.expiresAt,
    eventInputs: [] as any[],
    claims: [] as any[],
    outboxes: [] as any[]
  };
  requestCryptoMocks.decrypt.mockResolvedValue(commitWireRequest);
  requestCryptoMocks.encrypt.mockResolvedValue({
    encryptedRequest: 'encrypted-accepted',
    encryptionVersion: 1,
    aadVersion: 1
  });
  capturedSecretMocks.persist.mockResolvedValue(undefined);
  dbMocks.slateTriggerWebhookRequest.findUnique.mockImplementation(async () => ({
    ...request,
    payload: { ...payload, expiresAt: memory.payloadExpiry }
  }));
  dbMocks.slateTriggerWebhookRequest.findUniqueOrThrow.mockResolvedValue({ oid: request.oid });
  dbMocks.slateTriggerWebhookRequest.updateMany.mockResolvedValue({ count: 1 });
  dbMocks.slateTriggerWebhookRequestPayload.updateMany.mockImplementation(
    async ({ data }: any) => {
      memory.payloadExpiry = data.expiresAt;
      return { count: 1 };
    }
  );
  dbMocks.slateTriggerReceiverTrigger.findUnique.mockResolvedValue(trigger);
  dbMocks.slateTriggerReceiverTrigger.updateMany.mockResolvedValue({
    count: d.stateCasCount ?? 1
  });
  dbMocks.slateTriggerEventInput.create.mockImplementation(async ({ data }: any) => {
    memory.eventInputs.push(data);
    return data;
  });
  dbMocks.slateTriggerWebhookReplayClaim.create.mockImplementation(async ({ data }: any) => {
    if (
      memory.claims.some(
        claim =>
          claim.receiverTriggerOid === data.receiverTriggerOid &&
          claim.specHash === data.specHash &&
          claim.ruleId === data.ruleId &&
          claim.itemBindingHash === data.itemBindingHash &&
          claim.deliveryIdHash === data.deliveryIdHash
      )
    ) {
      throw { code: 'P2002' };
    }
    memory.claims.push(data);
    return data;
  });
  dbMocks.slateTriggerWebhookDispatchOutbox.create.mockImplementation(
    async ({ data }: any) => {
      memory.outboxes.push(data);
      return data;
    }
  );
  dbMocks.slateTriggerWebhookReplayClaim.findFirst.mockImplementation(async () => {
    let claim = memory.claims[0];
    return claim ? { ...claim, receiverTrigger: { id: trigger.id } } : null;
  });
  dbMocks.slateTriggerWebhookReplayClaim.findMany.mockImplementation(async () =>
    memory.claims
      .filter(claim => claim.kind === 'dispatch')
      .map(claim => ({
        eventInput: {
          id: memory.eventInputs.find(eventInput => eventInput.oid === claim.eventInputOid)?.id
        }
      }))
  );
  dbMocks.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => {
    let snapshot = {
      payloadExpiry: memory.payloadExpiry,
      eventInputs: memory.eventInputs.length,
      claims: memory.claims.length,
      outboxes: memory.outboxes.length
    };
    try {
      return await callback(dbMocks);
    } catch (error) {
      memory.payloadExpiry = snapshot.payloadExpiry;
      memory.eventInputs.length = snapshot.eventInputs;
      memory.claims.length = snapshot.claims;
      memory.outboxes.length = snapshot.outboxes;
      throw error;
    }
  });
  return { input, memory, request, trigger };
};

let createSharedProductionCommitFixture = () => {
  let fixture = createProductionCommitFixture();
  let contract = fixture.trigger.action.spec as any;
  contract.invocation.http.ingress = {
    kind: 'shared_provisioned_app',
    baseline: 'app_route_secret',
    routeFamily: 'slack',
    verification: {
      mechanism: 'hub',
      allowedSecretRefs: [],
      rules: [
        {
          id: 'delivery.v1',
          phase: 'delivery',
          when: { methods: ['POST'], registrationStatuses: ['registered'] },
          verify: { type: 'preset', preset: 'slack.v0' },
          result: { type: 'dispatch', scope: 'receiver_trigger' },
          replay: {
            kind: 'enforced',
            freshness: {
              source: 'preset',
              presetField: 'timestamp',
              format: 'unix_seconds',
              maxAgeSeconds: 300,
              maxFutureSkewSeconds: 30
            },
            deduplicate: {
              source: 'header',
              headerName: 'x-slack-request-timestamp',
              ttlSeconds: 3600,
              scope: 'request'
            }
          }
        }
      ]
    }
  };
  contract.specHash = computeWebhookActionSpecHashV1(contract);
  Object.assign(fixture.trigger, {
    source: 'webhook',
    tombstonedAt: null,
    ingressDisabledAt: null,
    verificationSpecHash: contract.specHash,
    verificationMechanism: 'hub'
  });
  Object.assign(fixture.trigger.receiver, {
    oid: fixture.trigger.receiverOid,
    tenantOid: 31n,
    status: 'active',
    tombstonedAt: null
  });
  fixture.request.authenticatedBoundaryKind = 'shared_provisioned_app';
  fixture.request.authenticatedBindingHash = 'c'.repeat(64);
  let authority = {
    routeProjectionId: 'route-1',
    routeGeneration: 3,
    routeProjectionDigest: `sha256:${'a'.repeat(64)}`,
    bindingProjectionId: 'binding-1',
    bindingGeneration: 5,
    bindingProjectionDigest: `sha256:${'b'.repeat(64)}`,
    externalOwnershipKey: 'owner-1',
    authenticatedPathSecrets: [{ id: 'path-current', version: 2 }],
    authenticatedVendorSecrets: [{ id: 'vendor-current', version: 4 }],
    bindingHash: fixture.request.authenticatedBindingHash
  };
  Object.assign(fixture.input.dispatches[0].bindings, {
    specHash: contract.specHash,
    ruleId: 'delivery.v1',
    sharedAppAuthority: authority
  });
  let routeProjection = {
    provisionedRouteId: authority.routeProjectionId,
    routeIdentifier: 'slack-main',
    generation: authority.routeGeneration,
    vendor: 'slack',
    purpose: 'shared_provisioned_app',
    credentialOwnerRef: 'managed-slack-app',
    status: 'active',
    tombstonedAt: null,
    expiresAt: null,
    projectionDigest: authority.routeProjectionDigest
  };
  let sharedBinding = {
    provisionedTenantAppId: authority.bindingProjectionId,
    routeProjection,
    routeIdentifier: routeProjection.routeIdentifier,
    routeGeneration: routeProjection.generation,
    tenantOid: fixture.trigger.receiver.tenantOid,
    receiverOid: fixture.trigger.receiverOid,
    receiverTriggerOid: fixture.trigger.oid,
    hubReceiverGeneration: fixture.trigger.registrationGeneration,
    triggerActionId: contract.id,
    triggerSpecHash: contract.specHash,
    vendor: routeProjection.vendor,
    purpose: 'shared_provisioned_app',
    externalOwnershipKey: authority.externalOwnershipKey,
    generation: authority.bindingGeneration,
    status: 'active',
    tombstonedAt: null,
    expiresAt: null,
    projectionDigest: authority.bindingProjectionDigest
  };
  dbMocks.slateProvisionedTenantAppProjection.findUnique.mockResolvedValue(sharedBinding);
  dbMocks.slateProvisionedAppRouteSecret.findMany.mockResolvedValue([
    {
      id: 'path-current',
      secretVersion: 2,
      purpose: 'app_route_path',
      vendor: 'slack',
      credentialOwnerRef: routeProjection.credentialOwnerRef,
      status: 'active',
      validFrom: new Date(0),
      validUntil: null
    },
    {
      id: 'vendor-current',
      secretVersion: 4,
      purpose: 'vendor_verification',
      vendor: 'slack',
      credentialOwnerRef: routeProjection.credentialOwnerRef,
      status: 'active',
      validFrom: new Date(0),
      validUntil: null
    }
  ]);
  return { ...fixture, sharedBinding, routeProjection };
};

describe('authenticated webhook replay identities', () => {
  it('stores an opaque keyed delivery identity bound to rule, spec, and item', () => {
    let base = {
      receiverTriggerId: 'trigger-a',
      specHash: 'spec-a',
      ruleId: 'rule-a',
      itemBindingHash: 'item-a',
      deliveryId: 'secret-vendor-delivery-id'
    };
    let hash = hashAuthenticatedWebhookDeliveryId(base);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(base.deliveryId);
    expect(hashAuthenticatedWebhookDeliveryId(base)).toBe(hash);
    expect(hashAuthenticatedWebhookDeliveryId({ ...base, specHash: 'spec-b' })).not.toBe(hash);
    expect(
      hashAuthenticatedWebhookDeliveryId({ ...base, itemBindingHash: 'item-b' })
    ).not.toBe(hash);
  });

  it('derives one stable Signal key from every authoritative immutable binding', () => {
    let input = {
      tenantId: 'tenant-a',
      receiverTriggerId: 'trigger-a',
      specHash: 'spec-a',
      ruleId: 'rule-a',
      deliveryIdHash: 'delivery-a',
      itemBindingHash: 'item-a',
      adapterVersion: 1,
      originalRequestHash: 'original-a',
      dispatchRequestHash: 'dispatch-a',
      outboxId: 'outbox-a',
      eventInputId: 'input-a'
    };
    let key = computeHubSignalIdempotencyKey(input);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(computeHubSignalIdempotencyKey(input)).toBe(key);
    expect(computeHubSignalIdempotencyKey({ ...input, tenantId: 'tenant-b' })).not.toBe(key);
    expect(computeHubSignalIdempotencyKey({ ...input, outboxId: 'outbox-b' })).not.toBe(key);
  });
});

describe('Hub Signal request fingerprint', () => {
  it('matches the shared protocol v1 vector', () => {
    expect(computeHubSignalRequestFingerprint(signalRequest)).toBe(
      'bcfe0b247b0e8d7b48047b84b08236c8c9416164c1d6a45d131972b4c1d50617'
    );
    expect(
      computeHubSignalRequestFingerprint({
        ...signalRequest,
        topics: ['orders', 'users'],
        headers: { 'x-a': '1', 'x-z': '2' },
        onlyForDestinations: ['dest-a', 'dest-b']
      })
    ).toBe(computeHubSignalRequestFingerprint(signalRequest));
  });

  it.each([
    ['tenantId', 'tenant-b'],
    ['senderId', 'sender-b'],
    ['eventType', 'updated'],
    ['payloadJson', '{"a":2,"z":1}'],
    ['callbackId', 'callback-b'],
    ['callbackInstanceId', 'instance-b'],
    ['callbackSourceId', 'source-b'],
    ['callbackTriggerId', 'trigger-b']
  ] as const)('binds %s', (field, value) => {
    expect(computeHubSignalRequestFingerprint({ ...signalRequest, [field]: value })).not.toBe(
      computeHubSignalRequestFingerprint(signalRequest)
    );
  });

  it('preserves the Hub-facing error for non-canonical Signal headers', () => {
    expect(() =>
      computeHubSignalRequestFingerprint({
        ...signalRequest,
        headers: { 'X-Test': 'a', 'x-test': 'b' }
      })
    ).toThrow('Non-canonical Signal headers');
  });
});

describe('outbox retry policy', () => {
  it('uses bounded exponential backoff with bounded jitter', () => {
    expect(computeWebhookOutboxBackoffMs({ attemptCount: 1, random: 0 })).toBe(1000);
    expect(computeWebhookOutboxBackoffMs({ attemptCount: 2, random: 0 })).toBe(2000);
    expect(computeWebhookOutboxBackoffMs({ attemptCount: 4, random: 0.999 })).toBeLessThan(
      10_000
    );
    expect(
      computeWebhookOutboxBackoffMs({
        attemptCount: WEBHOOK_OUTBOX_MAX_ATTEMPTS + 20,
        random: 0
      })
    ).toBe(15 * 60_000);
  });

  it('claims due or expired work by owner CAS and rejects the losing owner', async () => {
    resetOutboxMocks();
    let now = new Date('2026-08-14T00:00:00.000Z');
    dbMocks.slateTriggerWebhookDispatchOutbox.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    dbMocks.slateTriggerWebhookDispatchOutbox.findUnique.mockResolvedValue({
      id: 'outbox-a'
    });
    let service = new SlateTriggerWebhookReplayService();

    await expect(
      service.claimOutbox({ outboxId: 'outbox-a', owner: 'owner-a', now, leaseMs: 5000 })
    ).resolves.toMatchObject({ id: 'outbox-a' });
    await expect(
      service.claimOutbox({ outboxId: 'outbox-a', owner: 'owner-b', now, leaseMs: 5000 })
    ).resolves.toBeNull();
    expect(
      dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mock.calls[0]?.[0]
    ).toMatchObject({
      where: {
        id: 'outbox-a',
        OR: expect.arrayContaining([{ status: 'leased', leaseExpiresAt: { lte: now } }])
      },
      data: {
        status: 'leased',
        leaseOwner: 'owner-a',
        leaseExpiresAt: new Date(now.getTime() + 5000),
        attemptCount: { increment: 1 }
      }
    });
  });

  it('renews only a live lease owned by the caller', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    let service = new SlateTriggerWebhookReplayService();
    await expect(service.renewLease({ outboxId: 'outbox-a', owner: 'owner-a' })).resolves.toBe(
      true
    );
    await expect(service.renewLease({ outboxId: 'outbox-a', owner: 'owner-b' })).resolves.toBe(
      false
    );
    expect(
      dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mock.calls[0]?.[0]
    ).toMatchObject({
      where: {
        id: 'outbox-a',
        status: 'leased',
        leaseOwner: 'owner-a',
        leaseExpiresAt: { gt: expect.any(Date) }
      }
    });
  });

  it('rejects equality-expired owners before Signal and every terminal mutation', async () => {
    resetOutboxMocks();
    let now = new Date('2026-08-14T00:00:00.000Z');
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(null);
    let service = new SlateTriggerWebhookReplayService();
    await expect(
      service.dispatchLeased({ outboxId: 'outbox-a', owner: 'old-owner', now })
    ).resolves.toBe(false);
    await expect(
      service.retryLeased({
        outboxId: 'outbox-a',
        owner: 'old-owner',
        safeCode: 'signal_transport',
        now
      })
    ).resolves.toBe(false);
    await expect(
      service.deadLetter({
        outboxId: 'outbox-a',
        owner: 'old-owner',
        safeCode: 'terminal',
        now
      })
    ).resolves.toBe(false);
    await expect(
      service.confirmDelivered({
        outboxId: 'outbox-a',
        owner: 'old-owner',
        signalEventId: 'event-a',
        signalFingerprint: 'fingerprint-a',
        now
      })
    ).resolves.toBe(false);
    expect(signalMocks.createIdempotent).not.toHaveBeenCalled();
    for (let call of dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mock.calls) {
      expect(call[0].where).toMatchObject({
        status: 'leased',
        leaseOwner: 'old-owner',
        leaseExpiresAt: { gt: now }
      });
    }
  });

  it('retries with bounded scheduling and preserves immutable outbox fields', async () => {
    resetOutboxMocks();
    let now = new Date('2026-08-14T00:00:00.000Z');
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue({
      oid: 1n,
      replayClaimOid: 2n,
      attemptCount: 2
    });
    dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mockResolvedValue({ count: 1 });
    dbMocks.slateTriggerWebhookReplayClaim.updateMany.mockResolvedValue({ count: 1 });
    let service = new SlateTriggerWebhookReplayService();
    await expect(
      service.retryLeased({
        outboxId: 'outbox-a',
        owner: 'owner-a',
        safeCode: 'signal_transport',
        now
      })
    ).resolves.toBe(true);
    let data = dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      status: 'retryable',
      leaseOwner: null,
      leaseExpiresAt: null,
      safeTerminalCode: 'signal_transport'
    });
    expect(data.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(now.getTime() + 2000);
    expect(data).not.toHaveProperty('signalIdempotencyKey');
    expect(data).not.toHaveProperty('signalRequestFingerprint');
    expect(data).not.toHaveProperty('localEventId');
  });

  it('dead-letters exhausted attempts under the same lease owner', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue({
      oid: 1n,
      replayClaimOid: 2n,
      attemptCount: WEBHOOK_OUTBOX_MAX_ATTEMPTS
    });
    let service = new SlateTriggerWebhookReplayService();
    let deadLetter = vi.spyOn(service, 'deadLetter').mockResolvedValue(true);
    await expect(
      service.retryLeased({
        outboxId: 'outbox-a',
        owner: 'owner-a',
        safeCode: 'signal_transport'
      })
    ).resolves.toBe(true);
    expect(deadLetter).toHaveBeenCalledWith({
      outboxId: 'outbox-a',
      owner: 'owner-a',
      safeCode: 'attempts_exhausted'
    });
  });

  it('redrives only tenant-owned dead letters without replacing durable identity', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mockResolvedValue({ count: 1 });
    let service = new SlateTriggerWebhookReplayService();
    await expect(
      service.redrive({ outboxId: 'outbox-a', tenantId: 'tenant-a' })
    ).resolves.toBe(true);
    let mutation = dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mock.calls[0]?.[0];
    expect(mutation.where).toEqual({
      id: 'outbox-a',
      tenantId: 'tenant-a',
      status: 'dead_letter'
    });
    for (let immutable of [
      'signalIdempotencyKey',
      'signalRequestFingerprint',
      'localEventId',
      'localSourceId',
      'itemBindingHash',
      'deliveryIdHashes',
      'encryptedAcceptedPayload'
    ])
      expect(mutation.data).not.toHaveProperty(immutable);
  });
});

describe('ambiguous Signal create recovery', () => {
  let outbox = {
    id: 'outbox-a',
    signalRequestFingerprint: 'fingerprint-a',
    signalRequest: { tenantId: 'tenant-a', idempotencyKey: 'key-a' }
  };

  it('confirms a tenant-scoped matching lookup after create timeout', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(outbox);
    signalMocks.createIdempotent.mockRejectedValue(new Error('timeout'));
    signalMocks.getByIdempotencyKey.mockResolvedValue({
      id: 'signal-event-a',
      requestFingerprint: 'fingerprint-a'
    });
    let service = new SlateTriggerWebhookReplayService();
    let confirm = vi.spyOn(service, 'confirmDelivered').mockResolvedValue(true);
    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(true);
    expect(signalMocks.getByIdempotencyKey).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      idempotencyKey: 'key-a'
    });
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ signalEventId: 'signal-event-a' })
    );
  });

  it('retries not-found ambiguity and dead-letters a fingerprint mismatch', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(outbox);
    signalMocks.createIdempotent.mockRejectedValue(new Error('timeout'));
    signalMocks.getByIdempotencyKey.mockRejectedValueOnce({ data: { code: 'not_found' } });
    let service = new SlateTriggerWebhookReplayService();
    let retry = vi.spyOn(service, 'retryLeased').mockResolvedValue(true);
    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(false);
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ safeCode: 'signal_event_not_found' })
    );

    signalMocks.getByIdempotencyKey.mockResolvedValueOnce({
      id: 'signal-event-b',
      requestFingerprint: 'different'
    });
    let deadLetter = vi.spyOn(service, 'deadLetter').mockResolvedValue(true);
    await service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' });
    expect(deadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ safeCode: 'idempotency_payload_conflict' })
    );
  });

  it('dead-letters validation 4xx immediately without lookup or retry', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(outbox);
    signalMocks.createIdempotent.mockRejectedValue({
      data: { status: 422, code: 'validation_error' }
    });
    let service = new SlateTriggerWebhookReplayService();
    let deadLetter = vi.spyOn(service, 'deadLetter').mockResolvedValue(true);
    let retry = vi.spyOn(service, 'retryLeased').mockResolvedValue(true);
    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(false);
    expect(deadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ safeCode: 'signal_request_rejected' })
    );
    expect(signalMocks.getByIdempotencyKey).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it.each([
    [{ data: { status: 401, code: 'unauthorized' } }, 'signal_authentication_failed'],
    [{ data: { status: 403, code: 'forbidden' } }, 'signal_authorization_failed'],
    [{ data: { status: 400, code: 'bad_request' } }, 'signal_request_rejected'],
    [
      { data: { status: 409, code: 'idempotency_payload_conflict' } },
      'idempotency_payload_conflict'
    ]
  ])('never retries terminal Signal create failure %#', async (error, safeCode) => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(outbox);
    signalMocks.createIdempotent.mockRejectedValue(error);
    let service = new SlateTriggerWebhookReplayService();
    let deadLetter = vi.spyOn(service, 'deadLetter').mockResolvedValue(true);
    let retry = vi.spyOn(service, 'retryLeased').mockResolvedValue(true);

    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(false);
    expect(deadLetter).toHaveBeenCalledWith(expect.objectContaining({ safeCode }));
    expect(signalMocks.getByIdempotencyKey).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it('dead-letters a malformed success response without retrying', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(outbox);
    signalMocks.createIdempotent.mockResolvedValue({ id: '', requestFingerprint: 123 });
    let service = new SlateTriggerWebhookReplayService();
    let deadLetter = vi.spyOn(service, 'deadLetter').mockResolvedValue(true);
    let retry = vi.spyOn(service, 'retryLeased').mockResolvedValue(true);

    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(false);
    expect(deadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ safeCode: 'signal_invalid_response' })
    );
    expect(retry).not.toHaveBeenCalled();
  });
});

describe('outbox callback event filtering', () => {
  it('terminalizes a staged callback event when its trigger filter changed before retry', async () => {
    resetOutboxMocks();
    let outbox = {
      oid: 1n,
      id: 'outbox-a',
      replayClaimOid: 2n,
      localEventId: 'event-a',
      signalRequestFingerprint: 'fingerprint-a',
      signalRequest: { ...signalRequest, eventType: 'issue.updated' },
      localSourceId: 'source-a',
      eventInput: { id: 'event-input-a', input: { issue: 1 } },
      receiverTrigger: {
        eventTypes: ['issue.created'],
        action: { id: 'trigger-a', key: 'issues' },
        receiver: {
          deliveryMode: 'callback_v2',
          callbackId: 'callback-a',
          tenant: { id: 'tenant-a' }
        }
      }
    };
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst
      .mockResolvedValueOnce(outbox)
      .mockResolvedValueOnce(outbox);
    dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mockResolvedValue({ count: 1 });
    dbMocks.slateTriggerWebhookReplayClaim.update.mockResolvedValue({});
    dbMocks.slateTriggerEvent.findUnique.mockResolvedValue({ signalEventId: '' });
    dbMocks.slateTriggerEvent.updateMany.mockResolvedValue({ count: 1 });

    let service = new SlateTriggerWebhookReplayService();
    let recordLifecycle = vi
      .spyOn(service, 'recordFilteredCallbackEvent')
      .mockResolvedValue(null as any);
    await expect(
      service.dispatchLeased({
        outboxId: outbox.id,
        owner: 'owner-a'
      })
    ).resolves.toBe(true);

    expect(signalMocks.createIdempotent).not.toHaveBeenCalled();
    expect(recordLifecycle).toHaveBeenCalledWith({
      receiver: outbox.receiverTrigger.receiver,
      action: outbox.receiverTrigger.action,
      event: {
        id: 'event-input-a',
        status: 'skipped',
        type: 'issue.updated',
        sourceId: 'source-a',
        input: { issue: 1 }
      }
    });
    expect(dbMocks.slateTriggerWebhookDispatchOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'delivered',
          confirmedSignalEventId: null,
          safeTerminalCode: 'event_type_filtered'
        })
      })
    );
    expect(recordLifecycle.mock.invocationCallOrder[0]).toBeLessThan(
      dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mock.invocationCallOrder[0]!
    );
    expect(dbMocks.slateTriggerWebhookReplayClaim.update).toHaveBeenCalledWith({
      where: { oid: 2n },
      data: { status: 'delivered', leaseExpiresAt: null }
    });
    expect(dbMocks.slateTriggerEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'event-a', signalEventId: '' },
      data: { deliveryStatus: 'skipped' }
    });
  });
});

describe('Signal failure classification', () => {
  it.each([
    [{ data: { status: 401, code: 'unauthorized' } }, 'signal_authentication_failed'],
    [{ data: { status: 403, code: 'forbidden' } }, 'signal_authorization_failed'],
    [{ data: { status: 422, code: 'validation_error' } }, 'signal_request_rejected'],
    [
      { data: { status: 409, code: 'idempotency_payload_conflict' } },
      'idempotency_payload_conflict'
    ]
  ])('makes 4xx terminal %#', (error, safeCode) => {
    expect(classifySignalDispatchError(error)).toEqual({ type: 'terminal', safeCode });
  });

  it('keeps transport and 5xx failures on the ambiguous recovery path', () => {
    expect(classifySignalDispatchError(new Error('timeout')).type).toBe('ambiguous');
    expect(classifySignalDispatchError({ data: { status: 503 } })).toEqual({
      type: 'ambiguous',
      safeCode: 'signal_server_error'
    });
  });
});

describe('outbox lease heartbeat', () => {
  it('reports owner loss while the RPC is in flight and clears the heartbeat', async () => {
    let tick: (() => Promise<void>) | undefined;
    let clear = vi.fn();
    let release: (() => void) | undefined;
    let running = new Promise<void>(resolve => {
      release = resolve;
    });
    let heartbeat = runWithWebhookOutboxLeaseHeartbeat({
      renew: vi.fn(async () => false),
      run: async () => {
        await running;
        return 'finished';
      },
      setIntervalFn: ((handler: () => Promise<void>) => {
        tick = handler;
        return 1 as any;
      }) as any,
      clearIntervalFn: clear as any
    });
    await tick!();
    release!();
    await expect(heartbeat).resolves.toEqual({ result: 'finished', leaseLost: true });
    expect(clear).toHaveBeenCalledWith(1);
  });

  it('waits for an in-flight renewal before reporting dispatch ownership', async () => {
    let tick: (() => Promise<void>) | undefined;
    let resolveRenewal: ((value: boolean) => void) | undefined;
    let renewal = new Promise<boolean>(resolve => {
      resolveRenewal = resolve;
    });
    let heartbeat = runWithWebhookOutboxLeaseHeartbeat({
      renew: async () => await renewal,
      run: async () => {
        void tick!();
        return 'rpc-finished';
      },
      setIntervalFn: ((handler: () => Promise<void>) => {
        tick = handler;
        return 2 as any;
      }) as any,
      clearIntervalFn: vi.fn() as any
    });
    resolveRenewal!(false);
    await expect(heartbeat).resolves.toEqual({ result: 'rpc-finished', leaseLost: true });
  });

  it('stops and awaits an in-flight renewal before terminal lease release', async () => {
    let tick: (() => Promise<void>) | undefined;
    let resolveRenewal: ((value: boolean) => void) | undefined;
    let renewal = new Promise<boolean>(resolve => {
      resolveRenewal = resolve;
    });
    let clear = vi.fn();
    let terminalMutation = vi.fn(async () => 'delivered');
    let heartbeat = runWithWebhookOutboxLeaseHeartbeat({
      renew: async () => await renewal,
      run: async ({ stopBeforeLeaseRelease }) => {
        void tick!();
        let terminal = stopBeforeLeaseRelease().then(terminalMutation);
        await Promise.resolve();
        expect(terminalMutation).not.toHaveBeenCalled();
        resolveRenewal!(true);
        return await terminal;
      },
      setIntervalFn: ((handler: () => Promise<void>) => {
        tick = handler;
        return 3 as any;
      }) as any,
      clearIntervalFn: clear as any
    });

    await expect(heartbeat).resolves.toEqual({ result: 'delivered', leaseLost: false });
    expect(terminalMutation).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('does not report a false lease loss when a stopped heartbeat observes terminal state', async () => {
    let tick: (() => Promise<void>) | undefined;
    let renew = vi.fn(async () => false);
    let heartbeat = runWithWebhookOutboxLeaseHeartbeat({
      renew,
      run: async ({ stopBeforeLeaseRelease }) => {
        await stopBeforeLeaseRelease();
        await tick!();
        return 'dead-lettered';
      },
      setIntervalFn: ((handler: () => Promise<void>) => {
        tick = handler;
        return 4 as any;
      }) as any,
      clearIntervalFn: vi.fn() as any
    });

    await expect(heartbeat).resolves.toEqual({
      result: 'dead-lettered',
      leaseLost: false
    });
    expect(renew).not.toHaveBeenCalled();
  });
});

describe('production atomic commit boundary', () => {
  it('rechecks shared route, binding, receiver, and trigger state in the commit transaction', async () => {
    let mutations: Array<
      (fixture: ReturnType<typeof createSharedProductionCommitFixture>) => void
    > = [
      fixture => (fixture.trigger.tombstonedAt = new Date()),
      fixture => (fixture.trigger.ingressDisabledAt = new Date()),
      fixture => (fixture.trigger.receiver.status = 'deleted'),
      fixture => (fixture.trigger.receiver.tombstonedAt = new Date()),
      fixture => (fixture.sharedBinding.status = 'tombstoned'),
      fixture => (fixture.routeProjection.status = 'tombstoned')
    ];
    for (let mutate of mutations) {
      resetOutboxMocks();
      let fixture = createSharedProductionCommitFixture();
      mutate(fixture);
      await expect(
        new SlateTriggerWebhookReplayService().commit(fixture.input)
      ).resolves.toEqual({ status: 'rejected', code: 'mapped_output_invalid' });
      expect(fixture.memory).toMatchObject({ eventInputs: [], claims: [], outboxes: [] });
    }

    resetOutboxMocks();
    let ready = createSharedProductionCommitFixture();
    await expect(
      new SlateTriggerWebhookReplayService().commit(ready.input)
    ).resolves.toMatchObject({ status: 'committed' });
    expect(ready.memory).toMatchObject({
      eventInputs: [expect.any(Object)],
      claims: [expect.any(Object)],
      outboxes: [expect.any(Object)]
    });
  });

  it('rejects malformed mapped output before creating any replay row', async () => {
    resetOutboxMocks();
    let fixture = createProductionCommitFixture();
    fixture.input.dispatches[0].bindings.dispatchRequestHash = 'wrong-hash';

    await expect(
      new SlateTriggerWebhookReplayService().commit(fixture.input)
    ).resolves.toEqual({
      status: 'rejected',
      code: 'mapped_output_invalid'
    });
    expect(fixture.memory).toMatchObject({ eventInputs: [], claims: [], outboxes: [] });
    expect(dbMocks.slateTriggerWebhookRequestPayload.updateMany).not.toHaveBeenCalled();
  });

  it('commits retained payload, input, replay claim, and outbox as one transaction', async () => {
    resetOutboxMocks();
    let before = Date.now();
    let fixture = createProductionCommitFixture();
    await expect(
      new SlateTriggerWebhookReplayService().commit(fixture.input)
    ).resolves.toMatchObject({ status: 'committed' });
    expect(fixture.memory.eventInputs).toHaveLength(1);
    expect(fixture.memory.claims).toHaveLength(1);
    expect(fixture.memory.outboxes).toHaveLength(1);
    expect(fixture.memory.payloadExpiry.getTime()).toBeGreaterThanOrEqual(
      before + WEBHOOK_OUTBOX_RETENTION_MS
    );
    expect(fixture.memory.payloadExpiry).toEqual(
      fixture.memory.outboxes[0].retentionExpiresAt
    );
    expect(fixture.memory.outboxes[0]).toMatchObject({
      encryptedAcceptedPayload: 'encrypted-accepted',
      acceptedPayloadEncryptionKeyVersion: 1,
      acceptedPayloadAadVersion: 1,
      signalIdempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
  });

  it('rolls every local row back when outbox insertion crashes before commit', async () => {
    resetOutboxMocks();
    let fixture = createProductionCommitFixture();
    let originalExpiry = fixture.memory.payloadExpiry;
    dbMocks.slateTriggerWebhookDispatchOutbox.create.mockImplementationOnce(
      async ({ data }: any) => {
        fixture.memory.outboxes.push(data);
        throw new Error('simulated local database crash');
      }
    );

    await expect(new SlateTriggerWebhookReplayService().commit(fixture.input)).rejects.toThrow(
      'simulated local database crash'
    );
    expect(fixture.memory).toEqual({
      payloadExpiry: originalExpiry,
      eventInputs: [],
      claims: [],
      outboxes: []
    });
  });

  it('keeps the committed outbox when post-commit queue enqueue crashes', async () => {
    resetOutboxMocks();
    let fixture = createProductionCommitFixture();
    queueMocks.addManyWithOps.mockRejectedValueOnce(new Error('queue unavailable'));
    let log = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        new SlateTriggerWebhookReplayService().commit(fixture.input)
      ).resolves.toMatchObject({ status: 'committed' });
      expect(fixture.memory.eventInputs).toHaveLength(1);
      expect(fixture.memory.claims).toHaveLength(1);
      expect(fixture.memory.outboxes).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });

  it('rolls payload retention and every row back when the proposed-state CAS loses', async () => {
    resetOutboxMocks();
    let losing = createProductionCommitFixture({ proposedState: true, stateCasCount: 0 });
    let originalExpiry = losing.memory.payloadExpiry;

    await expect(new SlateTriggerWebhookReplayService().commit(losing.input)).resolves.toEqual(
      {
        status: 'rejected',
        code: 'state_cas_conflict'
      }
    );
    expect(losing.memory).toEqual({
      payloadExpiry: originalExpiry,
      eventInputs: [],
      claims: [],
      outboxes: []
    });

    let fresh = createProductionCommitFixture({ proposedState: true, stateCasCount: 1 });
    await expect(
      new SlateTriggerWebhookReplayService().commit(fresh.input)
    ).resolves.toMatchObject({ status: 'committed' });
    expect(fresh.memory).toMatchObject({
      eventInputs: [expect.any(Object)],
      claims: [expect.any(Object)],
      outboxes: [expect.any(Object)]
    });
  });

  it('lets one replay-identity transaction win and confirms the committed winner', async () => {
    resetOutboxMocks();
    let fixture = createProductionCommitFixture();
    let service = new SlateTriggerWebhookReplayService();

    await expect(service.commit(fixture.input)).resolves.toMatchObject({
      status: 'committed'
    });
    let winner = fixture.memory.claims[0];
    await expect(service.commit(fixture.input)).resolves.toMatchObject({
      status: 'duplicate',
      commitId: winner.id
    });
    expect(fixture.memory.eventInputs).toHaveLength(1);
    expect(fixture.memory.claims).toHaveLength(1);
    expect(fixture.memory.outboxes).toHaveLength(1);
  });

  it('atomically caches sync response and captured-secret CAS for crash-safe duplicates', async () => {
    resetOutboxMocks();
    let before = Date.now();
    let fixture = createProductionCommitFixture({ sync: true });
    let service = new SlateTriggerWebhookReplayService();
    // Treat the first committed return value as lost to model a crash before the caller sees it.
    await service.commit(fixture.input);
    await expect(service.commit(fixture.input)).resolves.toMatchObject({
      status: 'duplicate',
      response: { status: 200, headers: [], body: { present: false } }
    });
    expect(fixture.memory.claims).toHaveLength(1);
    expect(fixture.memory.eventInputs).toHaveLength(0);
    expect(fixture.memory.outboxes).toHaveLength(0);
    expect(capturedSecretMocks.persist).toHaveBeenCalledOnce();
    expect(fixture.memory.payloadExpiry.getTime()).toBeGreaterThanOrEqual(before + 120_000);
  });
});

describe('outbox crash recovery boundary', () => {
  it('quiesces heartbeat renewal before terminal delivery clears the lease', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue({
      id: 'outbox-terminal-delivery',
      signalRequestFingerprint: 'fingerprint-a',
      signalRequest: { tenantId: 'tenant-a', idempotencyKey: 'stable-key' }
    });
    signalMocks.createIdempotent.mockResolvedValue({
      id: 'signal-event-a',
      requestFingerprint: 'fingerprint-a'
    });
    let order: string[] = [];
    let service = new SlateTriggerWebhookReplayService();
    vi.spyOn(service, 'confirmDelivered').mockImplementation(async () => {
      order.push('confirm');
      return true;
    });

    await expect(
      service.dispatchLeased({
        outboxId: 'outbox-terminal-delivery',
        owner: 'owner-a',
        beforeLeaseRelease: async () => {
          order.push('stop');
        }
      })
    ).resolves.toBe(true);
    expect(order).toEqual(['stop', 'confirm']);
  });

  it('quiesces heartbeat renewal before terminal dead-letter clears the lease', async () => {
    resetOutboxMocks();
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue({
      id: 'outbox-terminal-dead-letter',
      signalRequestFingerprint: 'fingerprint-a',
      signalRequest: { tenantId: 'tenant-a', idempotencyKey: 'stable-key' }
    });
    signalMocks.createIdempotent.mockRejectedValue({ data: { status: 400 } });
    let order: string[] = [];
    let service = new SlateTriggerWebhookReplayService();
    vi.spyOn(service, 'deadLetter').mockImplementation(async () => {
      order.push('dead-letter');
      return true;
    });

    await expect(
      service.dispatchLeased({
        outboxId: 'outbox-terminal-dead-letter',
        owner: 'owner-a',
        beforeLeaseRelease: async () => {
          order.push('stop');
        }
      })
    ).resolves.toBe(false);
    expect(order).toEqual(['stop', 'dead-letter']);
  });

  it('reuses the Signal idempotency key when delivery CAS is lost after Signal commits', async () => {
    resetOutboxMocks();
    let outbox = {
      id: 'outbox-crash',
      signalRequestFingerprint: 'fingerprint-a',
      signalRequest: { tenantId: 'tenant-a', idempotencyKey: 'stable-key' }
    };
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue(outbox);
    signalMocks.createIdempotent.mockResolvedValue({
      id: 'signal-event-a',
      requestFingerprint: 'fingerprint-a'
    });
    let service = new SlateTriggerWebhookReplayService();
    let confirm = vi
      .spyOn(service, 'confirmDelivered')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(false);
    await expect(
      service.dispatchLeased({ outboxId: outbox.id, owner: 'owner-a' })
    ).resolves.toBe(true);
    expect(signalMocks.createIdempotent).toHaveBeenCalledTimes(2);
    expect(signalMocks.createIdempotent.mock.calls[0]).toEqual(
      signalMocks.createIdempotent.mock.calls[1]
    );
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('recovers a locally delivered event with a same-event CAS under the live lease', async () => {
    resetOutboxMocks();
    let now = new Date('2026-08-14T12:00:00.000Z');
    dbMocks.slateTriggerWebhookDispatchOutbox.findFirst.mockResolvedValue({
      oid: 1n,
      replayClaimOid: 2n,
      localEventId: 'local-event-a',
      signalRequestFingerprint: 'fingerprint-a'
    });
    dbMocks.slateTriggerWebhookDispatchOutbox.updateMany.mockResolvedValue({ count: 1 });
    dbMocks.slateTriggerWebhookReplayClaim.update.mockResolvedValue({});
    dbMocks.slateTriggerEvent.findUnique.mockResolvedValue({
      deliveryStatus: 'sent',
      signalEventId: 'signal-event-a'
    });
    dbMocks.slateTriggerEvent.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      new SlateTriggerWebhookReplayService().confirmDelivered({
        outboxId: 'outbox-a',
        owner: 'owner-a',
        signalEventId: 'signal-event-a',
        signalFingerprint: 'fingerprint-a',
        now
      })
    ).resolves.toBe(true);
    expect(dbMocks.slateTriggerWebhookDispatchOutbox.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'outbox-a',
        status: 'leased',
        leaseOwner: 'owner-a',
        leaseExpiresAt: { gt: now }
      }
    });
    expect(dbMocks.slateTriggerEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'local-event-a', signalEventId: 'signal-event-a' },
      data: { signalEventId: 'signal-event-a', deliveryStatus: 'sent' }
    });
  });
});
