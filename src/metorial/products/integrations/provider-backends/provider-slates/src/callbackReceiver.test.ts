import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    slateTriggerEvent: { findUnique: vi.fn(), create: vi.fn() },
    slateCallbackInstance: { findUnique: vi.fn() }
  }
}));

vi.mock('@metorial-subspace/db', () => ({ db, snowflake: { nextId: () => 100n } }));

import {
  receiveSlatesCallbackEvent,
  type SlatesCallbackEventReceiveParam
} from './callbackReceiver';

let callbackInstance = { oid: 4n, status: 'active' };

let input = (
  overrides: Partial<SlatesCallbackEventReceiveParam> = {}
): SlatesCallbackEventReceiveParam => ({
  tenantIdentifier: 'tenant_1',
  callbackId: 'scb_1',
  callbackInstanceId: 'sci_1',
  triggerEventId: 'ste_1',
  triggerRegistrationId: 'str_1',
  triggerGroupKey: 'files',
  triggerKey: 'file.created',
  source: 'webhook',
  occurredAt: new Date('2026-11-01T10:00:00Z'),
  ...overrides
});

describe('receiveSlatesCallbackEvent', () => {
  let recordEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    db.slateTriggerEvent.findUnique.mockResolvedValue(null);
    db.slateCallbackInstance.findUnique.mockResolvedValue({
      oid: 7n,
      callbackInstance,
      tenant: { slateTenantIdentifier: 'tenant_1' }
    });
    recordEvent.mockResolvedValue({ oid: 900n });
  });

  it('records the event with the attributes the hub sent', async () => {
    let attributes = { fileId: ['f1'], mimeType: ['application/pdf'] };

    let result = await receiveSlatesCallbackEvent(input({ attributes }), { recordEvent });

    expect(result).toEqual({ received: true });
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackInstance,
        providerTriggerKey: 'file.created',
        attributes
      })
    );
    expect(db.slateTriggerEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'ste_1', callbackEventOid: 900n })
    });
  });

  it('records the event without attributes when the hub sent none', async () => {
    await receiveSlatesCallbackEvent(input(), { recordEvent });

    expect(recordEvent.mock.calls[0]![0].attributes).toBeUndefined();
  });

  it('does not record an event it already received', async () => {
    db.slateTriggerEvent.findUnique.mockResolvedValue({ oid: 1n });

    let result = await receiveSlatesCallbackEvent(input({ attributes: { fileId: ['f1'] } }), {
      recordEvent
    });

    expect(result).toEqual({ received: true });
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
