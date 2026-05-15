import { createOriginClient } from '@metorial-platform-systems/origin-client';
import type { SkillDestination, Tenant } from '@metorial-cargo/db';
import { db, env, getId } from '@metorial-cargo/db';

export let origin = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});

export let createSkillDestination = async (d: {
  tenant: Tenant;
  purpose?: string;
}): Promise<SkillDestination> => {
  let originTenant = await origin.tenant.upsert({
    identifier: d.tenant.identifier,
    name: d.tenant.name
  });

  let codeBucket = await origin.codeBucket.create({
    tenantId: originTenant.id,
    purpose: d.purpose ?? 'cargo.skill.destination',
    isReadOnly: false
  });

  return await db.skillDestination.create({
    data: {
      ...getId('skillDestination'),
      codeBucketId: codeBucket.id,
      lastUsedAt: new Date()
    }
  });
};
