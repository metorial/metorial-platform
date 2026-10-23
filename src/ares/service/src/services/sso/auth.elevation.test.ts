import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: { ssoAuth: { findUnique: vi.fn(), delete: vi.fn() } }
}));

vi.mock('../../db', () => ({ db }));
vi.mock('../../id', () => ({ getId: () => ({}), ID: { generateId: vi.fn() } }));
vi.mock('./domainPolicy', () => ({
  ssoDomainPolicyService: { assertEmailAllowed: vi.fn() }
}));

import { ssoAuthService } from './auth';

let tenant = { oid: 1n, id: 'tenant_1', status: 'completed', enrollment: 'app' };
let connection = { tenantOid: 1n, status: 'active' };
let completed = (purpose: string) => ({
  oid: 9n,
  purpose,
  status: 'completed',
  expiresAt: new Date(Date.now() + 60000),
  email: null,
  tenant,
  account: null,
  connection,
  user: { oid: 2n },
  userProfile: { email: 'jane@acme.com' }
});

beforeEach(() => vi.clearAllMocks());

describe('ssoAuthService.completeAuth purpose', () => {
  it.each([
    ['authentication', 'elevation'],
    ['elevation', 'authentication'],
    ['connection_test', 'authentication']
  ] as const)('does not let a %s auth be completed as %s', async (purpose, expected) => {
    db.ssoAuth.findUnique.mockResolvedValue(completed(purpose));
    await expect(
      ssoAuthService.completeAuth({ authId: 'a', tenantId: 'tenant_1', purpose: expected })
    ).rejects.toThrow();
    expect(db.ssoAuth.delete).not.toHaveBeenCalled();
  });

  it('completes and consumes an auth with the matching purpose', async () => {
    db.ssoAuth.findUnique.mockResolvedValue(completed('elevation'));
    await ssoAuthService.completeAuth({
      authId: 'a',
      tenantId: 'tenant_1',
      purpose: 'elevation'
    });
    expect(db.ssoAuth.delete).toHaveBeenCalledTimes(1);
  });
});
