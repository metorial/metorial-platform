import { Service } from '@lowerdeck/service';
import { db } from '../../db';
import {
  evaluateSsoEmailDomain,
  type SsoEmailDomainDenialReason
} from '../../lib/accountPolicy';
import { parseEmail } from '../../lib/parseEmail';
import { auditLogService } from '../auditLog';

/**
 * Structural shapes so callers can pass a full Prisma row or just the fields
 * they already hold, without an extra lookup.
 */
type PolicyTenant = {
  oid: bigint;
  id: string;
  name: string;
  appOid: bigint;
  accountOid: bigint | null;
};

type PolicyConnection = { oid: bigint; id: string };

type PolicyAccount = { oid: bigint; id: string };

export class SsoDomainNotAllowedError extends Error {
  readonly reason: SsoEmailDomainDenialReason;
  readonly email: string;
  readonly domain: string | null;
  readonly tenantName: string;

  constructor(d: {
    reason: SsoEmailDomainDenialReason;
    email: string;
    domain: string | null;
    tenantName: string;
  }) {
    super(`SSO email domain is not allowed (${d.reason})`);
    this.name = 'SsoDomainNotAllowedError';
    this.reason = d.reason;
    this.email = d.email;
    this.domain = d.domain;
    this.tenantName = d.tenantName;
  }
}

type DenyInput = {
  tenant: PolicyTenant;
  connection: PolicyConnection;
  account?: PolicyAccount | null;
  email: string;
  domain: string | null;
  reason: SsoEmailDomainDenialReason;
  context?: { ip?: string | null; ua?: string | null };
};

class SsoDomainPolicyServiceImpl {
  async assertEmailAllowed(d: {
    tenant: PolicyTenant;
    connection: PolicyConnection;
    account?: PolicyAccount | null;
    email: string;
    context?: { ip?: string | null; ua?: string | null };
  }) {
    let parsed: { domain: string } | null = null;
    try {
      parsed = parseEmail(d.email);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      this.deny({ ...d, reason: 'invalid_domain', domain: null });
    }

    let domain = parsed.domain;
    let accountOid = d.account?.oid ?? d.tenant.accountOid ?? null;

    let accountDomain = await db.accountDomain.findUnique({
      where: {
        appOid_domain: {
          appOid: d.tenant.appOid,
          domain
        }
      },
      include: {
        allowedTenants: true,
        allowedConnections: true
      }
    });

    let decision = evaluateSsoEmailDomain({
      domain,
      tenantOid: d.tenant.oid,
      connectionOid: d.connection.oid,
      accountOid,
      accountDomain: accountDomain
        ? {
            accountOid: accountDomain.accountOid,
            allowedTenantOids: accountDomain.allowedTenants.map(link => link.tenantOid),
            allowedConnectionOids: accountDomain.allowedConnections.map(
              link => link.connectionOid
            )
          }
        : null
    });

    if (!decision.allowed) {
      this.deny({ ...d, reason: decision.reason, domain });
    }
  }

  private deny(d: DenyInput): never {
    auditLogService.log({
      appOid: d.tenant.appOid,
      type: 'login.sso.blocked_domain',
      ip: d.context?.ip,
      ua: d.context?.ua,
      metadata: {
        reason: d.reason,
        domain: d.domain,
        accountId: d.account?.id ?? null,
        ssoTenantId: d.tenant.id,
        ssoConnectionId: d.connection.id
      }
    });

    throw new SsoDomainNotAllowedError({
      reason: d.reason,
      email: d.email,
      domain: d.domain,
      tenantName: d.tenant.name
    });
  }
}

export let ssoDomainPolicyService = Service.create(
  'SsoDomainPolicyService',
  () => new SsoDomainPolicyServiceImpl()
).build();
