import { ServiceError } from '@lowerdeck/error';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { isServiceGrantedForInstance } = vi.hoisted(() => ({
  isServiceGrantedForInstance: vi.fn()
}));

vi.mock('@metorial/module-outpost', () => ({
  outpostAccessService: { isServiceGrantedForInstance },
  outpostVerificationTokens: {},
  metorialOutpostResolver: {}
}));

import {
  assertOutpostConnectionAccess,
  getOutpostAuth,
  isValidRoutableIp,
  resolveOutpostForwardedIp,
  resolveOutpostOrigin,
  setOutpostAuth,
  verifyOutpostConnectionRequest
} from '../src/outpost';

let fakeAuth = (overrides: Partial<{ ip: string; base_url: string }> = {}) =>
  ({
    outpostId: 'otp_1',
    instanceId: 'oti_1',
    credentialId: 'otc_1',
    service: 'mcp_connection_proxy',
    grantedServices: ['mcp_connection_proxy'],
    requestId: 'oprq_1',
    timestamp: Math.floor(Date.now() / 1000),
    outpostChain: [],
    proxyContext: { ip: overrides.ip, base_url: overrides.base_url }
  }) as any;

describe('verifyOutpostConnectionRequest', () => {
  it('returns undefined for a direct request with no outpost headers', async () => {
    let app = new Hono();
    let captured: unknown;

    app.get('/x', async c => {
      captured = await verifyOutpostConnectionRequest(c);
      return c.text('ok');
    });

    await app.request('http://test/x');

    expect(captured).toBeUndefined();
  });

  it('rejects with a ServiceError when only some outpost headers are present', async () => {
    // Partial headers are treated as "no outpost involved" today -- only a fully-signed
    // request (all three headers) enters verification, matching the outpost adapter, which
    // always sends all three together.
    let app = new Hono();
    let captured: unknown;

    app.get('/x', async c => {
      captured = await verifyOutpostConnectionRequest(c);
      return c.text('ok');
    });

    await app.request('http://test/x', {
      headers: { 'Metorial-Outpost-Id': 'otp_1' }
    });

    expect(captured).toBeUndefined();
  });
});

describe('setOutpostAuth / getOutpostAuth', () => {
  it('round-trips through the Hono context', async () => {
    let auth = fakeAuth();
    let captured: unknown;

    let app = new Hono().get('/x', async c => {
      setOutpostAuth(c, auth);
      captured = getOutpostAuth(c);
      return c.text('ok');
    });

    await app.request('http://test/x');

    expect(captured).toBe(auth);
  });

  it('returns undefined when nothing was ever set', async () => {
    let captured: unknown;

    let app = new Hono().get('/x', async c => {
      captured = getOutpostAuth(c);
      return c.text('ok');
    });

    await app.request('http://test/x');

    expect(captured).toBeUndefined();
  });
});

describe('isValidRoutableIp', () => {
  it.each([
    ['203.0.113.9', true],
    ['2001:db8::1', true],
    [undefined, false],
    ['', false],
    ['   ', false],
    ['0.0.0.0', false],
    ['::', false],
    ['not-an-ip', false],
    ['999.999.999.999', false]
  ])('%s -> %s', (input, expected) => {
    expect(isValidRoutableIp(input as string | undefined)).toBe(expected);
  });
});

describe('resolveOutpostForwardedIp', () => {
  it('returns the forwarded ip when valid', () => {
    expect(resolveOutpostForwardedIp(fakeAuth({ ip: '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('ignores an empty, invalid, or 0.0.0.0 ip', () => {
    expect(resolveOutpostForwardedIp(fakeAuth({ ip: '' }))).toBeUndefined();
    expect(resolveOutpostForwardedIp(fakeAuth({ ip: '0.0.0.0' }))).toBeUndefined();
    expect(resolveOutpostForwardedIp(fakeAuth({ ip: 'garbage' }))).toBeUndefined();
    expect(resolveOutpostForwardedIp(fakeAuth())).toBeUndefined();
  });

  it('returns undefined when there is no outpost auth at all', () => {
    expect(resolveOutpostForwardedIp(undefined)).toBeUndefined();
  });
});

describe('resolveOutpostOrigin', () => {
  it('returns a well-formed absolute base_url with a trailing slash trimmed', () => {
    expect(resolveOutpostOrigin(fakeAuth({ base_url: 'https://abc.outpost.com/' }))).toBe(
      'https://abc.outpost.com'
    );
  });

  it('rejects a missing, malformed, or non-http(s) base_url', () => {
    expect(resolveOutpostOrigin(fakeAuth())).toBeUndefined();
    expect(resolveOutpostOrigin(fakeAuth({ base_url: 'not-a-url' }))).toBeUndefined();
    expect(
      resolveOutpostOrigin(fakeAuth({ base_url: 'ftp://abc.outpost.com' }))
    ).toBeUndefined();
  });

  it('returns undefined when there is no outpost auth at all', () => {
    expect(resolveOutpostOrigin(undefined)).toBeUndefined();
  });
});

describe('assertOutpostConnectionAccess', () => {
  beforeEach(() => {
    isServiceGrantedForInstance.mockReset();
  });

  it('no-ops for a direct (non-outpost) request', async () => {
    let captured: unknown;

    let app = new Hono().get('/x', async c => {
      captured = await assertOutpostConnectionAccess(c, {
        projectOid: 42n,
        instanceOid: 84n
      })
        .then(() => 'ok')
        .catch(e => e);
      return c.text('done');
    });

    await app.request('http://test/x');

    expect(captured).toBe('ok');
    expect(isServiceGrantedForInstance).not.toHaveBeenCalled();
  });

  it('passes when the outpost is granted access to the instance', async () => {
    isServiceGrantedForInstance.mockResolvedValue(true);
    let captured: unknown;

    let app = new Hono().get('/x', async c => {
      setOutpostAuth(c, fakeAuth());
      captured = await assertOutpostConnectionAccess(c, {
        projectOid: 42n,
        instanceOid: 84n
      })
        .then(() => 'ok')
        .catch(e => e);
      return c.text('done');
    });

    await app.request('http://test/x');

    expect(captured).toBe('ok');
    expect(isServiceGrantedForInstance).toHaveBeenCalledWith({
      outpostId: 'otp_1',
      projectOid: 42n,
      instanceOid: 84n,
      service: 'mcp_connection_proxy'
    });
  });

  it('throws a forbidden ServiceError when the outpost is not granted access to the instance', async () => {
    isServiceGrantedForInstance.mockResolvedValue(false);
    let captured: unknown;

    let app = new Hono().get('/x', async c => {
      setOutpostAuth(c, fakeAuth());
      captured = await assertOutpostConnectionAccess(c, {
        projectOid: 42n,
        instanceOid: 84n
      }).catch(e => e);
      return c.text('done');
    });

    await app.request('http://test/x');

    expect(captured).toBeInstanceOf(ServiceError);
    expect((captured as ServiceError).data.status).toBe(403);
  });
});
