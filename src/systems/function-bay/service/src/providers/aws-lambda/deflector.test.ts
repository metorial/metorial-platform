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

import { createDeflectorToken, getDeflectorProxyUrl } from './deflector';

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
        allowedHosts: ['api.example.com'],
        allowedIps: ['203.0.113.10']
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
      allowedHosts: ['api.example.com'],
      allowedIps: ['203.0.113.10']
    });
  });

  it('returns the configured proxy url', () => {
    expect(getDeflectorProxyUrl()).toBe('http://deflector.local:8080');
  });
});
