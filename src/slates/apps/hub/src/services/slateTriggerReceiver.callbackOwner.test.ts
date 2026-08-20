import { beforeEach, describe, expect, it, vi } from 'vitest';

let testState = vi.hoisted(() => ({
  receiver: null as any,
  receiverFindFirst: vi.fn(),
  receiverUpdateMany: vi.fn(),
  receiverTriggerCreate: vi.fn(),
  receiverTriggerUpdate: vi.fn(),
  triggerFindFirst: vi.fn(),
  resolveActionsForTriggers: vi.fn(),
  enqueueOutboxes: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    slateTriggerReceiver: {
      findFirst: testState.receiverFindFirst
    },
    slateTriggerReceiverTrigger: {
      findFirst: testState.triggerFindFirst
    },
    $transaction: async (handler: (tx: any) => Promise<unknown>) =>
      await handler({
        slateTriggerReceiver: {
          updateMany: testState.receiverUpdateMany
        },
        slateTriggerReceiverTrigger: {
          create: testState.receiverTriggerCreate,
          update: testState.receiverTriggerUpdate
        }
      })
  }
}));

vi.mock('./slateSession', () => ({
  slateSessionService: {
    getSessionVersion: vi.fn(async () => ({ specification: { oid: 44n, authMethods: [] } }))
  }
}));
vi.mock('./slateTriggerReceiverCore', () => ({
  SlateTriggerReceiverCore: class {
    resolveActionsForTriggers = testState.resolveActionsForTriggers;
  }
}));
vi.mock('./slateTriggerReceiverRuntime', () => ({
  SlateTriggerReceiverRuntime: class {}
}));
vi.mock('./slateTriggerReceiverSecret', () => ({
  slateTriggerReceiverBootstrapCaptureWriter: {}
}));
vi.mock('./slateTriggerReceiverSecurity', () => ({
  slateTriggerReceiverProductionSecurity: {
    webhookAuthorityResolver: {},
    scopedGrantIssuer: {},
    acceptedVerificationProofs: {}
  }
}));
vi.mock('./slateTriggerReceiverProductionSecurityAdapters', () => ({
  createSlateTriggerReceiverProductionSecurityAdapters: vi.fn(value => value)
}));
vi.mock('./slateTriggerRegistrationOutbox', () => ({
  enqueuePendingRegistrationOutboxes: testState.enqueueOutboxes
}));

import { slateTriggerReceiverServiceImpl } from './slateTriggerReceiver';

let tenant = { oid: 1n, id: 'tenant-1' } as any;
let slate = { oid: 2n, id: 'slate-1' } as any;
let slateInstance = {
  oid: 3n,
  id: 'slate-instance-1',
  slate,
  currentConfig: { oid: 4n }
} as any;

let ownerSnapshot = () => ({
  id: testState.receiver.id,
  callbackId: testState.receiver.callbackId,
  callbackInstanceId: testState.receiver.callbackInstanceId,
  callbackOwnerVersion: testState.receiver.callbackOwnerVersion,
  callbackOwnerMutationId: testState.receiver.callbackOwnerMutationId,
  callbackOwnerMutationDigest: testState.receiver.callbackOwnerMutationDigest,
  status: testState.receiver.status,
  tombstonedAt: testState.receiver.tombstonedAt
});

let upsert = (overrides: Record<string, unknown> = {}) => ({
  tenant,
  slateInstance,
  authConfig: null,
  input: {
    callbackId: 'callback-1',
    callbackInstanceId: 'callback-instance-1',
    expectedSlateTriggerReceiverId: 'receiver-current',
    expectedOwnerVersion: 4,
    ownerMutationId: 'upsert-current-v1',
    triggers: [],
    ...overrides
  }
});

