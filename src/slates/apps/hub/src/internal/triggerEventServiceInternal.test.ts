import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  rawUpdate: vi.fn(),
  dispatchUpsert: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  getId: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    $transaction: mocks.transaction,
    triggerEvent: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
      create: mocks.create,
      findUniqueOrThrow: mocks.findUniqueOrThrow
    }
  }
}));

vi.mock('../id', () => ({ getId: mocks.getId }));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

let { triggerEventServiceInternal } = await import('./triggerEventServiceInternal');

let input = {
  triggerRegistrationInstanceOid: 10n,
  rawEventOid: 20n,
  webhookEventOid: 30n,
  triggerId: 'item_created',
  source: 'webhook' as const
};

describe('triggerEventServiceInternal.upsertPending', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getId.mockReturnValue({ oid: 40n, id: 'sttrev_new' });
  });

  it('creates a pending event for the raw event and trigger', async () => {
    let event = { oid: 40n, id: 'sttrev_new', status: 'pending', ...input };
    mocks.upsert.mockResolvedValue(event);

    await expect(triggerEventServiceInternal.upsertPending(input)).resolves.toBe(event);

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: {
        rawEventOid_triggerId: { rawEventOid: input.rawEventOid, triggerId: input.triggerId }
      },
      create: event,
      update: {}
    });
    expect(mocks.getId).toHaveBeenCalledWith('triggerEvent');
  });

  it('returns an existing mapped event without resetting it or reading a lagging replica', async () => {
    let event = {
      oid: 50n,
      id: 'sttrev_existing',
      status: 'mapped',
      attemptCount: 2,
      payload: { value: 'mapped output' }
    };
    mocks.create.mockRejectedValue({ code: 'P2002' });
    mocks.findUniqueOrThrow.mockRejectedValue({ code: 'P2025' });
    mocks.upsert.mockResolvedValue(event);

    await expect(triggerEventServiceInternal.upsertPending(input)).resolves.toBe(event);

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('generates fresh identifiers after an ID collision', async () => {
    mocks.getId
      .mockReturnValueOnce({ oid: 40n, id: 'sttrev_collision' })
      .mockReturnValueOnce({ oid: 41n, id: 'sttrev_new' });

    let event = { oid: 41n, id: 'sttrev_new', status: 'pending', ...input };
    mocks.upsert
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['oid'] } })
      .mockResolvedValueOnce(event);

    await expect(triggerEventServiceInternal.upsertPending(input)).resolves.toBe(event);

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls.map(([args]) => args.create.oid)).toEqual([40n, 41n]);
    expect(mocks.upsert.mock.calls.map(([args]) => args.create.id)).toEqual([
      'sttrev_collision',
      'sttrev_new'
    ]);
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('retries a concurrent insert conflict and returns the winning event', async () => {
    let event = { oid: 50n, id: 'sttrev_existing', status: 'pending', ...input };
    mocks.upsert
      .mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['rawEventOid', 'triggerId'] }
      })
      .mockResolvedValueOnce(event);

    await expect(triggerEventServiceInternal.upsertPending(input)).resolves.toBe(event);

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('stops after three uniqueness conflicts and preserves the original error', async () => {
    let error = { code: 'P2002', meta: { target: ['oid'] } };
    mocks.upsert.mockRejectedValue(error);

    await expect(triggerEventServiceInternal.upsertPending(input)).rejects.toBe(error);

    expect(mocks.upsert).toHaveBeenCalledTimes(3);
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('propagates unrelated database errors without retrying', async () => {
    let error = { code: 'P2003' };
    mocks.upsert.mockRejectedValue(error);

    await expect(triggerEventServiceInternal.upsertPending(input)).rejects.toBe(error);

    expect(mocks.upsert).toHaveBeenCalledOnce();
  });
});

describe('triggerEventServiceInternal.resolveMapped replay safety', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async fn =>
      fn({
        triggerEvent: { updateMany: mocks.updateMany },
        triggerRawEvent: { update: mocks.rawUpdate },
        triggerEventDispatch: { upsert: mocks.dispatchUpsert }
      })
    );
  });

  it('commits the mapped event and pending count exactly once', async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mocks.rawUpdate.mockResolvedValue({ pendingTriggerMapCount: 0 });
    let data = {
      eventOid: 1n,
      rawEventOid: 2n,
      attempt: 1,
      payload: {},
      mappedType: 'changed',
      mappedId: 'item'
    };
    await expect(triggerEventServiceInternal.resolveMapped(data)).resolves.toMatchObject({
      accepted: true
    });
    await expect(triggerEventServiceInternal.resolveMapped(data)).resolves.toEqual({
      accepted: false,
      rawEvent: null
    });
    expect(mocks.rawUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.dispatchUpsert).toHaveBeenCalledWith({
      where: { eventOid: 1n },
      create: { eventOid: 1n, nextAttemptAt: expect.any(Date) },
      update: {}
    });
    expect(
      mocks.dispatchUpsert.mock.lastCall![0].create.nextAttemptAt.getTime()
    ).toBeGreaterThan(Date.now());
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { oid: 1n, status: { in: ['pending', 'mapping_failed'] } }
      })
    );
  });

  it('propagates failed count writes so the transaction rolls back mapping', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.rawUpdate.mockRejectedValue(new Error('transaction failed'));
    await expect(
      triggerEventServiceInternal.resolveMapped({
        eventOid: 1n,
        rawEventOid: 2n,
        attempt: 1,
        payload: {},
        mappedType: 'changed',
        mappedId: 'item'
      })
    ).rejects.toThrow('transaction failed');
  });
});
