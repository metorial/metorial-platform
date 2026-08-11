import { badRequestError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { db, Instance, MagicMcpServer, Prisma } from '@metorial/db';
import { sessionClientSecretReferenceService } from '@metorial/module-access';
import { narrowSessionIdFilter } from '../lib/fineGrainedSessionFilter';
import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

let Sentry = getSentry();

type RawSubspaceSession = Awaited<ReturnType<typeof subspace.session.get>>;
type MagicMcpSessionWithRelations = Prisma.MagicMcpSessionGetPayload<{
  include: {
    instance: true;
    magicMcpEndpoint: true;
    magicMcpServer: true;
  };
}>;

let enrichSessions = async (d: { instance: Instance; sessions: RawSubspaceSession[] }) => {
  if (d.sessions.length === 0) return [];

  let [references, magicMcpConnections] = await Promise.all([
    sessionClientSecretReferenceService.getForSessions({
      instance: d.instance as any,
      sessionIds: d.sessions.map(session => session.id)
    }),
    db.magicMcpSession.findMany({
      where: {
        instanceOid: d.instance.oid,
        subspaceSessionId: {
          in: d.sessions.map(session => session.id)
        }
      },
      include: {
        instance: true,
        magicMcpEndpoint: true,
        magicMcpServer: true
      }
    })
  ]);

  let referenceMap = new Map(
    references.map(
      reference => [reference.sessionId, reference.fineGrainedKey.secret] as const
    )
  );
  let magicMcpConnectionMap = new Map(
    magicMcpConnections.map(connection => [connection.subspaceSessionId, connection] as const)
  );

  return d.sessions.map(session => ({
    ...session,
    clientSecret: referenceMap.get(session.id) ?? null,
    magicMcpServer: magicMcpConnectionMap.get(session.id)?.magicMcpServer ?? null,
    magicMcpSession: magicMcpConnectionMap.get(session.id) ?? null
  }));
};

let enrichSession = async (d: { instance: Instance; session: RawSubspaceSession }) => {
  let [session] = await enrichSessions({
    instance: d.instance,
    sessions: [d.session]
  });

  return session!;
};

let enrichSessionEnsuringClientSecret = async (d: {
  instance: Instance;
  session: RawSubspaceSession;
}) => {
  let session = await enrichSession(d);
  if (session.clientSecret != null) return session;

  let { clientSecret } = await sessionClientSecretReferenceService.createForSession({
    instance: d.instance,
    sessionId: d.session.id
  });

  return {
    ...session,
    clientSecret
  };
};

export let finalizeSubspaceSessionCreate = async (d: {
  instance: Instance;
  session: RawSubspaceSession;
}) => {
  await sessionClientSecretReferenceService.createForSession({
    instance: d.instance,
    sessionId: d.session.id
  });

  return await enrichSession({
    instance: d.instance,
    session: d.session
  });
};

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'getMany', 'list', 'create', 'update', 'delete'],
  inner => ({
    get: async (...params: Parameters<typeof inner.get>) => {
      let session = await inner.get(...params);

      return await enrichSessionEnsuringClientSecret({
        instance: params[0].instance,
        session
      });
    },
    getMany: async (...params: Parameters<typeof inner.getMany>) => {
      let sessions = await inner.getMany(...params);

      return await enrichSessions({
        instance: params[0].instance,
        sessions
      });
    },
    list: async (
      input: Parameters<typeof inner.list>[0] & { accessTagSessionIds?: string[] }
    ) => {
      let ids = narrowSessionIdFilter({
        allowedSessionIds: input.accessTagSessionIds,
        requestedSessionIds: input.ids
      });

      let paginator = await inner.list({
        ...input,
        ids
      });

      return paginator.map(items =>
        enrichSessions({
          instance: input.instance,
          sessions: items
        })
      );
    },
    create: async (...params: Parameters<typeof inner.create>) => {
      let session = await inner.create(...params);

      return await finalizeSubspaceSessionCreate({
        instance: params[0].instance,
        session
      });
    },
    update: async (
      arg0: Parameters<typeof inner.update>[0] & { _allowMagicMcpUpdate?: boolean }
    ) => {
      let magicMcpLink = await db.magicMcpSession.findFirst({
        where: { subspaceSessionId: arg0.sessionId }
      });
      if (magicMcpLink && !arg0._allowMagicMcpUpdate) {
        throw new ServiceError(
          badRequestError({
            message: 'This session cannot be updated.'
          })
        );
      }

      let session = await inner.update(arg0);

      return await enrichSessionEnsuringClientSecret({
        instance: arg0.instance,
        session
      });
    },
    delete: async (
      arg0: Parameters<typeof inner.delete>[0] & { _allowMagicMcpDelete?: boolean }
    ) => {
      let magicMcpLink = await db.magicMcpSession.findFirst({
        where: { subspaceSessionId: arg0.sessionId }
      });
      if (magicMcpLink && !arg0._allowMagicMcpDelete) {
        throw new ServiceError(
          badRequestError({
            message: 'This session cannot be deleted.'
          })
        );
      }

      let session = await inner.delete(arg0);

      return await enrichSession({
        instance: arg0.instance,
        session
      });
    }
  })
);

export type SubspaceSession = RawSubspaceSession & {
  clientSecret?: string | null;
  magicMcpServer?: MagicMcpServer | null;
  magicMcpSession?: MagicMcpSessionWithRelations | null;
};
