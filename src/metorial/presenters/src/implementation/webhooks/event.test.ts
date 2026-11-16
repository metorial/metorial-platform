import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-event-tracker/src/lib/resolvePayload', () => ({
  resolveSystemEventPayload: vi.fn()
}));

import { v1SystemEventListPresenter, v1SystemEventPresenter } from './event';

let context = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'user_auth_token'
} as const;

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
  attributes: [],
  createdAt: new Date('2026-01-01T00:00:00Z')
} as any;

describe('system event callback payload presentation', () => {
  it('includes hydrated callback payloads in single-event responses', async () => {
    let presented = await v1SystemEventPresenter
      .present({ event, organization }, context)
      .run();

    expect(presented.payload).toEqual({ action: 'opened' });
    expect(presented.callback_event_id).toBe('cbe_1');
  });

  it('omits payloads and payload schema from list items', async () => {
    let presented = await v1SystemEventListPresenter
      .present({ event, organization }, context)
      .run();

    expect(presented).not.toHaveProperty('payload');
    expect(v1SystemEventListPresenter.schema.properties).not.toHaveProperty('payload');
  });
});

describe('system event attributes presentation', () => {
  it('presents stored attributes as a record in list items and single events', async () => {
    let withAttributes = {
      ...event,
      attributes: ['fileId:f1', 'mimeType:text/plain', 'mimeType:image/png', 'range:A1:B2']
    };
    let expected = {
      fileId: ['f1'],
      mimeType: ['text/plain', 'image/png'],
      range: ['A1:B2']
    };

    let listItem = await v1SystemEventListPresenter
      .present({ event: withAttributes, organization }, context)
      .run();
    let single = await v1SystemEventPresenter
      .present({ event: withAttributes, organization }, context)
      .run();

    expect(listItem.attributes).toEqual(expected);
    expect(single.attributes).toEqual(expected);
  });

  it('presents keys that name built-in object members', async () => {
    let keys = ['constructor', 'toString', 'valueOf', 'hasOwnProperty'];
    let withAttributes = {
      ...event,
      attributes: keys.flatMap(key => [`${key}:a`, `${key}:b`])
    };
    let expected = Object.fromEntries(keys.map(key => [key, ['a', 'b']]));

    let listItem = await v1SystemEventListPresenter
      .present({ event: withAttributes, organization }, context)
      .run();
    let single = await v1SystemEventPresenter
      .present({ event: withAttributes, organization }, context)
      .run();

    expect(listItem.attributes).toEqual(expected);
    expect(single.attributes).toEqual(expected);
  });

  it('presents an empty record for events without attributes', async () => {
    let listItem = await v1SystemEventListPresenter
      .present({ event, organization }, context)
      .run();
    let single = await v1SystemEventPresenter.present({ event, organization }, context).run();

    expect(listItem.attributes).toEqual({});
    expect(single.attributes).toEqual({});
  });

  it('declares attributes in both schemas', () => {
    expect(v1SystemEventListPresenter.schema.properties).toHaveProperty('attributes');
    expect(v1SystemEventPresenter.schema.properties).toHaveProperty('attributes');
  });
});
