import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { addMinutes } from 'date-fns';
import type { Account, SsoConnection, SsoTenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId, ID } from '../../id';
import { parseEmail } from '../../lib/parseEmail';
import { isAccountDomainConnectionAllowed } from '../../lib/accountPolicy';

class SsoAuthServiceImpl {
  private async ensureDomainAllowsConnection(d: {
    tenant: SsoTenant;
    account?: Account | null;
    connection?: SsoConnection | null;
    email?: string | null;
  }) {
    if (!d.account || !d.connection || !d.email) return;
    let { domain } = parseEmail(d.email);
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
    if (!accountDomain) return;
    if (accountDomain.accountOid != d.account.oid) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    if (
      !isAccountDomainConnectionAllowed({
        tenantOid: d.tenant.oid,
        connectionOid: d.connection.oid,
        allowedTenantOids: accountDomain.allowedTenants.map(link => link.tenantOid),
        allowedConnectionOids: accountDomain.allowedConnections.map(link => link.connectionOid)
      })
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
  }

  async createAuth(d: {
    tenant: SsoTenant;
    account?: Account | null;
    connection?: SsoConnection;
    input: {
      redirectUri: string;
      email?: string;
      state: string;
    };
  }) {
    if (d.tenant.status != 'completed') {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    if (
      d.tenant.enrollment == 'account' &&
      (!d.account || d.tenant.accountOid != d.account.oid)
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    if (d.account && (d.account.status != 'active' || d.account.appOid != d.tenant.appOid)) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    if (
      d.connection &&
      (d.connection.tenantOid != d.tenant.oid || d.connection.status != 'active')
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    await this.ensureDomainAllowsConnection({
      tenant: d.tenant,
      account: d.account,
      connection: d.connection,
      email: d.input.email
    });

    return await db.ssoAuth.create({
      data: {
        ...getId('ssoAuth'),
        clientSecret: await ID.generateId('ssoAuth_clientSecret'),
        tenantOid: d.tenant.oid,
        accountOid: d.account?.oid ?? null,
        connectionOid: d.connection?.oid ?? null,
        state: d.input.state,
        redirectUri: d.input.redirectUri,
        email: d.input.email ?? null,
        expiresAt: addMinutes(new Date(), 30)
      }
    });
  }

  async getAuthByClientSecret(d: { clientSecret: string }) {
    let auth = await db.ssoAuth.findUnique({
      where: { clientSecret: d.clientSecret },
      include: { tenant: true, account: true, connection: true }
    });
    if (!auth) throw new ServiceError(notFoundError('sso.auth'));
    if (auth.expiresAt && auth.expiresAt <= new Date()) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    if (
      auth.tenant.status != 'completed' ||
      (auth.account &&
        (auth.account.status != 'active' || auth.account.appOid != auth.tenant.appOid)) ||
      (auth.tenant.enrollment == 'account' &&
        (!auth.account || auth.tenant.accountOid != auth.account.oid)) ||
      (auth.connection &&
        (auth.connection.tenantOid != auth.tenant.oid || auth.connection.status != 'active'))
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    await this.ensureDomainAllowsConnection({
      tenant: auth.tenant,
      account: auth.account,
      connection: auth.connection,
      email: auth.email
    });
    return auth;
  }

  async completeAuth(d: { authId: string; tenantId: string }) {
    let auth = await db.ssoAuth.findUnique({
      where: { id: d.authId },
      include: {
        tenant: true,
        account: true,
        connection: true,
        userProfile: true,
        user: true
      }
    });

    if (
      !auth ||
      auth.tenant.id != d.tenantId ||
      auth.status != 'completed' ||
      (auth.expiresAt && auth.expiresAt <= new Date()) ||
      !auth.user ||
      !auth.connection ||
      !auth.userProfile
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }
    await this.ensureDomainAllowsConnection({
      tenant: auth.tenant,
      account: auth.account,
      connection: auth.connection,
      email: auth.email ?? auth.userProfile.email
    });
    if (
      auth.tenant.status != 'completed' ||
      (auth.account &&
        (auth.account.status != 'active' || auth.account.appOid != auth.tenant.appOid)) ||
      (auth.tenant.enrollment == 'account' &&
        (!auth.account || auth.tenant.accountOid != auth.account.oid)) ||
      auth.connection.tenantOid != auth.tenant.oid ||
      auth.connection.status != 'active'
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }

    await db.ssoAuth.delete({ where: { oid: auth.oid } });

    return {
      auth,
      user: auth.user,
      tenant: auth.tenant,
      account: auth.account,
      connection: auth.connection,
      userProfile: auth.userProfile
    };
  }
}

export let ssoAuthService = Service.create(
  'SsoAuthService',
  () => new SsoAuthServiceImpl()
).build();
