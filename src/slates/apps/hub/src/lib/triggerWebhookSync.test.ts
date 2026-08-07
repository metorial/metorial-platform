import { describe, expect, it } from 'vitest';
import type { TriggerWebhookRequestPayload } from './triggerWebhook';
import { createSanitizedWebhookResponse, webhookRequestMatches } from './triggerWebhookSync';

let request = (overrides?: Partial<TriggerWebhookRequestPayload>) =>
  ({
    url: 'https://example.test/webhook?challenge=',
    method: 'POST',
    headers: { 'x-hook-secret': 'secret' },
    body: {
      encoding: 'base64',
      content: Buffer.from(
        JSON.stringify([
          {
            eventType: 'Microsoft.EventGrid.SubscriptionValidationEvent',
            data: { challenge: 'abc' }
          }
        ])
      ).toString('base64')
    },
    ...overrides
  }) satisfies TriggerWebhookRequestPayload;

describe('webhookRequestMatches', () => {
  it('ANDs matcher conditions and treats the matcher list at the caller as OR-able', () => {
    expect(
      webhookRequestMatches(request(), {
        method: 'post',
        hasQueryParam: 'challenge',
        hasHeader: 'X-Hook-Secret'
      })
    ).toBe(true);
    expect(webhookRequestMatches(request(), { method: 'GET' })).toBe(false);
  });

  it('resolves nested object fields and numeric array path segments', () => {
    expect(
      webhookRequestMatches(request(), {
        jsonBodyField: {
          path: '0.eventType',
          equals: 'Microsoft.EventGrid.SubscriptionValidationEvent'
        }
      })
    ).toBe(true);
    expect(
      webhookRequestMatches(request(), {
        jsonBodyField: { path: '0.data.challenge' }
      })
    ).toBe(true);
  });

  it('does not match malformed or oversized JSON bodies', () => {
    expect(
      webhookRequestMatches(
        request({
          body: {
            encoding: 'base64',
            content: Buffer.from('{').toString('base64')
          }
        }),
        { jsonBodyField: { path: 'type' } }
      )
    ).toBe(false);

    expect(
      webhookRequestMatches(
        request({
          body: {
            encoding: 'base64',
            content: Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64')
          }
        }),
        { jsonBodyField: { path: 'type' } }
      )
    ).toBe(false);
  });

  it('matches URL-encoded form fields with URLSearchParams semantics', () => {
    let formRequest = request({
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: {
        encoding: 'base64',
        content: Buffer.from('mode=subscribe&challenge=hello+world&mode=ignored').toString(
          'base64'
        )
      }
    });

    expect(
      webhookRequestMatches(formRequest, {
        formBodyField: { path: 'mode', equals: 'subscribe' }
      })
    ).toBe(true);
    expect(
      webhookRequestMatches(formRequest, {
        formBodyField: { path: 'challenge', equals: 'hello world' }
      })
    ).toBe(true);
    expect(
      webhookRequestMatches(formRequest, {
        formBodyField: { path: 'missing' }
      })
    ).toBe(false);
    expect(
      webhookRequestMatches(request(), {
        formBodyField: { path: 'mode' }
      })
    ).toBe(false);
  });
});

describe('createSanitizedWebhookResponse', () => {
  it('preserves provider status/body, strips unsafe headers, and recomputes length', async () => {
    let response = createSanitizedWebhookResponse({
      status: 201,
      headers: {
        'content-type': 'text/plain',
        'content-length': '999',
        connection: 'close, x-connection-only',
        'transfer-encoding': 'chunked',
        'keep-alive': 'timeout=5',
        te: 'trailers',
        trailer: 'x-checksum',
        upgrade: 'websocket',
        'set-cookie': 'secret=value',
        'x-connection-only': 'remove-me',
        'x-provider': 'present'
      },
      body: {
        encoding: 'base64',
        content: Buffer.from('challenge').toString('base64')
      }
    });

    expect(response.status).toBe(201);
    expect(await response.text()).toBe('challenge');
    expect(response.headers.get('content-length')).toBe('9');
    expect(response.headers.get('x-provider')).toBe('present');
    expect(response.headers.get('connection')).toBeNull();
    expect(response.headers.get('transfer-encoding')).toBeNull();
    expect(response.headers.get('keep-alive')).toBeNull();
    expect(response.headers.get('te')).toBeNull();
    expect(response.headers.get('trailer')).toBeNull();
    expect(response.headers.get('upgrade')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-connection-only')).toBeNull();
  });

  it.each([204, 205, 304])('returns no body and zero content length for %i', async status => {
    let response = createSanitizedWebhookResponse({
      status,
      headers: { 'content-length': '999' },
      body: {
        encoding: 'base64',
        content: Buffer.from('must-not-be-sent').toString('base64')
      }
    });

    expect(response.status).toBe(status);
    expect(response.headers.get('content-length')).toBe('0');
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it('normalizes informational provider statuses to an empty final 502 response', async () => {
    let response = createSanitizedWebhookResponse({
      status: 103,
      headers: { 'content-type': 'text/plain' },
      body: {
        encoding: 'base64',
        content: Buffer.from('early hints').toString('base64')
      }
    });

    expect(response.status).toBe(502);
    expect(response.headers.get('content-length')).toBe('0');
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
});
