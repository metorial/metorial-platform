import { describe, expect, it } from 'vitest';
import { ingestFetch } from '../src';

let post = (path: string, headers: Record<string, string>, body: string = '{}') =>
  ingestFetch(new Request(`http://localhost${path}`, { method: 'POST', headers, body }));

describe('ingestFetch', () => {
  it('answers ping', async () => {
    let response = await ingestFetch(new Request('http://localhost/ping'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  it('returns 404 for unknown routes', async () => {
    let response = await ingestFetch(new Request('http://localhost/nope'));

    expect(response.status).toBe(404);
  });

  it('returns 405 with an Allow header', async () => {
    let response = await ingestFetch(new Request('http://localhost/v1/logs'));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('rejects unsupported media types', async () => {
    let response = await post('/v1/logs', { 'content-type': 'text/plain' });

    expect(response.status).toBe(415);
  });

  it('rejects unsupported content encodings', async () => {
    let response = await post('/v1/logs', {
      'content-type': 'application/json',
      'content-encoding': 'br'
    });

    expect(response.status).toBe(415);
  });

  it('rejects oversized bodies by content-length', async () => {
    let response = await post('/v1/logs', {
      'content-type': 'application/json',
      'content-length': String(64 * 1024 * 1024)
    });

    expect(response.status).toBe(413);
  });

  it('requires a credential on authenticated routes', async () => {
    let response = await post('/v1/logs', { 'content-type': 'application/json' });
    let body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('missing_credential');
    expect(response.headers.get('www-authenticate')).toContain('Bearer');
  });

  it('rejects malformed credentials without touching storage', async () => {
    let response = await post('/v1/logs', {
      'content-type': 'application/json',
      authorization: 'Bearer not-a-token'
    });
    let body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('invalid_credential');
  });

  it('lists bulk dialects', async () => {
    let response = await ingestFetch(new Request('http://localhost/v1/bulk/dialects'));
    let body = (await response.json()) as { object: string; items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.object).toBe('agent_tracking#bulk_dialects');
    expect(body.items).toEqual([
      { client: 'claude-code', channel: 'hook', dialect: 'claude-code.hooks.v1' },
      { client: 'codex', channel: 'hook', dialect: 'codex.hooks.v1' }
    ]);
  });
});
