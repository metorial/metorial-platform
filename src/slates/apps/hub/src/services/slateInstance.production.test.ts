import { computeSlateConfigSchemaV2Hash } from '@slates/proto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  dbMock,
  lifecycleMock,
  outboxMock,
  queueMock,
  receiverSecretMock
} = vi.hoisted(() => ({
  dbMock: {
    $transaction: vi.fn(),
    slateInstance: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
    slateVersion: { findFirstOrThrow: vi.fn() }
  },
  lifecycleMock: { beginRegistrationIntentInTransaction: vi.fn() },
  outboxMock: { enqueuePendingRegistrationOutboxes: vi.fn() },
  queueMock: { add: vi.fn() },
  receiverSecretMock: {
    materializeInstanceConfigRecordInTransaction: vi.fn(),
    applyV2ConfigSecretPatchInTransaction: vi.fn(),
    projectInstanceConfigSecretsToReceiversInTransaction: vi.fn()
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: () => factory() })
  }
}));
vi.mock('../db', () => ({ db: dbMock }));
vi.mock('../id', () => ({ getId: (type: string) => ({ id: `${type}-id`, oid: 900n }) }));
vi.mock('../queues/instance/configChanged', () => ({
  slateInstanceConfigChangedQueue: queueMock
}));
vi.mock('./slateTriggerRegistrationOutbox', () => outboxMock);
vi.mock('./slateTriggerReceiverSecret', () => ({
  slateTriggerReceiverSecretService: receiverSecretMock
}));
vi.mock('./slateTriggerRegistrationLifecycle', () => lifecycleMock);
vi.mock('./secret', () => ({ secretService: {} }));

import { slateInstanceService } from './slateInstance';

let fields = {
  endpoint: { visibility: 'plain' as const, lifecycle: 'none' as const },
  removeMe: { visibility: 'plain' as const, lifecycle: 'none' as const },
  projectionKey: { visibility: 'secret' as const, lifecycle: 'projection' as const },
  renewKey: { visibility: 'secret' as const, lifecycle: 'renew' as const },
  reregisterKey: { visibility: 'secret' as const, lifecycle: 'reregister' as const }
};
let jsonSchema = {
  type: 'object',
  properties: Object.fromEntries(Object.keys(fields).map(key => [key, { type: 'string' }])),
  required: ['endpoint', 'projectionKey', 'renewKey'],
  additionalProperties: false
};
let schema = {
  version: 2,
  descriptorHash: computeSlateConfigSchemaV2Hash({
    version: 2,
    fieldOrder: Object.keys(fields).sort(),
    fields,
    jsonSchema
  }),
  fields,
  schema: jsonSchema,
  compatibility: null
};
let current = {
  oid: 20n,
  id: 'config-1',
  tenantOid: 1n,
  generation: 4,
  schema,
  secrets: [],
  value: {
    endpoint: 'https://preserved.test',
    removeMe: 'remove',
    projectionKey: { configured: true },
    renewKey: { configured: true },
    reregisterKey: { configured: true }
  }
};
let instance = {
  oid: 10n,
  id: 'instance-1',
  tenantOid: 1n,
  currentConfig: current,
  slate: { oid: 30n, currentVersionOid: 40n },
  lockedSlateVersion: null
};

let createTransaction = (order: string[], updateCount = 1) => ({
  slateInstance: { findFirst: vi.fn(async () => instance) },
  slateInstanceConfig: {
    updateMany: vi.fn(async () => {
      order.push('config-cas');
      return { count: updateCount };
    })
  },
  slateInstanceEvent: {
    create: vi.fn(async () => {
      order.push('event');
    })
  },
  slateTriggerReceiverTrigger: {
    findMany: vi.fn(async () => [{ id: 'trigger-1' }, { id: 'trigger-2' }])
  }
});

beforeEach(() => {
  vi.resetAllMocks();
  dbMock.slateInstance.findUniqueOrThrow.mockResolvedValue({
    ...instance,
    slate: instance.slate,
    lockedSlateVersion: null
  });
  dbMock.slateVersion.findFirstOrThrow.mockResolvedValue({
    oid: 40n,
    id: 'version-1',
    status: 'active',
    specification: { slateConfigSchemas: [] }
  });
  dbMock.slateInstance.findFirst.mockResolvedValue(instance);
  receiverSecretMock.materializeInstanceConfigRecordInTransaction.mockResolvedValue({
    endpoint: 'https://preserved.test',
    removeMe: 'remove',
    projectionKey: 'old-projection',
    renewKey: 'old-renew',
    reregisterKey: 'old-reregister'
  });
  receiverSecretMock.applyV2ConfigSecretPatchInTransaction.mockResolvedValue({
    value: {
      endpoint: 'https://preserved.test',
      projectionKey: { configured: true },
      renewKey: { configured: true }
    },
    secretVersionBindings: { projectionKey: 5, renewKey: 6, reregisterKey: 7 }
  });
  outboxMock.enqueuePendingRegistrationOutboxes.mockResolvedValue(undefined);
});

