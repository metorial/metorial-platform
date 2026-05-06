import { notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  type EphemeralManagedSession,
  getId,
  type Session,
  type SessionTemplate,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { checkDeletedEdit } from '@metorial-subspace/list-utils';
import { env } from '../env';
import { sessionArchivedQueue } from '../queues/lifecycle/session';
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
  identity: true,
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

let getWillRotateAt = (d: { session: Session; maxSessionDurationInMinutes: number }) => {
  if (d.maxSessionDurationInMinutes <= 0) return null;
  return new Date(d.session.createdAt.getTime() + d.maxSessionDurationInMinutes * 60 * 1000);
};

class ephemeralManagedSessionServiceImpl {
  async getEphemeralManagedSessionById(d: {
    ephemeralManagedSessionId: string;
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    allowDeleted?: boolean;
  }) {
    let ephemeralManagedSession = await db.ephemeralManagedSession.findFirst({
      where: {
        id: d.ephemeralManagedSessionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include
    });
    if (!ephemeralManagedSession) {
      throw new ServiceError(
        notFoundError('ephemeral_managed_session', d.ephemeralManagedSessionId)
      );
    }

    return ephemeralManagedSession;
  }

  async createEphemeralManagedSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    sessionTemplate: SessionTemplate;
    input: {
      maxSessionDurationInMinutes: number;
    };
  }) {
    return withTransaction(async tx => {
      let ephemeralManagedSession = await tx.ephemeralManagedSession.create({
        data: {
          ...getId('ephemeralManagedSession'),
          status: 'active',
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          sessionTemplateOid: d.sessionTemplate.oid,
          actorOid: d.sessionTemplate.identityActorOid ?? null,
          identityOid: d.sessionTemplate.identityOid ?? null,
          maxSessionDurationInMinutes: d.input.maxSessionDurationInMinutes,
          templateHash: d.sessionTemplate.hash ?? null
        },
        include
      });

      let session = await createSessionRecord({
        db: tx,
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        isEphemeral: true,
        ephemeralManagedSessionOid: ephemeralManagedSession.oid,
        identityActorOid: d.sessionTemplate.identityActorOid ?? null,
        identityOid: d.sessionTemplate.identityOid ?? null,
        input: {
          name: d.sessionTemplate.name ?? undefined,
          description: d.sessionTemplate.description ?? undefined,
          metadata: (d.sessionTemplate.metadata as Record<string, any> | null) ?? undefined,
          privateMetadata:
            (d.sessionTemplate.privateMetadata as Record<string, any> | null) ?? undefined,
          providers: [{ sessionTemplateId: d.sessionTemplate.id }]
        }
      });

      return await tx.ephemeralManagedSession.update({
        where: { oid: ephemeralManagedSession.oid },
        data: {
          currentSessionOid: session.oid,
          templateHash: d.sessionTemplate.hash ?? null,
          willRotateAt: getWillRotateAt({
            session,
            maxSessionDurationInMinutes: d.input.maxSessionDurationInMinutes
          })
        },
        include
      });
    });
  }

  async upsertPlaceholderEphemeralManagedSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ephemeralManagedSession?: EphemeralManagedSession | null;
    sessionTemplate: SessionTemplate;
    input: {
      maxSessionDurationInMinutes: number;
      actorOid?: bigint | null;
    };
  }) {
    return withTransaction(async tx => {
      let data = {
        status: 'active' as const,
        archivedAt: null,
        maxSessionDurationInMinutes: d.input.maxSessionDurationInMinutes,
        sessionTemplateOid: d.sessionTemplate.oid,
        actorOid: d.input.actorOid ?? d.sessionTemplate.identityActorOid ?? null,
        identityOid: d.sessionTemplate.identityOid ?? null
      };

      if (d.ephemeralManagedSession) {
        return await tx.ephemeralManagedSession.update({
          where: {
            oid: d.ephemeralManagedSession.oid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid
          },
          data,
          include
        });
      }

      return await tx.ephemeralManagedSession.create({
        data: {
          ...getId('ephemeralManagedSession'),
          ...data,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        include
      });
    });
  }

  async archiveEphemeralManagedSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ephemeralManagedSession: EphemeralManagedSessionRecord;
  }) {
    checkDeletedEdit(d.ephemeralManagedSession, 'archive');

    return await ephemeralManagedSessionResolveLock.usingLock(
      d.ephemeralManagedSession.id,
      async () => {
        let ephemeralManagedSession = await this.getEphemeralManagedSessionById({
          ephemeralManagedSessionId: d.ephemeralManagedSession.id,
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment
        });

        checkDeletedEdit(ephemeralManagedSession, 'archive');

        return withTransaction(async tx => {
          let archivedAt = new Date();
          let sessions = await tx.session.findMany({
            where: {
              ephemeralManagedSessionOid: ephemeralManagedSession.oid,
              status: 'active'
            },
            select: { oid: true, id: true }
          });

          if (sessions.length > 0) {
            await tx.sessionProvider.updateMany({
              where: {
                sessionOid: { in: sessions.map(session => session.oid) }
              },
              data: {
                status: 'archived'
              }
            });

            await tx.session.updateMany({
              where: {
                oid: { in: sessions.map(session => session.oid) }
              },
              data: {
                status: 'archived',
                archivedAt,
                connectionState: 'disconnected'
              }
            });
          }

          let archived = await tx.ephemeralManagedSession.update({
            where: { oid: ephemeralManagedSession.oid },
            data: {
              status: 'archived',
              archivedAt,
              willRotateAt: null
            },
            include
          });

          if (sessions.length > 0) {
            await addAfterTransactionHook(async () =>
              sessionArchivedQueue.addMany(
                sessions.map(session => ({
                  sessionId: session.id
                }))
              )
            );
          }

          return archived;
        });
      }
    );
  }

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
          identityActorOid: ephemeralManagedSession.sessionTemplate.identityActorOid ?? null,
          identityOid: ephemeralManagedSession.sessionTemplate.identityOid ?? null,
          input: {
            name: ephemeralManagedSession.sessionTemplate.name ?? undefined,
            description: ephemeralManagedSession.sessionTemplate.description ?? undefined,
            metadata:
              (ephemeralManagedSession.sessionTemplate.metadata as any | null) ?? undefined,
            privateMetadata:
              (ephemeralManagedSession.sessionTemplate.privateMetadata as any | null) ??
              undefined,
            providers: [{ sessionTemplateId: ephemeralManagedSession.sessionTemplate.id }]
          }
        });

        await tx.ephemeralManagedSession.update({
          where: { oid: ephemeralManagedSession.oid },
          data: {
            currentSessionOid: session.oid,
            templateHash: ephemeralManagedSession.sessionTemplate.hash ?? null,
            willRotateAt: getWillRotateAt({
              session,
              maxSessionDurationInMinutes: ephemeralManagedSession.maxSessionDurationInMinutes
            })
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
