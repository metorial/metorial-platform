import { createPublicKey, verify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '../http/ssrf.test-helpers';

let signingSeed = Buffer.alloc(32, 7).toString('base64url');

let gatewayEnv: Record<string, string> = {
  METORIAL_EDITION: 'on-prem',
  SHUTTLE_EGRESS_GATEWAY_PROXY_URL: 'http://egress-gateway:8080',
  SHUTTLE_EGRESS_SIGNING_KEY: signingSeed,
  SHUTTLE_EGRESS_SIGNING_KEY_ID: 'mcp-test'
};

let egressEnvKeys = [
  ...Object.keys(gatewayEnv),
  'SHUTTLE_EGRESS_MODE',
  'SHUTTLE_EGRESS_REQUEST_GRANT_TTL_SECONDS',
  'SHUTTLE_EGRESS_STREAM_GRANT_TTL_SECONDS'
];

let egress = {
  tenantId: 'tenant_1',
  enclaveId: 'enc_1',
  egressPolicy: {
    direction: 'egress' as const,
    entries: [{ cidr: '10.20.0.0/16', portRange: { from: 443, to: 443 } }]
  }
};

let saved: Record<string, string | undefined> = {};

let useEnv = (values: Record<string, string>) => {
  for (let [key, value] of Object.entries(values)) process.env[key] = value;
};

let decodeGrant = (token: string) => {
  let [header, payload, signature] = token.split('.');

  return {
    header: JSON.parse(Buffer.from(header!, 'base64url').toString()),
    claims: JSON.parse(Buffer.from(payload!, 'base64url').toString()),
    signed: `${header}.${payload}`,
    signature: Buffer.from(signature!, 'base64url')
  };
};

let grantFromProxy = (proxy: { headers: Record<string, string> }) =>
  proxy.headers['Proxy-Authorization']!.replace(/^Bearer /, '');

beforeEach(() => {
  for (let key of egressEnvKeys) saved[key] = process.env[key];
  for (let key of egressEnvKeys) delete process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (let key of egressEnvKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('egress mode', () => {
  it('connects directly in the cloud edition even when gateway mode is requested', async () => {
    useEnv({ ...gatewayEnv, METORIAL_EDITION: 'cloud', SHUTTLE_EGRESS_MODE: 'gateway' });

    let { isGatewayEgress } = await import('./mode');

    expect(isGatewayEgress()).toBe(false);
  });

  it('uses the gateway by default on-prem', async () => {
    useEnv(gatewayEnv);

    let { isGatewayEgress } = await import('./mode');

    expect(isGatewayEgress()).toBe(true);
  });

  it('lets on-prem opt back into direct connections', async () => {
    useEnv({ ...gatewayEnv, SHUTTLE_EGRESS_MODE: 'direct' });

    let { isGatewayEgress } = await import('./mode');

    expect(isGatewayEgress()).toBe(false);
  });

  it('fails the configuration check when the gateway is not configured', async () => {
    useEnv({ METORIAL_EDITION: 'on-prem' });

    let { assertEgressConfigured } = await import('./gateway');

    expect(() => assertEgressConfigured()).toThrow('SHUTTLE_EGRESS_GATEWAY_PROXY_URL');
  });
});

describe('mintEgressGrant', () => {
  beforeEach(() => useEnv(gatewayEnv));

  it('signs an mcp grant scoped to the tenant, enclave and policy', async () => {
    let { mintEgressGrant, getEgressSigningKey } = await import('./grant');

    let token = mintEgressGrant(egress, {
      lifetime: 'request',
      now: new Date('2026-01-01T00:00:00Z')
    });
    let grant = decodeGrant(token);
    let publicKey = createPublicKey({
      key: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: getEgressSigningKey().publicKey.toString('base64url')
      },
      format: 'jwk'
    });

    expect(grant.header).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: 'mcp-test' });
    expect(verify(null, Buffer.from(grant.signed), publicKey, grant.signature)).toBe(true);
    expect(grant.claims).toEqual({
      iss: 'mcp-runtime',
      aud: 'metorial-egress',
      jti: expect.stringMatching(/^ceg_/),
      tenantId: 'tenant_1',
      enclaveId: 'enc_1',
      enclaveIdentifier: 'enc_1',
      source: 'mcp',
      policy: { entries: [{ cidr: '10.20.0.0/16', portRange: { from: 443, to: 443 } }] },
      iat: 1767225600,
      exp: 1767225600 + 300
    });
  });

  it('leaves the policy out without an instance configuration so only public hosts are allowed', async () => {
    let { mintEgressGrant } = await import('./grant');

    let { claims } = decodeGrant(
      mintEgressGrant({ tenantId: 'tenant_1' }, { lifetime: 'request' })
    );

    expect(claims).not.toHaveProperty('policy');
    expect(claims).not.toHaveProperty('allowAll');
    expect(claims).not.toHaveProperty('enclaveId');
  });

  it('gives streams the longer lifetime', async () => {
    useEnv({ SHUTTLE_EGRESS_STREAM_GRANT_TTL_SECONDS: '7200' });

    let { mintEgressGrant } = await import('./grant');

    let { claims } = decodeGrant(mintEgressGrant(egress, { lifetime: 'stream' }));

    expect(claims.exp - claims.iat).toBe(7200);
  });
});

describe('safeFetch through the gateway', () => {
  beforeEach(() => useEnv(gatewayEnv));
  let f = mockFetch();

  it('sends the request to the gateway with a grant instead of resolving it locally', async () => {
    let lookup = vi.fn();
    let g = globalThis as any;
    let originalBun = g.Bun;
    g.Bun = { ...originalBun, dns: { lookup } };

    let { safeFetch } = await import('../http/fetchSsrf');

    try {
      await safeFetch('https://mcp.internal.example/mcp', { method: 'POST', egress });
    } finally {
      g.Bun = originalBun;
    }

    let [url, init] = f.mock.mock.calls[0]!;
    let { claims } = decodeGrant(grantFromProxy(init.proxy));

    expect(url).toBe('https://mcp.internal.example/mcp');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      keepalive: false,
      proxy: { url: 'http://egress-gateway:8080' }
    });
    expect(init).not.toHaveProperty('egress');
    expect(claims.tenantId).toBe('tenant_1');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('uses the stream lifetime when asked to', async () => {
    let { safeFetch } = await import('../http/fetchSsrf');

    await safeFetch('https://mcp.example/sse', { egress, egressLifetime: 'stream' });

    let { claims } = decodeGrant(grantFromProxy(f.mock.mock.calls[0]![1].proxy));

    expect(claims.exp - claims.iat).toBe(21600);
  });

  it('reports a gateway denial as an egress policy error', async () => {
    f.mock.mockResolvedValueOnce(
      new Response('Metorial Magic Network: policy denied outgoing request\n', {
        status: 403,
        headers: { 'x-metorial-egress-error': 'denied' }
      })
    );

    let { safeFetch } = await import('../http/fetchSsrf');

    await expect(safeFetch('http://10.1.2.3/mcp', { egress })).rejects.toMatchObject({
      data: { code: 'egress_policy_blocked' }
    });
  });

  it('passes an upstream 403 through untouched', async () => {
    f.mock.mockResolvedValueOnce(new Response('nope', { status: 403 }));

    let { safeFetch } = await import('../http/fetchSsrf');

    let response = await safeFetch('https://mcp.example/mcp', { egress });

    expect(response.status).toBe(403);
  });

  it('maps a refused CONNECT tunnel to an egress policy error', async () => {
    f.mock.mockRejectedValueOnce(
      Object.assign(new Error('Proxy refused to open a tunnel: 403 Forbidden'), {
        code: 'ERR_PROXY_TUNNEL'
      })
    );

    let { safeFetch } = await import('../http/fetchSsrf');

    await expect(safeFetch('https://blocked.example/mcp', { egress })).rejects.toMatchObject({
      data: { code: 'egress_policy_blocked' }
    });
  });

  it('maps a rejected grant to a gateway credentials error', async () => {
    f.mock.mockRejectedValueOnce(
      Object.assign(
        new Error('Proxy refused to open a tunnel: 407 Proxy Authentication Required'),
        {
          code: 'ERR_PROXY_TUNNEL'
        }
      )
    );

    let { safeFetch } = await import('../http/fetchSsrf');

    await expect(safeFetch('https://mcp.example/mcp', { egress })).rejects.toMatchObject({
      data: { code: 'egress_gateway_unauthorized' }
    });
  });
});

describe('getAxiosEgressOptions', () => {
  it('tunnels through the gateway with proxy agents in gateway mode', async () => {
    useEnv(gatewayEnv);

    let { getAxiosEgressOptions } = await import('./axios');
    let { HttpsProxyAgent } = await import('https-proxy-agent');
    let { HttpProxyAgent } = await import('http-proxy-agent');

    let options = getAxiosEgressOptions('https://auth.example/token', egress) as any;

    expect(options.proxy).toBe(false);
    expect(options.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
    expect(options.httpAgent).toBeInstanceOf(HttpProxyAgent);
    expect(options.httpsAgent.proxy.href).toBe('http://egress-gateway:8080/');
  });

  it('keeps the local SSRF filter when connecting directly', async () => {
    useEnv({ METORIAL_EDITION: 'cloud' });

    let { getAxiosEgressOptions } = await import('./axios');

    let options = getAxiosEgressOptions('https://auth.example/token', egress);

    expect(options).not.toHaveProperty('proxy');
    expect(options).toHaveProperty('httpsAgent');
  });
});

describe('isEgressPolicyError', () => {
  it('recognises a gateway denial surfaced by axios', async () => {
    let { isEgressPolicyError } = await import('../network/egressPolicy');

    expect(
      isEgressPolicyError({
        response: { status: 403, headers: { 'x-metorial-egress-error': 'denied' } }
      })
    ).toBe(true);
    expect(isEgressPolicyError({ response: { status: 403, headers: {} } })).toBe(false);
  });
});