describe('callback receiver compare-and-mutate production service', () => {
  let service: slateTriggerReceiverServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new slateTriggerReceiverServiceImpl();
    testState.receiver = {
      oid: 10n,
      id: 'receiver-current',
      tenantOid: tenant.oid,
      slateOid: slate.oid,
      slateInstanceOid: slateInstance.oid,
      authConfigOid: null,
      callbackId: 'callback-1',
      callbackInstanceId: 'callback-instance-1',
      callbackOwnerVersion: 4,
      callbackOwnerMutationId: null,
      callbackOwnerMutationDigest: null,
      deliveryMode: 'callback_v2',
      status: 'active',
      tombstonedAt: null,
      name: null,
      description: null,
      eventTypes: [],
      updatedAt: new Date('2026-08-14T12:00:00.000Z'),
      slate,
      slateInstance,
      authConfig: null,
      triggers: []
    };
    testState.receiverFindFirst.mockImplementation(async ({ where }: any) => {
      if (where.tenantOid !== testState.receiver.tenantOid) return null;
      if (where.id !== undefined && where.id !== testState.receiver.id) return null;
      if (
        where.callbackId !== undefined &&
        where.callbackId !== testState.receiver.callbackId
      ) {
        return null;
      }
      if (
        where.callbackInstanceId !== undefined &&
        where.callbackInstanceId !== testState.receiver.callbackInstanceId
      ) {
        return null;
      }
      return testState.receiver;
    });
    testState.triggerFindFirst.mockResolvedValue({
      id: 'trigger-1',
      receiver: {
        deliveryMode: 'callback_v2',
        callbackId: 'callback-1',
        callbackInstanceId: 'callback-instance-1'
      }
    });
    testState.receiverUpdateMany.mockImplementation(async ({ where, data }: any) => {
      if (
        where.oid !== testState.receiver.oid ||
        (where.id !== undefined && where.id !== testState.receiver.id) ||
        (where.callbackId !== undefined &&
          where.callbackId !== testState.receiver.callbackId) ||
        (where.callbackInstanceId !== undefined &&
          where.callbackInstanceId !== testState.receiver.callbackInstanceId) ||
        (where.callbackOwnerVersion !== undefined &&
          where.callbackOwnerVersion !== testState.receiver.callbackOwnerVersion)
      ) {
        return { count: 0 };
      }
      for (let [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        if (
          key === 'callbackOwnerVersion' &&
          typeof value === 'object' &&
          value !== null &&
          'increment' in value
        ) {
          testState.receiver.callbackOwnerVersion += (value as any).increment;
        } else {
          testState.receiver[key] = value;
        }
      }
      return { count: 1 };
    });
    testState.receiverTriggerCreate.mockResolvedValue({});
    testState.receiverTriggerUpdate.mockResolvedValue({});
    testState.resolveActionsForTriggers.mockResolvedValue([]);
    testState.enqueueOutboxes.mockResolvedValue(undefined);
  });

  it('persists a filter-only callback trigger update without re-registering its webhook', async () => {
    let action = { oid: 20n, id: 'trigger-action-1' };
    testState.receiver.triggers = [
      {
        oid: 30n,
        id: 'receiver-trigger-1',
        actionOid: action.oid,
        source: 'webhook',
        state: null,
        pollIntervalSeconds: null,
        eventTypes: [],
        tombstonedAt: null
      }
    ];
    testState.resolveActionsForTriggers.mockResolvedValue([
      {
        action,
        state: null,
        pollIntervalSeconds: null,
        eventTypes: ['issue.created'],
        invocation: { type: 'webhook' }
      }
    ]);

    await slateTriggerReceiverServiceImpl.prototype.updateTriggerReceiver.call(service, {
      tenant,
      receiverId: testState.receiver.id,
      callbackOwnerAuthority: {
        callbackId: 'callback-1',
        callbackInstanceId: 'callback-instance-1',
        expectedReceiverId: testState.receiver.id,
        expectedOwnerVersion: 4,
        mutationId: 'filter-only-update',
        mutationDigest: 'filter-only-digest'
      },
      input: {
        triggers: [{ triggerId: action.id, eventTypes: ['issue.created'] }]
      }
    });

    expect(testState.receiverTriggerUpdate).toHaveBeenCalledWith({
      where: { oid: 30n },
      data: expect.objectContaining({ eventTypes: ['issue.created'] })
    });
    expect(testState.enqueueOutboxes).toHaveBeenCalledWith({ outboxIds: [] });
  });

  it('treats an omitted trigger filter as all events without receiver-wide inheritance', async () => {
    await service.upsertTriggerReceiverForCallback(
      upsert({
        ownerMutationId: 'optional-trigger-filter',
        triggers: [
          { triggerId: 'unfiltered-trigger' },
          { triggerId: 'explicit-all-trigger', eventTypes: [] }
        ]
      })
    );

    expect(testState.resolveActionsForTriggers).toHaveBeenCalledWith(
      expect.objectContaining({
        triggers: [
          {
            triggerId: 'unfiltered-trigger',
            eventTypes: [],
            pollIntervalSeconds: undefined
          },
          {
            triggerId: 'explicit-all-trigger',
            eventTypes: [],
            pollIntervalSeconds: undefined
          }
        ]
      })
    );
  });

  it('rejects a stale old-owner upsert and leaves Hub state unchanged', async () => {
    let before = ownerSnapshot();
    await expect(
      service.upsertTriggerReceiverForCallback(
        upsert({
          expectedSlateTriggerReceiverId: 'receiver-old',
          expectedOwnerVersion: 3,
          ownerMutationId: 'stale-upsert'
        })
      )
    ).rejects.toMatchObject({ data: { code: 'callback_owner_conflict' } });
    expect(ownerSnapshot()).toEqual(before);
    expect(testState.receiverUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects receiver replacement by a supplied foreign ID without tuple fallback mutation', async () => {
    let before = ownerSnapshot();
    await expect(
      service.upsertTriggerReceiverForCallback(
        upsert({ expectedSlateTriggerReceiverId: 'receiver-owned-elsewhere' })
      )
    ).rejects.toMatchObject({ data: { code: 'callback_owner_conflict' } });
    expect(ownerSnapshot()).toEqual(before);
    expect(testState.receiverUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects an unfenced generic delete of a callback-owned receiver', async () => {
    let before = ownerSnapshot();
    await expect(
      service.deleteTriggerReceiver({ tenant, receiverId: 'receiver-current' })
    ).rejects.toMatchObject({ data: { code: 'callback_owner_conflict' } });
    expect(ownerSnapshot()).toEqual(before);
    expect(testState.receiverUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects generic renewal of a callback-owned receiver before an intent is written', async () => {
    await expect(
      service.renewWebhookRegistration({ tenant, receiverTriggerId: 'trigger-1' })
    ).rejects.toMatchObject({ data: { code: 'callback_owner_conflict' } });
    expect(testState.receiverUpdateMany).not.toHaveBeenCalled();
    expect(testState.enqueueOutboxes).not.toHaveBeenCalled();
  });

  it('accepts the current owner and makes an upsert retry idempotent', async () => {
    let request = upsert();
    await expect(service.upsertTriggerReceiverForCallback(request)).resolves.toMatchObject({
      id: 'receiver-current',
      callbackOwnerVersion: 5
    });
    expect(testState.receiverUpdateMany).toHaveBeenCalledTimes(1);

    await expect(service.upsertTriggerReceiverForCallback(request)).resolves.toMatchObject({
      id: 'receiver-current',
      callbackOwnerVersion: 5
    });
    expect(testState.receiverUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects mutation-ID reuse with a different digest and preserves Hub state', async () => {
    let first = upsert({ name: 'first-name', ownerMutationId: 'reused-mutation-id' });
    await service.upsertTriggerReceiverForCallback(first);
    let beforeConflict = ownerSnapshot();

    await expect(
      service.upsertTriggerReceiverForCallback(
        upsert({ name: 'different-name', ownerMutationId: 'reused-mutation-id' })
      )
    ).rejects.toMatchObject({ data: { code: 'callback_owner_conflict' } });
    expect(ownerSnapshot()).toEqual(beforeConflict);
    expect(testState.receiverUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects stale delete, accepts current delete, and replays it without a second mutation', async () => {
    let before = ownerSnapshot();
    await expect(
      service.deleteTriggerReceiver({
        tenant,
        receiverId: 'receiver-old',
        callbackOwner: {
          callbackId: 'callback-1',
          callbackInstanceId: 'callback-instance-1',
          expectedOwnerVersion: 3,
          ownerMutationId: 'delete-current-v1'
        }
      })
    ).rejects.toMatchObject({ data: { code: 'callback_owner_conflict' } });
    expect(ownerSnapshot()).toEqual(before);

    let request = {
      tenant,
      receiverId: 'receiver-current',
      callbackOwner: {
        callbackId: 'callback-1',
        callbackInstanceId: 'callback-instance-1',
        expectedOwnerVersion: 4,
        ownerMutationId: 'delete-current-v1'
      }
    };
    await expect(service.deleteTriggerReceiver(request)).resolves.toMatchObject({
      callbackOwnerVersion: 5,
      status: 'paused',
      tombstonedAt: expect.any(Date)
    });
    expect(testState.receiverUpdateMany).toHaveBeenCalledTimes(1);

    await expect(service.deleteTriggerReceiver(request)).resolves.toMatchObject({
      callbackOwnerVersion: 5
    });
    expect(testState.receiverUpdateMany).toHaveBeenCalledTimes(1);
  });
});
