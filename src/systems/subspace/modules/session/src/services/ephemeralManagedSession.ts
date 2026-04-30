import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Session,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { env } from '../env';
import { createSessionRecord } from './_shared/createSession';

let ephemeralManagedSessionResolveLock = createLock({
  name: 'sub/ses/epms/resolve/lock',
  redisUrl: env.service.REDIS_URL
});

type ResolvedBackingSession = Session & {
  tenant: Tenant;
  solution: Solution;
};

let include = {
  tenant: true,
  solution: true,
  environment: true,
  sessionTemplate: true,
  currentSession: {
    include: {
      tenant: true,
      solution: true
    }
  }
};

let getEphemeralManagedSessionById = (d: {
  sessionId: string;
  tenantId: string;
  solutionId: string;
}) =>
  db.ephemeralManagedSession.findFirst({
    where: {
      id: d.sessionId,
      status: 'active',
      tenant: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
      solution: { OR: [{ id: d.solutionId }, { identifier: d.solutionId }] }
    },
    include
  });

type EphemeralManagedSessionRecord = NonNullable<
  Awaited<ReturnType<typeof getEphemeralManagedSessionById>>
>;

let shouldRotateBackingSession = (ephemeralManagedSession: EphemeralManagedSessionRecord) => {
  let currentSession = ephemeralManagedSession.currentSession;
  if (!currentSession) return true;
  if (currentSession.status !== 'active') return true;
  if (!currentSession.isEphemeral) return true;
  if (currentSession.ephemeralManagedSessionOid !== ephemeralManagedSession.oid) return true;
  if (
    (ephemeralManagedSession.templateHash ?? null) !==
    (ephemeralManagedSession.sessionTemplate.hash ?? null)
  ) {
    return true;
  }

  let maxDurationInMinutes = ephemeralManagedSession.maxSessionDurationInMinutes;
  if (maxDurationInMinutes <= 0) return false;

  return Date.now() - currentSession.createdAt.getTime() >= maxDurationInMinutes * 60 * 1000;
};

class ephemeralManagedSessionServiceImpl {
  async resolveBackingSessionById(d: {
    sessionId: string;
    tenantId: string;
    solutionId: string;
  }): Promise<ResolvedBackingSession | null> {
    let existing = await getEphemeralManagedSessionById(d);
    if (!existing) return null;

    if (!shouldRotateBackingSession(existing)) {
      return existing.currentSession!;
    }

    return await ephemeralManagedSessionResolveLock.usingLock(existing.id, async () => {
      let ephemeralManagedSession = await getEphemeralManagedSessionById(d);
      if (!ephemeralManagedSession) return null;

      if (!shouldRotateBackingSession(ephemeralManagedSession)) {
        return ephemeralManagedSession.currentSession!;
      }

      if (ephemeralManagedSession.sessionTemplate.status !== 'active') {
        return ephemeralManagedSession.currentSession;
      }

      return await withTransaction(async tx => {
        let session = await createSessionRecord({
          db: tx,
          tenant: ephemeralManagedSession.tenant,
          solution: ephemeralManagedSession.solution,
          environment: ephemeralManagedSession.environment,
          isEphemeral: true,
          ephemeralManagedSessionOid: ephemeralManagedSession.oid,
          input: {
            name: ephemeralManagedSession.sessionTemplate.name ?? undefined,
            description: ephemeralManagedSession.sessionTemplate.description ?? undefined,
            metadata:
              (ephemeralManagedSession.sessionTemplate.metadata as Record<
                string,
                any
              > | null) ?? undefined,
            privateMetadata:
              (ephemeralManagedSession.sessionTemplate.privateMetadata as Record<
                string,
                any
              > | null) ?? undefined,
            providers: [{ sessionTemplateId: ephemeralManagedSession.sessionTemplate.id }]
          }
        });

        await tx.ephemeralManagedSession.update({
          where: { oid: ephemeralManagedSession.oid },
          data: {
            currentSessionOid: session.oid,
            templateHash: ephemeralManagedSession.sessionTemplate.hash ?? null
          }
        });

        return {
          ...session,
          tenant: ephemeralManagedSession.tenant,
          solution: ephemeralManagedSession.solution
        };
      });
    });
  }
}

export let ephemeralManagedSessionService = Service.create(
  'ephemeralManagedSessionService',
  () => new ephemeralManagedSessionServiceImpl()
).build();