describe('production Slate instance config transaction', () => {
  it('rejects wrong-tenant lookup and generation conflicts before secret work', async () => {
    let tx = createTransaction([]);
    tx.slateInstance.findFirst.mockResolvedValueOnce(null as any);
    dbMock.$transaction.mockImplementationOnce((handler: any) => handler(tx));
    await expect(
      slateInstanceService.patchSlateInstanceConfig({
        tenant: { oid: 2n } as any,
        slateInstance: { oid: 10n } as any,
        patch: { set: { endpoint: 'https://other.test' } }
      })
    ).rejects.toThrow();
    expect(receiverSecretMock.materializeInstanceConfigRecordInTransaction).not.toHaveBeenCalled();

    let generationTx = createTransaction([]);
    dbMock.$transaction.mockImplementationOnce((handler: any) => handler(generationTx));
    await expect(
      slateInstanceService.patchSlateInstanceConfig({
        tenant: { oid: 1n } as any,
        slateInstance: { oid: 10n } as any,
        expectedGeneration: 3,
        patch: { set: { endpoint: 'https://other.test' } }
      })
    ).rejects.toThrow(/changed before this patch/);
    expect(receiverSecretMock.materializeInstanceConfigRecordInTransaction).not.toHaveBeenCalled();
  });

  it('rolls back on CAS conflict before event, projection, or lifecycle work', async () => {
    let order: string[] = [];
    let tx = createTransaction(order, 0);
    dbMock.$transaction.mockImplementation((handler: any) => handler(tx));
    await expect(
      slateInstanceService.patchSlateInstanceConfig({
        tenant: { oid: 1n } as any,
        slateInstance: { oid: 10n } as any,
        expectedGeneration: 4,
        patch: { set: { projectionKey: 'new-projection' } }
      })
    ).rejects.toThrow(/changed before this patch/);
    expect(order).toEqual(['config-cas']);
    expect(receiverSecretMock.projectInstanceConfigSecretsToReceiversInTransaction).not.toHaveBeenCalled();
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('preserves omissions, applies set/remove, projects before one aggregated reregister intent, and enqueues in order', async () => {
    let order: string[] = [];
    let tx = createTransaction(order);
    dbMock.$transaction.mockImplementation((handler: any) => handler(tx));
    receiverSecretMock.projectInstanceConfigSecretsToReceiversInTransaction.mockImplementation(
      async () => {
        order.push('projection');
      }
    );
    lifecycleMock.beginRegistrationIntentInTransaction.mockImplementation(async ({ receiverTriggerId }: any) => {
      order.push(`intent:${receiverTriggerId}`);
      return { outboxId: `outbox:${receiverTriggerId}` };
    });
    queueMock.add.mockImplementation(async () => {
      order.push('config-queue');
    });
    outboxMock.enqueuePendingRegistrationOutboxes.mockImplementation(async () => {
      order.push('outbox-enqueue');
    });

    await slateInstanceService.patchSlateInstanceConfig({
      tenant: { oid: 1n, id: 'tenant-1' } as any,
      slateInstance: { oid: 10n } as any,
      expectedGeneration: 4,
      patch: {
        set: { projectionKey: 'new-projection', renewKey: 'new-renew' },
        remove: ['removeMe', 'reregisterKey']
      },
      now: new Date('2026-08-14T00:00:00.000Z')
    });

    expect(receiverSecretMock.applyV2ConfigSecretPatchInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        set: { projectionKey: 'new-projection', renewKey: 'new-renew' },
        remove: ['removeMe', 'reregisterKey']
      })
    );
    expect(receiverSecretMock.projectInstanceConfigSecretsToReceiversInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ configKeys: ['projectionKey'], expectedGeneration: 5 })
    );
    expect(lifecycleMock.beginRegistrationIntentInTransaction).toHaveBeenCalledTimes(2);
    expect(lifecycleMock.beginRegistrationIntentInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'reregister', configGeneration: 5 })
    );
    expect(queueMock.add).toHaveBeenCalledWith(
      expect.objectContaining({
        configGeneration: 5,
        configSchemaHash: schema.descriptorHash,
        previousConfig: expect.objectContaining({ endpoint: 'https://preserved.test' }),
        newConfig: expect.objectContaining({ endpoint: 'https://preserved.test' })
      })
    );
    expect(order).toEqual([
      'config-cas',
      'event',
      'projection',
      'intent:trigger-1',
      'intent:trigger-2',
      'config-queue',
      'outbox-enqueue'
    ]);
    expect(JSON.stringify(queueMock.add.mock.calls)).not.toMatch(/new-projection|new-renew/);
  });
});
