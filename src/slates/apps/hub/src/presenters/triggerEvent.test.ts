import { beforeEach, describe, expect, it, vi } from 'vitest';

let { loadOffloadedTriggerEventPayload } = vi.hoisted(() => ({
  loadOffloadedTriggerEventPayload: vi.fn()
}));

vi.mock('../queues/trigger/payloadOffload', () => ({
  loadOffloadedTriggerEventPayload
}));

import { triggerEventListPresenter, triggerEventPresenter } from './triggerEvent';

let event = (payload: Record<string, any> | null, payloadStorageKey: string | null) =>
  ({
    id: 'tre_1',
    status: 'mapped',
    source: 'webhook',
    triggerId: 'message.received',
    triggerRegistrationInstance: {
      id: 'tri_1',
      triggerGroup: { id: 'trg_1' },
      triggerRegistration: {
        id: 'trr_1',
        callbackInstance: { id: 'cbi_1' }
      }
    },
    mappedType: null,
    mappedId: null,
    payload,
    payloadStorageKey,
    webhookEvent: null,
    attemptCount: 1,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
  }) as any;

describe('trigger event presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits payloads from list items', async () => {
    let presented = await triggerEventListPresenter(event({ value: 'inline' }, null));

    expect(presented).not.toHaveProperty('payload');
    expect(loadOffloadedTriggerEventPayload).not.toHaveBeenCalled();
  });

  it('includes inline payloads in single-event responses', async () => {
    let presented = await triggerEventPresenter(event({ value: 'inline' }, null));

    expect(presented.payload).toEqual({ value: 'inline' });
    expect(loadOffloadedTriggerEventPayload).not.toHaveBeenCalled();
  });

  it('loads offloaded payloads for single-event responses', async () => {
    loadOffloadedTriggerEventPayload.mockResolvedValue({ value: 'offloaded' });

    let presented = await triggerEventPresenter(event(null, 'trigger-events/tre_1/payload'));

    expect(presented.payload).toEqual({ value: 'offloaded' });
    expect(loadOffloadedTriggerEventPayload).toHaveBeenCalledWith(
      'trigger-events/tre_1/payload'
    );
  });
});
