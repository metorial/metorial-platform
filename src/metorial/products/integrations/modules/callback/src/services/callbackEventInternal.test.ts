import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, addProcessJob } = vi.hoisted(() => ({
  db: {
    callback: { findUniqueOrThrow: vi.fn() },
    providerTriggerGlobal: { findUnique: vi.fn() },
    callbackEvent: { create: vi.fn() }
  },
  addProcessJob: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: (model: string) => ({ id: `${model}_1`, oid: BigInt(900) })
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: vi.fn()
}));

vi.mock('../queues/processEvent', () => ({
  callbackEventProcessQueue: { add: addProcessJob }
}));

import { callbackEventInternalService } from './callbackEventInternal';

let chatAdapterGlobalOid = BigInt(9);
let otherAdapterGlobalOid = BigInt(10);

let callbackInstance = {
  oid: BigInt(300),
  callbackOid: BigInt(200),
  tenantOid: BigInt(1),
  projectOid: BigInt(11),
  environmentOid: BigInt(3),
  instanceOid: BigInt(33),
  solutionOid: 2
} as any;

let managedCallback = {
  oid: BigInt(200),
  providerOid: BigInt(50),
  ownership: 'managed',
  managedAdapterGlobalOid: chatAdapterGlobalOid
};

let userCallback = {
  oid: BigInt(200),
  providerOid: BigInt(50),
  ownership: 'user',
  managedAdapterGlobalOid: null
};

let adapterTrigger = (globalOid: bigint) => ({
  currentInstance: { oid: BigInt(77), adapter: { globalOid } }
});

let nonAdapterTrigger = { currentInstance: { oid: BigInt(78), adapter: null } };

let recordEvent = () =>
  callbackEventInternalService.recordEvent({
    callbackInstance,
    source: 'webhook' as any,
    providerTriggerKey: 'chat.message.received',
    occurredAt: new Date('2026-02-01T10:00:00Z')
  });

describe('callbackEventInternalService.recordEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.callbackEvent.create.mockResolvedValue({ id: 'cbe_1', oid: BigInt(900) });
  });

  it('records a managed callback event whose trigger belongs to the callback adapter', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(managedCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(
      adapterTrigger(chatAdapterGlobalOid)
    );

    let event = await recordEvent();

    expect(event).toEqual({ id: 'cbe_1', oid: BigInt(900) });
    expect(db.callbackEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerTriggerKey: 'chat.message.received',
          providerTriggerOid: BigInt(77),
          callbackOid: BigInt(200),
          callbackInstanceOid: BigInt(300),
          status: 'pending'
        })
      })
    );
    expect(addProcessJob).toHaveBeenCalledWith({ callbackEventId: 'cbe_1' }, { id: 'cbe_1' });
  });

  it('drops a managed callback event whose trigger belongs to another adapter', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(managedCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(
      adapterTrigger(otherAdapterGlobalOid)
    );

    expect(await recordEvent()).toBeNull();
    expect(db.callbackEvent.create).not.toHaveBeenCalled();
    expect(addProcessJob).not.toHaveBeenCalled();
  });

  it('drops a managed callback event for a trigger no adapter contributed', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(managedCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(nonAdapterTrigger);

    expect(await recordEvent()).toBeNull();
    expect(db.callbackEvent.create).not.toHaveBeenCalled();
  });

  it('drops an adapter trigger event on a user-owned callback', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(userCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(
      adapterTrigger(chatAdapterGlobalOid)
    );

    expect(await recordEvent()).toBeNull();
    expect(db.callbackEvent.create).not.toHaveBeenCalled();
  });

  it('records a non-adapter trigger event on a user-owned callback', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(userCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(nonAdapterTrigger);

    let event = await recordEvent();

    expect(event).toEqual({ id: 'cbe_1', oid: BigInt(900) });
    expect(db.callbackEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerTriggerOid: BigInt(78) })
      })
    );
  });

  it('records a user callback event for a trigger the provider does not declare', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(userCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(null);

    let event = await recordEvent();

    expect(event).toEqual({ id: 'cbe_1', oid: BigInt(900) });
    expect(db.callbackEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ providerTriggerOid: undefined })
      })
    );
  });

  it('looks the trigger up on the callback provider, not the instance', async () => {
    db.callback.findUniqueOrThrow.mockResolvedValue(managedCallback);
    db.providerTriggerGlobal.findUnique.mockResolvedValue(
      adapterTrigger(chatAdapterGlobalOid)
    );

    await recordEvent();

    expect(db.providerTriggerGlobal.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          providerOid_key: {
            providerOid: BigInt(50),
            key: 'chat.message.received'
          }
        }
      })
    );
  });
});
