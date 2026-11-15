import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { KeyProvider, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';
import { keyProviderService } from './keyProvider';

let include = {
  defaultKeyProvider: true
};

type TenantWithDefaultKeyProvider = Tenant & {
  defaultKeyProvider: KeyProvider | null;
};

class TenantServiceImpl {
  async upsertTenant(d: {
    input: {
      name: string;
      identifier: string;
      keyReuseTimeSeconds?: number | null;
    };
  }) {
    let tenant = await db.tenant.upsert({
      where: { identifier: d.input.identifier },
      update: {
        name: d.input.name,
        keyReuseTimeSeconds: d.input.keyReuseTimeSeconds ?? undefined
      },
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('tenant'),
        name: d.input.name,
        identifier: d.input.identifier,
        keyReuseTimeSeconds: d.input.keyReuseTimeSeconds ?? undefined
      },
      include
    });

    return await this.withEffectiveDefaultKeyProvider(tenant);
  }

  async getTenantById(d: { id: string }) {
    let tenant = await db.tenant.findFirst({
      where: { OR: [{ id: d.id }, { identifier: d.id }] },
      include
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant'));
    return await this.withEffectiveDefaultKeyProvider(tenant);
  }

  private async withEffectiveDefaultKeyProvider(tenant: TenantWithDefaultKeyProvider) {
    if (tenant.defaultKeyProvider) return tenant;

    let defaultKeyProvider = await keyProviderService.resolveForTenant({ tenant });
    return {
      ...tenant,
      defaultKeyProvider
    };
  }
}

export let tenantService = Service.create(
  'tenantService',
  () => new TenantServiceImpl()
).build();
