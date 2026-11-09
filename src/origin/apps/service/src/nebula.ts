import { createNebulaClient } from '@metorial-platform-systems/nebula-client';
import os from 'os';
import { db } from './db';
import { env } from './env';

let nebulaClient: ReturnType<typeof createNebulaClient> | null = null;

let nebulaTenants = new Map<bigint, { id: string; nebulaTenantId: string }>();

export let getNebulaClient = () => {
  nebulaClient ??= createNebulaClient({
    endpoint: env.nebula.NEBULA_API_URL,
    consumerToken: env.nebula.NEBULA_CONSUMER_TOKEN,
    identifier: os.hostname()
  });

  return nebulaClient;
};

export let getNebulaTenantForOriginTenant = async (tenantOid: bigint) => {
  let cached = nebulaTenants.get(tenantOid);
  if (cached) return cached;

  let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: tenantOid } });

  if (!tenant.nebulaTenantId) {
    let nebulaTenant = await getNebulaClient().tenant.upsert({
      name: tenant.name,
      identifier: tenant.identifier
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: { nebulaTenantId: nebulaTenant.id }
    });
  }

  let resolved = { id: tenant.id, nebulaTenantId: tenant.nebulaTenantId! };
  nebulaTenants.set(tenantOid, resolved);

  return resolved;
};
