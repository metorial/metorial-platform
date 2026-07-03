import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { App, SsoTenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId, ID } from '../../id';

let tenantInclude = {
  _count: { select: { connections: true } },
  ssoTenantDomain: true
};

class SsoTenantServiceImpl {
  async createTenant(d: {
    app: App;
    input: {
      name: string;
      metadata?: Record<string, any>;
      externalId?: string;
      hideInUI?: boolean;
    };
  }) {
    return await db.ssoTenant.create({
      data: {
        ...getId('ssoTenant'),
        clientId: await ID.generateId('ssoTenant_clientId'),
        appOid: d.app.oid,
        name: d.input.name,
        metadata: d.input.metadata,
        externalId: d.input.externalId,
        hideInUI: !!d.input.hideInUI
      },
      include: tenantInclude
    });
  }

  async updateTenant(d: {
    tenant: SsoTenant;
    input: {
      name?: string;
      metadata?: Record<string, any>;
      externalId?: string;
      hideInUI?: boolean;
    };
  }) {
    return await db.ssoTenant.update({
      where: { oid: d.tenant.oid },
      data: {
        name: d.input.name,
        metadata: d.input.metadata,
        externalId: d.input.externalId,
        hideInUI: d.input.hideInUI
      },
      include: tenantInclude
    });
  }

  async getTenantById(d: { tenantId: string }) {
    let tenant = await db.ssoTenant.findUnique({
      where: { id: d.tenantId },
      include: tenantInclude
    });
    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));
    return tenant;
  }

  async getTenantByClientId(d: { clientId: string }) {
    let tenant = await db.ssoTenant.findUnique({ where: { clientId: d.clientId } });
    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));
    return tenant;
  }

  async listTenants(d: { app: App }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoTenant.findMany({
            ...opts,
            where: { appOid: d.app.oid },
            include: tenantInclude
          })
      )
    );
  }

  async listGlobalTenants() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoTenant.findMany({
            ...opts,
            where: { isGlobal: true },
            include: {
              ...tenantInclude,
              app: { select: { id: true, clientId: true } }
            }
          })
      )
    );
  }

  async setGlobal(d: { tenant: SsoTenant; isGlobal: boolean }) {
    return await db.ssoTenant.update({
      where: { oid: d.tenant.oid },
      data: { isGlobal: d.isGlobal },
      include: tenantInclude
    });
  }

  async addTenantDomain(d: {
    tenant: SsoTenant;
    input: {
      domain: string;
    };
  }) {
    let domain = d.input.domain.trim().toLowerCase();
    if (!domain) {
      throw new ServiceError(badRequestError({ message: 'Domain is required' }));
    }

    let existing = await db.ssoTenantDomain.findFirst({
      where: {
        appOid: d.tenant.appOid,
        domain
      }
    });
    if (existing) {
      if (existing.tenantOid === d.tenant.oid) return existing;
      throw new ServiceError(
        badRequestError({ message: 'Domain already exists for another SSO tenant' })
      );
    }

    return await db.ssoTenantDomain.create({
      data: {
        ...getId('ssoTenantDomain'),
        domain,
        tenantOid: d.tenant.oid,
        appOid: d.tenant.appOid
      }
    });
  }

  async removeTenantDomain(d: { tenant: SsoTenant; domain: string }) {
    let domain = d.domain.trim().toLowerCase();

    let tenantDomain = await db.ssoTenantDomain.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        appOid: d.tenant.appOid,
        domain
      }
    });
    if (!tenantDomain) throw new ServiceError(notFoundError('sso.tenant_domain'));

    await db.ssoTenantDomain.delete({ where: { oid: tenantDomain.oid } });

    return tenantDomain;
  }

  async getTenantByDomain(d: { app: App; domain: string }) {
    let tenantDomain = await db.ssoTenantDomain.findFirst({
      where: {
        appOid: d.app.oid,
        domain: d.domain.trim().toLowerCase(),
        tenant: {
          status: 'completed',
          connections: {
            some: {}
          }
        }
      },
      include: {
        tenant: true
      }
    });

    return tenantDomain?.tenant ?? null;
  }
}

export let ssoTenantService = Service.create(
  'SsoTenantService',
  () => new SsoTenantServiceImpl()
).build();
