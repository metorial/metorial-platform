import { createOriginClient } from '@metorial-platform-systems/origin-client';
import { env } from '@metorial/cargo-config';
import { getId } from '@metorial/cargo-config/id';
import type { ResourceTenant, SkillDestination, SkillRepository } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { syncStartQueue } from '../queues/sync/start';

export let origin = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});

export let getOriginTenant = async (
  tenantInput: Pick<ResourceTenant, 'oid' | 'id'> &
    Partial<Pick<ResourceTenant, 'identifier' | 'name'>>
) => {
  let resourceTenant =
    tenantInput.identifier && tenantInput.name
      ? (tenantInput as ResourceTenant)
      : await db.resourceTenant.findFirstOrThrow({
          where: {
            oid: tenantInput.oid
          }
        });

  return await origin.tenant.upsert({
    identifier: resourceTenant.identifier,
    name: resourceTenant.name
  });
};

export let createSkillDestination = async (d: {
  resourceTenant: Pick<ResourceTenant, 'oid' | 'id'> &
    Partial<Pick<ResourceTenant, 'identifier' | 'name'>>;
  purpose?: string;
}): Promise<SkillDestination> => {
  let originTenant = await getOriginTenant(d.resourceTenant);

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
  resourceTenant: Pick<ResourceTenant, 'oid' | 'id'> &
    Partial<Pick<ResourceTenant, 'identifier' | 'name'>>;
  destination: Pick<SkillDestination, 'codeBucketId'>;
  isReadOnly?: boolean;
}) => {
  let originTenant = await getOriginTenant(d.resourceTenant);
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

export let forceSkillDestinationSync = async (d: {
  destination: Pick<SkillDestination, 'oid'>;
  repository?: Pick<SkillRepository, 'id'>;
}) => {
  let sync = await withTransaction(async db => {
    await db.skillDestination.update({
      where: {
        oid: d.destination.oid
      },
      data: {
        isDirty: false,
        lastTransientChangeAt: null,
        firstTransientChangeAt: null,
        shouldFlushAt: null,
        mustFlushAt: null
      }
    });

    return await db.skillDestinationSync.create({
      data: {
        ...getId('skillDestinationSync'),
        destinationOid: d.destination.oid,
        status: 'pending'
      }
    });
  });

  await syncStartQueue.add({
    skillDestinationSyncId: sync.id,
    skillRepositoryId: d.repository?.id
  });

  return sync;
};
