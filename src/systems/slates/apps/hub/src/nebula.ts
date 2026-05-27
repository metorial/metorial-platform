import { createNebulaClient } from '@metorial-platform-systems/nebula-client';
import os from 'os';
import type { Tenant } from '../prisma/generated/client';
import { db } from './db';
import { env } from './env';

export let nebula = createNebulaClient({
  endpoint: env.nebula.NEBULA_API_URL,
  consumerToken: env.nebula.NEBULA_CONSUMER_TOKEN,
  identifier: os.hostname()
});

export let getNebulaTenantForSlatesTenant = async (tenant: Tenant) => {
  if (!tenant.nebulaTenantId) {
    let newTenant = await nebula.tenant.upsert({
      name: tenant.name,
      identifier: tenant.identifier
    });

    tenant = await db.tenant.update({
      where: { id: tenant.id },
      data: { nebulaTenantId: newTenant.id }
    });
  }

  return {
    id: tenant.nebulaTenantId!,
    identifier: tenant.identifier
  };
};
