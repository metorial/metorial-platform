import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-event-tracker', () => ({
  resolveSystemEventPayload: vi.fn()
}));

import { v1SystemEventListPresenter, v1SystemEventPresenter } from './event';

let organization = { id: 'org_1' } as any;
let event = {
  id: 'evt_1',
  source: 'callback',
  eventType: 'callback.repository.pushed',
  instance: { id: 'ins_1' },
  callbackPayload: { action: 'opened' },
  callbackId: 'cbk_1',
  callbackEventId: 'cbe_1',
  callbackTriggerKey: 'repository.pushed',
  chatEventId: null,
  chatConnectionId: null,
  providerId: 'pro_1',
  createdAt: new Date('2026-01-01T00:00:00Z')
} as any;

describe('system event callback payload presentation', () => {
  it('includes hydrated callback payloads in single-event responses', async () => {
    let presented = await v1SystemEventPresenter.present({ event, organization }).run();

    expect(presented.payload).toEqual({ action: 'opened' });
    expect(presented.callback_event_id).toBe('cbe_1');
  });

  it('omits payloads and payload schema from list items', async () => {
    let presented = await v1SystemEventListPresenter.present({ event, organization }).run();

    expect(presented).not.toHaveProperty('payload');
    expect(v1SystemEventListPresenter.schema.properties).not.toHaveProperty('payload');
  });
});
