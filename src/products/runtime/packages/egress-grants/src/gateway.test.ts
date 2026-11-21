import { createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createEgressGatewayClient,
  egressGatewayRefusalFromError,
  egressGatewayRefusalFromHeaders
} from './gateway';
import { loadRuntimeSigningKey } from './index';

let signingKey = loadRuntimeSigningKey({
  seed: Buffer.alloc(32, 3).toString('base64url'),
  kid: 'hub-test'
});

let client = createEgressGatewayClient({
  issuer: 'slates-hub',
  source: 'mcp',
  proxyUrl: 'http://egress-gateway:8080',
  signingKey,
  generateGrantId: () => 'sheg_1',
  ttlSeconds: { request: 300, stream: 7200 }
});

let subject = {
  tenantId: 'fbt_1',
  enclaveId: 'enc_1',
  policy: { entries: [{ cidr: '10.0.0.0/8', portRange: { from: 443, to: 443 } }] }
};

let decode = (token: string) => {
  let [header, claims, signature] = token.split('.');

  return {
    header: JSON.parse(Buffer.from(header!, 'base64url').toString()),
    claims: JSON.parse(Buffer.from(claims!, 'base64url').toString()),
    signed: Buffer.from(`${header}.${claims}`),
    signature: Buffer.from(signature!, 'base64url')
  };
};

describe('createEgressGatewayClient', () => {
  it('signs grants for its issuer and source', () => {
    let grant = decode(
      client.mintGrant(subject, { lifetime: 'request', now: new Date('2026-01-01T00:00:00Z') })
    );
    let publicKey = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: signingKey.publicKey.toString('base64url') },
      format: 'jwk'
    });

    expect(grant.header).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: 'hub-test' });
    expect(verify(null, grant.signed, publicKey, grant.signature)).toBe(true);
    expect(grant.claims).toEqual({
      iss: 'slates-hub',
      aud: 'metorial-egress',
      jti: 'sheg_1',
      tenantId: 'fbt_1',
      enclaveId: 'enc_1',
      enclaveIdentifier: 'enc_1',
      source: 'mcp',
      policy: subject.policy,
      iat: 1767225600,
      exp: 1767225600 + 300
    });
  });

  it('leaves out the policy and enclave when there are none', () => {
    let { claims } = decode(client.mintGrant({ tenantId: 'fbt_1' }, { lifetime: 'request' }));

    expect(claims).not.toHaveProperty('policy');
    expect(claims).not.toHaveProperty('enclaveId');
  });

  it('builds the proxy option with a stream grant', () => {
    let proxy = client.proxy(subject, 'stream');
    let { claims } = decode(proxy.headers['Proxy-Authorization'].replace(/^Bearer /, ''));

    expect(proxy.url).toBe('http://egress-gateway:8080');
    expect(claims.exp - claims.iat).toBe(7200);
  });
});

describe('gateway refusals', () => {
  it('reads the marker from fetch and plain headers', () => {
    expect(
      egressGatewayRefusalFromHeaders(new Headers({ 'x-metorial-egress-error': 'denied' }))
    ).toBe('denied');
    expect(
      egressGatewayRefusalFromHeaders({ 'x-metorial-egress-error': 'unauthorized' })
    ).toBe('unauthorized');
    expect(egressGatewayRefusalFromHeaders(new Headers({ 'x-other': 'denied' }))).toBeNull();
  });

  it('maps refused tunnels by status code', () => {
    let tunnelError = (message: string) =>
      Object.assign(new Error(message), { code: 'ERR_PROXY_TUNNEL' });

    expect(egressGatewayRefusalFromError(tunnelError('Proxy refused: 403 Forbidden'))).toBe(
      'denied'
    );
    expect(
      egressGatewayRefusalFromError(tunnelError('Proxy refused: 407 Proxy Authentication'))
    ).toBe('unauthorized');
    expect(egressGatewayRefusalFromError(tunnelError('Proxy refused: 502'))).toBeNull();
    expect(egressGatewayRefusalFromError(new Error('403'))).toBeNull();
  });

  it('reads refusals from WebSocket proxy failures', () => {
    let message = "WebSocket connection to 'wss://a.test/' failed: Proxy connection failed: ";

    expect(egressGatewayRefusalFromError({ message: `${message}403 Forbidden` })).toBe(
      'denied'
    );
    expect(egressGatewayRefusalFromError({ message: `${message}407 Proxy Auth` })).toBe(
      'unauthorized'
    );
    expect(egressGatewayRefusalFromError({ message: `${message}502 Bad Gateway` })).toBeNull();
  });
});
