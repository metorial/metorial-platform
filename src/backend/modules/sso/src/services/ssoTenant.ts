import { db, ID, Organization, SsoTenant, withTransaction } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { generatePlainId } from '@metorial/id';
import { Service } from '@metorial/service';
import { Paginator } from '../../../../../packages/server/pagination/src';
import { sso } from '../sso';

let include = {};

class ssoTenantServiceImpl {
  async createSsoTenant(d: {
    organization: Organization;
    input: {
      name: string;
    };
  }) {
    return withTransaction(async db => {
      let tenant = await db.ssoTenant.create({
        data: {
          id: await ID.generateId('ssoTenant'),
          name: d.input.name,
          ssoTenantId: generatePlainId(15),
          ssoTenantClientId: generatePlainId(15),
          organizationOid: d.organization.oid
        }
      });

      let ssoTenant = await sso.tenant.createTenant({
        name: d.input.name,
        externalId: tenant.ssoTenantId,
        metadata: {
          organizationId: d.organization.id
        }
      });

      return await db.ssoTenant.update({
        where: { id: tenant.id },
        data: {
          ssoTenantId: ssoTenant.id,
          ssoTenantClientId: ssoTenant.clientId
        },
        include
      });
    });
  }

  async listTenants(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoTenant.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid
            },
            include
          })
      )
    );
  }

  async createTenantSetup(d: {
    tenant: SsoTenant;
    input: {
      redirectUri: string;
    };
  }) {
    return await sso.tenant.createSetup({
      tenantId: d.tenant.ssoTenantId,
      redirectUri: d.input.redirectUri
    });
  }

  async listTenantConnections(d: { tenant: SsoTenant }) {
    return await sso.tenant.listConnections({
      tenantId: d.tenant.ssoTenantId
    });
  }

  async getTenantConnectionById(d: { tenant: SsoTenant; connectionId: string }) {
    return await sso.tenant.getConnection({
      tenantId: d.tenant.ssoTenantId,
      connectionId: d.connectionId
    });
  }

  async getTenantById(d: { tenantId: string; organization: Organization }) {
    let tenant = await db.ssoTenant.findUnique({
      where: { id: d.tenantId, organizationOid: d.organization.oid }
    });
    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));
    return tenant;
  }
}

export let ssoTenantService = Service.create(
  'ssoTenantService',
  () => new ssoTenantServiceImpl()
).build();
