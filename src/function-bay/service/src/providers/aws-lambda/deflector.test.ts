import { jwtVerify } from 'jose';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../env', () => ({
  env: {
    provider: {
      DEFAULT_PROVIDER: 'aws.lambda'
    },
    deflector: {
      DEFLECTOR_PROXY_URL: 'http://deflector.local:8080',
      DEFLECTOR_JWT_SECRET: 'test-secret',
      DEFLECTOR_JWT_AUDIENCE: 'deflector'
    }
  }
}));

import {
  createDeflectorToken,
  createLegacyDeflectorToken,
  getDeflectorProxyUrl
} from './deflector';

describe('deflector token', () => {
  it('signs invocation claims with the shared secret', async () => {
    let token = await createDeflectorToken({
      tenantId: 'tenant_123',
      functionId: 'function_123',
      effectiveFunctionId: 'function_override_123',
      functionVersionId: 'functionVersion_123',
      enclave: {
        id: 'enclave_123',
        identifier: 'preview'
      },
      egressPolicy: {
        direction: 'egress',
        entries: [
          {
            cidr: '203.0.113.10/32',
            portRange: { from: 443, to: 443 }
          }
        ]
      }
    });

    expect(token).toBeTypeOf('string');

    let verified = await jwtVerify(token!, new TextEncoder().encode('test-secret'), {
      audience: 'deflector',
      algorithms: ['HS256']
    });

    expect(verified.payload).toMatchObject({
      aud: 'deflector',
      sub: 'functionVersion_123',
      tenantId: 'tenant_123',
      functionId: 'function_123',
      effectiveFunctionId: 'function_override_123',
      functionVersionId: 'functionVersion_123',
      enclaveId: 'enclave_123',
      enclaveIdentifier: 'preview',
      egressPolicy: {
        direction: 'egress',
        entries: [
          {
            cidr: '203.0.113.10/32',
            portRange: { from: 443, to: 443 }
          }
        ]
      }
    });
    expect(verified.payload.jti).toEqual(expect.any(String));

    let nextToken = await createDeflectorToken({
      tenantId: 'tenant_123',
      functionId: 'function_123',
      functionVersionId: 'functionVersion_123'
    });
    let nextVerified = await jwtVerify(nextToken!, new TextEncoder().encode('test-secret'), {
      audience: 'deflector',
      algorithms: ['HS256']
    });
    expect(nextVerified.payload.jti).toEqual(expect.any(String));
    expect(nextVerified.payload.jti).not.toBe(verified.payload.jti);
  });

  it('returns the configured proxy url', () => {
    expect(getDeflectorProxyUrl()).toBe('http://deflector.local:8080');
  });

  it('signs legacy fallback claims for long-lived compatibility tokens', async () => {
    let before = Math.floor(Date.now() / 1000);
    let token = await createLegacyDeflectorToken();
    let verified = await jwtVerify(token!, new TextEncoder().encode('test-secret'), {
      audience: 'deflector',
      algorithms: ['HS256']
    });

    expect(verified.payload).toMatchObject({
      aud: 'deflector',
      legacyFallback: true
    });
    expect(verified.payload.tenantId).toBeUndefined();
    expect(verified.payload.functionId).toBeUndefined();
    expect(verified.payload.functionVersionId).toBeUndefined();
    expect(verified.payload.jti).toBeUndefined();
    expect(verified.payload.exp).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 - 1);
    expect(verified.payload.exp).toBeLessThanOrEqual(before + 7 * 24 * 60 * 60 + 5);
  });
});
