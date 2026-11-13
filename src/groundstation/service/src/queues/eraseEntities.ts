import { createQueue, hourlyPacedDelay } from '@lowerdeck/queue';
import type { Prisma } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { env } from '../env';
import { invalidateEntityCache } from '../identity/cache';

let chunkSize = 500;

export type EntityErasureScope = {
  organizationId: string;
  projectId?: string;
  instanceId?: string;
};

export let eraseEntitiesQueue = createQueue<EntityErasureScope & { cursor?: string }>({
  name: 'gs/entities/erase',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Entities an ingest token is still bound to can't be deleted, so they are stripped of
// everything personal and archived instead.
export let purgeEntities = async (d: { organizationId: string; oids: bigint[] }) => {
  if (!d.oids.length) return;

  let entities = await db.entity.findMany({
    where: { oid: { in: d.oids } },
    include: {
      _count: { select: { userTokens: true, deviceTokens: true, agentTokens: true } }
    }
  });

  let oids = entities.map(entity => entity.oid);
  let bound = entities
    .filter(
      entity =>
        entity._count.userTokens + entity._count.deviceTokens + entity._count.agentTokens > 0
    )
    .map(entity => entity.oid);
  let unbound = oids.filter(oid => !bound.includes(oid));

  let released = await withTransaction(async db => {
    let released = await db.entityIdentifier.findMany({
      where: { entityOid: { in: oids } },
      select: { kind: true, type: true, value: true }
    });

    await db.entityIdentifier.deleteMany({ where: { entityOid: { in: oids } } });
    await db.entityLink.deleteMany({
      where: { OR: [{ fromOid: { in: oids } }, { toOid: { in: oids } }] }
    });
    await db.pendingMembership.deleteMany({ where: { targetEntityOid: { in: oids } } });
    await db.mergeSuggestion.deleteMany({
      where: {
        OR: [{ discoveredEntityOid: { in: oids } }, { managedEntityOid: { in: oids } }]
      }
    });
    await db.classifierLabel.deleteMany({ where: { entityOid: { in: oids } } });
    await db.attributionRule.deleteMany({ where: { targetEntityOid: { in: oids } } });

    await db.entity.updateMany({
      where: { oid: { in: bound } },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        name: null,
        slug: null,
        attributes: {}
      }
    });
    await db.entity.deleteMany({ where: { oid: { in: unbound } } });

    return released;
  });

  await invalidateEntityCache({ organizationId: d.organizationId, identifiers: released });
};

// Organization erasure removes every entity; project or instance erasure only the entities
// limited to that scope (07 §11).
export let eraseEntitiesChunk = async (d: EntityErasureScope & { cursor?: string }) => {
  let organization = await db.organization.findUnique({ where: { id: d.organizationId } });
  if (!organization) return { cursor: null };

  let where: Prisma.EntityWhereInput = { organizationOid: organization.oid };
  if (d.instanceId) where.scopeInstance = { id: d.instanceId };
  else if (d.projectId) where.scopeProject = { id: d.projectId };

  let entities = await db.entity.findMany({
    where: { ...where, oid: d.cursor ? { gt: BigInt(d.cursor) } : undefined },
    orderBy: { oid: 'asc' },
    take: chunkSize,
    select: { oid: true }
  });

  if (!entities.length) return { cursor: null };

  await purgeEntities({
    organizationId: organization.id,
    oids: entities.map(entity => entity.oid)
  });

  return {
    cursor: entities.length == chunkSize ? entities[entities.length - 1]!.oid.toString() : null
  };
};

export let eraseEntitiesProcessor = eraseEntitiesQueue.process(async data => {
  let { cursor } = await eraseEntitiesChunk(data);

  if (cursor) await eraseEntitiesQueue.add({ ...data, cursor }, hourlyPacedDelay());
});
