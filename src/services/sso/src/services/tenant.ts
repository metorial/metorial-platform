import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Tenant } from '../db/schema';
import { ID } from '../id';

class tenantServiceImpl {
  async createTenant(d: {
    input: {
      name: string;
      metadata: Record<string, any>;
      externalId: string;
    };
  }) {
    return await Tenant.create({
      name: d.input.name,
      metadata: d.input.metadata,
      externalId: d.input.externalId,
      clientId: await ID.generateId('tenant_clientId')
    });
  }

  async updateTenant(d: {
    tenant: Tenant;
    input: {
      name?: string;
      metadata?: Record<string, any>;
      externalId?: string;
    };
  }) {
    return await Tenant.findByIdAndUpdate(
      d.tenant._id,
      {
        name: d.input.name ?? d.tenant.name,
        metadata: d.input.metadata ?? d.tenant.metadata,
        externalId: d.input.externalId ?? d.tenant.externalId,
        updatedAt: new Date()
      },
      { new: false }
    );
  }

  async getTenantById(d: { tenantId: string }) {
    let tenant = await Tenant.findById(d.tenantId);
    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));

    return tenant;
  }
}

export let tenantService = Service.create('tenant', () => new tenantServiceImpl()).build();
