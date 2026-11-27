import { describe, expect, it } from 'vitest';
import { redactWebhookRequest } from './redactWebhookRequest';

let requestTo = (url: string) => ({
  method: 'POST',
  url,
  headers: { 'content-type': 'application/json' },
  body: { encoding: 'base64' as const, content: 'e30=' }
});

describe('redactWebhookRequest', () => {
  it('hides credential headers and keeps the rest of the request', () => {
    let request = {
      method: 'POST',
      url: 'https://hub.example/receive/whk_own',
      headers: {
        Authorization: 'Bearer shared-push-token',
        'proxy-authorization': 'Basic abc',
        'x-goog-channel-id': 'channel',
        'content-type': 'application/json'
      },
      body: { encoding: 'base64' as const, content: 'e30=' }
    };

    expect(redactWebhookRequest(request)).toEqual({
      ...request,
      headers: {
        Authorization: '[REDACTED]',
        'proxy-authorization': '[REDACTED]',
        'x-goog-channel-id': 'channel',
        'content-type': 'application/json'
      }
    });
    expect(request.headers.Authorization).toBe('Bearer shared-push-token');
  });

  it('passes a missing request through', () => {
    expect(redactWebhookRequest(null)).toBeNull();
    expect(redactWebhookRequest(null, { owner: 'tenant', urlKey: 'whk_own' })).toBeNull();
  });

  it.each([
    'https://hub.example/receive/whk_own',
    'https://hub.example/receive/whk_own/suffix?challenge=1',
    'http://localhost:52045/receive/whk_own'
  ])('keeps the URL of a tenant registration that received the request itself (%s)', url => {
    expect(
      redactWebhookRequest(requestTo(url), { owner: 'tenant', urlKey: 'whk_own' })
    ).toEqual(requestTo(url));
  });

  it.each([
    // Handed on from a delivery config, or from a registration whose key has since changed.
    [{ owner: 'tenant', urlKey: 'whk_own' }, 'https://hub.example/receive/whk_global_config'],
    [{ owner: 'tenant', urlKey: 'whk_own' }, 'https://hub.example/receive/whk_own_longer'],
    [{ owner: 'tenant', urlKey: 'whk_own' }, 'https://hub.example/receive/whk_ow'],
    [
      { owner: 'tenant', urlKey: 'whk_own' },
      'https://hub.example/receive/whk_other/whk_own?key=whk_own'
    ],
    // Received on a registration every tenant shares.
    [
      { owner: 'global', urlKey: 'whk_global_slack' },
      'https://hub.example/receive/whk_global_slack'
    ],
    [
      { owner: 'global', urlKey: 'whk_global_slack' },
      'https://hub.example/receive/whk_global_slack/events?token=secret'
    ]
  ])('masks the key of a URL that is not the tenant own receive URL (%j %s)', (own, url) => {
    let redacted = redactWebhookRequest(requestTo(url), own)!;

    expect(redacted.url).toBe('https://hub.example/receive/[REDACTED]');
    expect(redacted).toEqual({ ...requestTo(url), url: redacted.url });
  });

  it.each([
    ['https://hub.example/trigger-delivery/operator-binding', 'https://hub.example'],
    ['https://hub.example/other/receive/whk_own', 'https://hub.example'],
    ['/receive/whk_other', ''],
    ['not a url', '']
  ])('reveals nothing of a URL it does not recognise (%s)', (url, origin) => {
    expect(
      redactWebhookRequest(requestTo(url), { owner: 'tenant', urlKey: 'whk_own' })!.url
    ).toBe(`${origin}/receive/[REDACTED]`);
  });
});
