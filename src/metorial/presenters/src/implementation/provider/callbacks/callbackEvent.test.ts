import { describe, expect, it } from 'vitest';
import { v1CallbackEventListPresenter, v1CallbackEventPresenter } from './callbackEvent';

let callbackEvent = {
  id: 'cbe_1',
  status: 'processed',
  source: 'webhook',
  providerTriggerKey: 'repository.pushed',
  mappedType: null,
  mappedId: null,
  callback: { id: 'cbk_1' },
  callbackInstance: { id: 'cbi_1' },
  occurredAt: new Date('2026-01-01T00:00:00Z'),
  readAt: new Date('2026-01-01T01:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z')
} as any;

describe('callback event presentation', () => {
  it('omits read state from public event responses and schemas', async () => {
    for (let presenter of [v1CallbackEventPresenter, v1CallbackEventListPresenter]) {
      let presented = await presenter.present({ callbackEvent }).run();

      expect(presented).not.toHaveProperty('read_at');
      expect(presenter.schema.properties).not.toHaveProperty('read_at');
    }
  });

  it('omits details and payload schema from list items', async () => {
    let presented = await v1CallbackEventListPresenter.present({ callbackEvent }).run();

    expect(presented).not.toHaveProperty('details');
    expect(v1CallbackEventListPresenter.schema.properties).not.toHaveProperty('details');
  });

  it('includes inline payloads in single-event responses', async () => {
    let presented = await v1CallbackEventPresenter
      .present({
        callbackEvent,
        details: {
          status: 'succeeded',
          payload: { action: 'opened' },
          attemptCount: 1,
          error: null,
          webhook: null
        }
      })
      .run();

    expect(presented.details?.payload).toEqual({ action: 'opened' });
  });
});
