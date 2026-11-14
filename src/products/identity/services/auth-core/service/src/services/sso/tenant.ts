import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { App, SsoTenant } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId, ID } from '../../id';

let tenantInclude = {
  _count: { select: { connections: true } },
  app: { select: { id: true, clientId: true } },
  account: {
    select: {
      id: true,
      clientId: true,
      identifier: true,
      name: true
    }
  }
};

class SsoTenantServiceImpl {
  async createTenant(d: {
    app: App;
    input: {
      name: string;
      metadata?: Record<string, any>;
      externalId?: string;
      hideInUI?: boolean;
      enrollment: 'app' | 'disabled';
    };
  }) {
    return await db.ssoTenant.create({
      data: {
        ...getId('ssoTenant'),
        clientId: await ID.generateId('ssoTenant_clientId'),
        appOid: d.app.oid,
        enrollment: d.input.enrollment,
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
    if (d.tenant.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Imported SSO tenants are read-only' })
      );
    }
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
}

export let ssoTenantService = Service.create(
  'SsoTenantService',
  () => new SsoTenantServiceImpl()
).build();
