import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, auditLogService } = vi.hoisted(() => ({
  db: {
    accountDomain: { findUnique: vi.fn() }
  },
  auditLogService: { log: vi.fn() }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../../db', () => ({ db }));

vi.mock('../auditLog', () => ({ auditLogService }));

import { SsoDomainNotAllowedError, ssoDomainPolicyService } from './domainPolicy';

let accountTenant = {
  oid: 1n,
  id: 'stn_1',
  name: 'Acme',
  appOid: 5n,
  accountOid: 10n
};

let appTenant = { ...accountTenant, accountOid: null };

let connection = { oid: 2n, id: 'scn_1' };

let configuredDomain = {
  accountOid: 10n,
  allowedTenants: [] as { tenantOid: bigint }[],
  allowedConnections: [] as { connectionOid: bigint }[]
};

describe('SSO domain policy service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.accountDomain.findUnique.mockResolvedValue(null);
  });

  it('looks the domain up scoped to the tenant app', async () => {
    db.accountDomain.findUnique.mockResolvedValue(configuredDomain);

    await ssoDomainPolicyService.assertEmailAllowed({
      tenant: accountTenant,
      connection,
      email: 'User@Example.com'
    });

    expect(db.accountDomain.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appOid_domain: { appOid: 5n, domain: 'example.com' } }
      })
    );
  });

  it('allows standalone app tenants with no configured domains', async () => {
    await expect(
      ssoDomainPolicyService.assertEmailAllowed({
        tenant: appTenant,
        connection,
        email: 'user@example.com'
      })
    ).resolves.toBeUndefined();

    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('blocks an account tenant asserting an unconfigured domain', async () => {
    let error = await ssoDomainPolicyService
      .assertEmailAllowed({
        tenant: accountTenant,
        connection,
        email: 'user@unconfigured.com'
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SsoDomainNotAllowedError);
    expect(error).toMatchObject({
      reason: 'domain_not_configured',
      domain: 'unconfigured.com',
      email: 'user@unconfigured.com',
      tenantName: 'Acme'
    });
  });

  it('derives the account from the tenant when none is passed', async () => {
    db.accountDomain.findUnique.mockResolvedValue({ ...configuredDomain, accountOid: 11n });

    await expect(
      ssoDomainPolicyService.assertEmailAllowed({
        tenant: accountTenant,
        connection,
        email: 'user@example.com'
      })
    ).rejects.toMatchObject({ reason: 'domain_other_account' });
  });

  it('blocks a connection the domain does not permit', async () => {
    db.accountDomain.findUnique.mockResolvedValue({
      ...configuredDomain,
      allowedConnections: [{ connectionOid: 99n }]
    });

    await expect(
      ssoDomainPolicyService.assertEmailAllowed({
        tenant: accountTenant,
        connection,
        email: 'user@example.com'
      })
    ).rejects.toMatchObject({ reason: 'connection_not_allowed' });
  });

  it('rejects a multi-@ address without consulting the database', async () => {
    await expect(
      ssoDomainPolicyService.assertEmailAllowed({
        tenant: accountTenant,
        connection,
        email: 'user@example.com@evil.com'
      })
    ).rejects.toMatchObject({ reason: 'invalid_domain', domain: null });

    expect(db.accountDomain.findUnique).not.toHaveBeenCalled();
  });

  it('records an audit entry describing why the login was blocked', async () => {
    await ssoDomainPolicyService
      .assertEmailAllowed({
        tenant: accountTenant,
        connection,
        account: { oid: 10n, id: 'acc_1' },
        email: 'user@unconfigured.com',
        context: { ip: '1.2.3.4', ua: 'agent' }
      })
      .catch(() => {});

    expect(auditLogService.log).toHaveBeenCalledWith({
      appOid: 5n,
      type: 'login.sso.blocked_domain',
      ip: '1.2.3.4',
      ua: 'agent',
      metadata: {
        reason: 'domain_not_configured',
        domain: 'unconfigured.com',
        accountId: 'acc_1',
        ssoTenantId: 'stn_1',
        ssoConnectionId: 'scn_1'
      }
    });
  });
});
