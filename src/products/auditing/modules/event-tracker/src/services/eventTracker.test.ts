import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, dispatchSystemEventDelivery } = vi.hoisted(() => ({
  db: { systemEvent: { upsert: vi.fn() } },
  dispatchSystemEventDelivery: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@metorial/db', () => ({
  db,
  ID: { generateId: async (type: string) => `${type}_1` }
}));

vi.mock('@metorial/module-event-delivery', () => ({ dispatchSystemEventDelivery }));

import { eventTrackerService } from './eventTracker';

let callbackEvent = {
  organizationOid: BigInt(4),
  instanceOid: BigInt(33),
  callbackEventId: 'cbe_1',
  callbackId: 'clb_1',
  callbackTriggerKey: 'file.created',
  providerId: 'prov_1'
};

describe('eventTrackerService.recordCallbackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.systemEvent.upsert.mockResolvedValue({ id: 'systemEvent_1' });
  });

  it('stores the flat key:value attributes on the system event', async () => {
    await eventTrackerService.recordCallbackEvent({
      ...callbackEvent,
      attributes: ['fileId:f1', 'range:A1:B2']
    });

    expect(db.systemEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callbackEventId: 'cbe_1' },
        create: expect.objectContaining({
          source: 'callback',
          eventType: 'callback.file.created',
          attributes: ['fileId:f1', 'range:A1:B2']
        }),
        update: {}
      })
    );
    expect(dispatchSystemEventDelivery).toHaveBeenCalledWith({
      systemEventId: 'systemEvent_1'
    });
  });

  it('stores no attributes when the callback event has none', async () => {
    await eventTrackerService.recordCallbackEvent(callbackEvent);

    expect(db.systemEvent.upsert.mock.calls[0]![0].create.attributes).toEqual([]);
  });
});
