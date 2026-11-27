import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ loadOffloaded: vi.fn() }));

vi.mock('../queues/webhook/payloadOffload', () => ({
  loadOffloadedWebhookEventRequest: mocks.loadOffloaded
}));

vi.mock('../lib/webhookUrl', () => ({
  getWebhookUrl: (registration: { urlKey: string }) =>
    `https://hub.example/receive/${registration.urlKey}`,
  getLocalhostWebhookUrl: () => 'http://localhost/receive/local'
}));

import { adminWebhookEventPresenter } from './adminWebhookTrigger';
import { slateWebhookEventPresenter } from './slateWebhookEvent';

let configUrl = 'https://hub.example/receive/whk_global_config';

let event = (
  registration: { owner: string; urlKey: string },
  request: { url: string } | null
): any => ({
  id: 'event',
  status: 'succeeded',
  attemptCount: 1,
  request: request && {
    method: 'POST',
    url: request.url,
    headers: { authorization: 'Bearer push-token', 'content-type': 'application/json' },
    body: null
  },
  requestStorageKey: request ? null : 'offloaded',
  slateResponse: null,
  responseOverride: null,
  skipped: false,
  skipReason: null,
  webhookRegistration: {
    id: 'registration',
    ...registration,
    slate: { id: 'slate' },
    triggerGroup: { id: 'group' }
  }
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('webhook event presenters', () => {
  it('shows a tenant the URL of its own registration', async () => {
    let own = 'https://hub.example/receive/whk_own';
    let presented = await slateWebhookEventPresenter(
      event({ owner: 'tenant', urlKey: 'whk_own' }, { url: own })
    );

    expect(presented.request).toMatchObject({
      url: own,
      headers: { authorization: '[REDACTED]' }
    });
  });

  it('hides the delivery config an event was handed on from', async () => {
    let presented = await slateWebhookEventPresenter(
      event({ owner: 'tenant', urlKey: 'whk_own' }, { url: configUrl })
    );

    expect(JSON.stringify(presented)).not.toContain('whk_global_config');
    expect(presented.request!.url).toBe('https://hub.example/receive/[REDACTED]');
  });

  it('hides the URL of an event that arrived on a shared registration', async () => {
    let presented = await slateWebhookEventPresenter(
      event(
        { owner: 'global', urlKey: 'whk_global_slack' },
        {
          url: 'https://hub.example/receive/whk_global_slack'
        }
      )
    );

    expect(presented.request!.url).toBe('https://hub.example/receive/[REDACTED]');
  });

  it('masks a request that was moved to storage as well', async () => {
    mocks.loadOffloaded.mockResolvedValue({
      method: 'POST',
      url: configUrl,
      headers: {},
      body: null
    });

    let presented = await slateWebhookEventPresenter(
      event({ owner: 'tenant', urlKey: 'whk_own' }, null)
    );

    expect(mocks.loadOffloaded).toHaveBeenCalledWith('offloaded');
    expect(presented.request!.url).toBe('https://hub.example/receive/[REDACTED]');
  });

  it('keeps the full URL for operators and still hides credentials', async () => {
    let presented = await adminWebhookEventPresenter(
      event({ owner: 'tenant', urlKey: 'whk_own' }, { url: configUrl })
    );

    expect(presented.request).toMatchObject({
      url: configUrl,
      headers: { authorization: '[REDACTED]' }
    });
  });
});
