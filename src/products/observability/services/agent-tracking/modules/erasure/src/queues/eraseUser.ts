import { createQueue, deleteInChunks, hourlyPacedDelay } from '@lowerdeck/queue';
import type { Prisma } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import { usageErasureService } from '@mtsrc/agent-tracking-module-usage';
import { recordErasureService } from '@mtsrc/agent-tracking-module-records';
import { ingestTokenService } from '@mtsrc/agent-tracking-module-ingest-access';
import { getStore, isStoreConfigured } from '@mtsrc/agent-tracking-store';
import { purgeEntities } from '@mtsrc/agent-tracking-module-entities';
import { queryExportService } from '@mtsrc/agent-tracking-module-query';

let chunkSize = 500;
let maxChunksPerJob = 20;

// Other processes keep resolved identifiers in memory for up to a minute (identity/cache.ts),
// so records stamped with the erased user can still land until then.
let identityCacheDrainMs = 60_000;

export type UserErasurePhase = 'registry' | 'records' | 'sessions' | 'slices';

export type UserErasureJob = {
  organizationId: string;
  userId: string;
  phase: UserErasurePhase;
};

export type UserErasureStep = { job: UserErasureJob; delay?: number } | null;

export let eraseUserQueue = createQueue<UserErasureJob>({
  name: 'at/users/erase',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let revokeUserTokens = async (d: { userEntityOid: bigint }) => {
  let tokens = await db.ingestToken.findMany({
    where: { userEntityOid: d.userEntityOid, revokedAt: null }
  });

  for (let ingestToken of tokens) await ingestTokenService.revokeIngestToken({ ingestToken });
};

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

// Client users linked only to this user, its ephemeral devices (which hold the client IPs) and
// entities merged into it go with it.
let dependentsFilter = async (user: { oid: bigint; organizationOid: bigint }) => {
  let tokens = await db.ingestToken.findMany({
    where: { userEntityOid: user.oid },
    select: { id: true }
  });

  let ownedByUser = { some: { type: 'owned_by', toOid: user.oid } };

  return {
    organizationOid: user.organizationOid,
    oid: { not: user.oid },
    OR: [
      { mergedIntoOid: user.oid },
      {
        kind: 'client_user',
        outgoingLinks: ownedByUser,
        NOT: { outgoingLinks: { some: { type: 'owned_by', toOid: { not: user.oid } } } }
      },
      {
        kind: 'device',
        attributes: { path: ['ephemeral'], equals: true },
        OR: [
          { outgoingLinks: ownedByUser },
          ...tokens.map(token => ({ attributes: { path: ['tokenId'], equals: token.id } }))
        ]
      }
    ]
  } satisfies Prisma.EntityWhereInput;
};

let eraseRegistry = async (job: UserErasureJob): Promise<UserErasureStep> => {
  let next = { job: { ...job, phase: 'records' as const }, delay: identityCacheDrainMs };

  await queryExportService.expirePersonalExports({ organizationId: job.organizationId });

  let user = await db.entity.findFirst({
    where: { id: job.userId, kind: 'user', organization: { id: job.organizationId } },
    include: { identifiers: true }
  });
  if (!user) return next;

  await revokeUserTokens({ userEntityOid: user.oid });

  let dependents = await db.entity.findMany({
    where: await dependentsFilter(user),
    take: chunkSize,
    select: { oid: true }
  });

  await purgeEntities({
    organizationId: job.organizationId,
    oids: dependents.map(entity => entity.oid)
  });
  if (dependents.length == chunkSize) return { job };

  let emails = user.identifiers
    .filter(identifier => identifier.type == 'email')
    .map(identifier => identifier.value);

  await db.pendingMembership.deleteMany({
    where: { organizationOid: user.organizationOid, email: { in: emails } }
  });
  await purgeEntities({ organizationId: job.organizationId, oids: [user.oid] });

  return next;
};

let eraseRecords = async (job: UserErasureJob): Promise<UserErasureStep> => {
  let { hasMore } = await recordErasureService.eraseUser({
    organizationId: job.organizationId,
    userId: job.userId
  });
  if (hasMore) return { job };

  return { job: { ...job, phase: 'sessions' } };
};

// Sessions the user sent are deleted; others that only list them (a manual assignment, a
// derived entry) keep everything but the user.
let eraseSessions = async (job: UserErasureJob): Promise<UserErasureStep> => {
  let { sessions, sourceHealth } = await collections();
  let filter = { organizationId: job.organizationId, 'observed.userId': job.userId };

  let result = await deleteInChunks({
    chunkSize,
    maxChunks: maxChunksPerJob,
    selectKeys: async limit =>
      (
        await sessions
          .find(filter, { projection: { _id: 1 } })
          .limit(limit)
          .toArray()
      ).map(session => session._id),
    deleteKeys: ids => sessions.deleteMany({ ...filter, _id: { $in: ids } })
  });
  if (result.hasMore) return { job };

  await sessions.updateMany(
    { organizationId: job.organizationId, 'attribution.dimIds': job.userId },
    {
      $pull: {
        'attribution.entries': { entityId: job.userId },
        'attribution.dimIds': job.userId
      }
    }
  );
  await sessions.updateMany(
    { organizationId: job.organizationId, 'manual.entityId': job.userId },
    { $pull: { manual: { entityId: job.userId } } }
  );
  await sourceHealth.deleteMany({ organizationId: job.organizationId, userId: job.userId });

  return { job: { ...job, phase: 'slices' } };
};

let eraseSlices = async (job: UserErasureJob): Promise<UserErasureStep> => {
  let organization = await db.organization.findUnique({
    where: { id: job.organizationId },
    select: { settings: true }
  });

  let { hasMore } = await usageErasureService.eraseUser({
    organizationId: job.organizationId,
    userId: job.userId,
    mode: organization?.settings.sliceErasureMode ?? 'anonymize'
  });

  return hasMore ? { job } : null;
};

// Each step is idempotent and returns the job to run next, so a lost or repeated job only
// repeats work. The registry goes first: once the user's identifiers are gone, new vendor
// records resolve to a new discovered user instead of the erased one.
export let eraseUserStep = async (job: UserErasureJob): Promise<UserErasureStep> => {
  if (job.phase == 'registry') return await eraseRegistry(job);
  if (!isStoreConfigured()) return null;

  if (job.phase == 'records') return await eraseRecords(job);
  if (job.phase == 'sessions') return await eraseSessions(job);

  return await eraseSlices(job);
};

export let eraseUserProcessor = eraseUserQueue.process(async data => {
  let next = await eraseUserStep(data);
  if (!next) return;

  await eraseUserQueue.add(next.job, next.delay ? { delay: next.delay } : hourlyPacedDelay());
});
