import type { SkillDestination, Tenant } from '@metorial-cargo/db';
import { addAfterTransactionHook, db, env, getId } from '@metorial-cargo/db';
import { createOriginClient } from '@metorial-platform-systems/origin-client';
import { skillPluginSyncManyQueue } from '../queues/sync/skillPluginSyncMany';
import { syncStartQueue } from '../queues/sync/start';

export let origin = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});

let getOriginTenant = async (
  tenantInput: Pick<Tenant, 'oid' | 'id'> & Partial<Pick<Tenant, 'identifier' | 'name'>>
) => {
  let tenant =
    tenantInput.identifier && tenantInput.name
      ? (tenantInput as Tenant)
      : await db.tenant.findFirstOrThrow({
          where: {
            oid: tenantInput.oid
          }
        });

  return await origin.tenant.upsert({
    identifier: tenant.identifier,
    name: tenant.name
  });
};

export let createSkillDestination = async (d: {
  tenant: Pick<Tenant, 'oid' | 'id'> & Partial<Pick<Tenant, 'identifier' | 'name'>>;
  purpose?: string;
}): Promise<SkillDestination> => {
  let originTenant = await getOriginTenant(d.tenant);

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

export let getSkillDestinationEditorUrl = async (d: {
  tenant: Pick<Tenant, 'oid' | 'id'> & Partial<Pick<Tenant, 'identifier' | 'name'>>;
  destination: Pick<SkillDestination, 'codeBucketId'>;
  isReadOnly?: boolean;
}) => {
  let originTenant = await getOriginTenant(d.tenant);
  let res = await origin.codeBucket.getEditorToken({
    tenantId: originTenant.id,
    codeBucketId: d.destination.codeBucketId,
    isReadOnly: d.isReadOnly
  });

  return {
    url: res.url,
    expiresAt: res.expiresAt
  };
};

export let enqueueSkillDestinationSync = async (destinationOid: bigint | null | undefined) => {
  if (!destinationOid) return;

  await addAfterTransactionHook(async () => {
    let sync = await db.skillDestinationSync.create({
      data: {
        ...getId('skillDestinationSync'),
        destinationOid,
        status: 'pending'
      }
    });

    await syncStartQueue.add({
      skillDestinationSyncId: sync.id
    });
  });
};

export let enqueueSkillPluginSyncs = async (d: { skillPluginId: string }) => {
  await addAfterTransactionHook(async () => {
    await skillPluginSyncManyQueue.add({
      skillPluginId: d.skillPluginId
    });
  });
};
