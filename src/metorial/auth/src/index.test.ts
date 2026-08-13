import { beforeEach, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  extractToken: vi.fn(),
  updateExecutionContext: vi.fn()
}));

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  unauthorizedError: vi.fn(input => input)
}));
vi.mock('@lowerdeck/execution-context', () => ({
  updateExecutionContext: mocks.updateExecutionContext
}));
vi.mock('@lowerdeck/forwarded-for', () => ({
  parseForwardedFor: vi.fn(() => '127.0.0.1')
}));
vi.mock('@metorial/bearer', () => ({
  extractToken: mocks.extractToken
}));
vi.mock('@metorial/config', () => ({
  getConfig: vi.fn(() => ({ env: 'test' }))
}));
vi.mock('@metorial/module-access', () => ({
  authenticationService: {
    authenticate: mocks.authenticate
  }
}));

import { authenticate } from './index';

beforeEach(() => {
  vi.clearAllMocks();
});

it('preserves an audit scope returned by bearer authentication', async () => {
  let auditScope = {
    organizationOid: 1n,
    instanceOid: 3n,
    organizationActorOid: 4n,
    actor: {
      type: 'org_actor',
      id: 'oac_1'
    },
    context: { ip: '127.0.0.1', ua: 'test-agent' }
  };
  let auth = {
    type: 'machine',
    apiKey: { id: 'key_1' },
    machineAccess: { id: 'mac_1' },
    orgScopes: [],
    restrictions: {
      type: 'instance',
      consumer: undefined
    },
    auditScope
  };

  mocks.extractToken.mockReturnValue('metorial_sk_test');
  mocks.authenticate.mockResolvedValue(auth);

  let result = await authenticate(
    new Request('https://api.metorial.com/test', {
      headers: { 'user-agent': 'test-agent' }
    }),
    new URL('https://api.metorial.com/test')
  );

  expect(result.auth).toBe(auth);
  expect(result.auth.auditScope).toBe(auditScope);
});
