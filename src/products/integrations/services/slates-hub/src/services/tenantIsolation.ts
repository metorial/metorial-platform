import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { functionBay } from '../functionBay';

class tenantIsolationServiceImpl {
  private async getTenant(tenantId: string) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: tenantId }, { identifier: tenantId }] }
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant', tenantId));
    return tenant;
  }

  async get(d: { tenantId: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
      select: { id: true, identifier: true, tenantIsolationEnabled: true }
    });

    return {
      enabled: tenant?.tenantIsolationEnabled ?? false,
      tenantId: tenant?.id ?? null,
      identifier: tenant?.identifier ?? null
    };
  }

  async update(d: { tenantId: string; enabled: boolean }) {
    let tenant = await this.getTenant(d.tenantId);
    let previous = tenant.tenantIsolationEnabled;

    await db.tenant.update({
      where: { oid: tenant.oid },
      data: { tenantIsolationEnabled: d.enabled }
    });

    try {
      let functionBayTenant = await functionBay.tenant.upsert({
        identifier: tenant.functionBayTenantIdentifier ?? tenant.identifier,
        name: tenant.name,
        hasAutomaticEnclaveOverride: d.enabled
      });

      if (!tenant.functionBayTenantId) {
        await db.tenant.update({
          where: { oid: tenant.oid },
          data: {
            functionBayTenantId: functionBayTenant.id,
            functionBayTenantIdentifier: functionBayTenant.identifier
          }
        });
      }
    } catch (err) {
      await db.tenant.update({
        where: { oid: tenant.oid },
        data: { tenantIsolationEnabled: previous }
      });
      throw err;
    }

    return {
      enabled: d.enabled,
      tenantId: tenant.id,
      identifier: tenant.identifier
    };
  }
}

export let tenantIsolationService = Service.create(
  'tenantIsolationService',
  () => new tenantIsolationServiceImpl()
).build();
