import { createOriginClient } from '@metorial-platform-systems/origin-client';
import { env } from '@metorial/cargo-config';
import { getId } from '@metorial/cargo-config/id';
import type { SkillDestination, SkillRepository } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { syncStartQueue } from '../queues/sync/start';
import { getProjectTenantIdentifier } from './scope';

export let origin = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});

export type OriginTenantProject = { oid: bigint; name?: string };

export let getOriginTenant = async (project: OriginTenantProject) => {
  let name =
    project.name ??
    (
      await db.project.findUniqueOrThrow({
        where: { oid: project.oid },
        select: { name: true }
      })
    ).name;

  return await origin.tenant.upsert({
    identifier: getProjectTenantIdentifier(project),
    name
  });
};

export let createSkillDestination = async (d: {
  project: OriginTenantProject;
  purpose?: string;
}): Promise<SkillDestination> => {
  let originTenant = await getOriginTenant(d.project);

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
  project: OriginTenantProject;
  destination: Pick<SkillDestination, 'codeBucketId'>;
  isReadOnly?: boolean;
}) => {
  let originTenant = await getOriginTenant(d.project);
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
