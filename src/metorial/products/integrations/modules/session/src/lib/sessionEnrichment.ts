import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Instance, MagicMcpServer, Prisma } from '@metorial/db';
import { sessionClientSecretReferenceService } from '@metorial/module-access';
import { metorialDb } from '@metorial-subspace/module-tenant';

type MagicMcpSessionWithRelations = Prisma.MagicMcpSessionGetPayload<{
  include: {
    instance: true;
    magicMcpEndpoint: true;
    magicMcpServer: true;
  };
}>;

export type EnrichedSessionFields = {
  clientSecret?: string | null;
  magicMcpServer?: MagicMcpServer | null;
  magicMcpSession?: MagicMcpSessionWithRelations | null;
};

export type EnrichableSession = { id: string };

export let enrichSessions = async <T extends EnrichableSession>(d: {
  instance: Instance;
  sessions: T[];
}): Promise<Array<T & EnrichedSessionFields>> => {
  if (d.sessions.length === 0) return [];

  let [references, magicMcpConnections] = await Promise.all([
    sessionClientSecretReferenceService.getForSessions({
      instance: d.instance as any,
      sessionIds: d.sessions.map(session => session.id)
    }),
    metorialDb.magicMcpSession.findMany({
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

export let enrichSession = async <T extends EnrichableSession>(d: {
  instance: Instance;
  session: T;
}): Promise<T & EnrichedSessionFields> => {
  let [session] = await enrichSessions({
    instance: d.instance,
    sessions: [d.session]
  });

  return session!;
};

export let enrichSessionEnsuringClientSecret = async <T extends EnrichableSession>(d: {
  instance: Instance;
  session: T;
}): Promise<T & EnrichedSessionFields> => {
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

export let finalizeSessionCreate = async <T extends EnrichableSession>(d: {
  instance: Instance;
  session: T;
}): Promise<T & EnrichedSessionFields> => {
  await sessionClientSecretReferenceService.createForSession({
    instance: d.instance,
    sessionId: d.session.id
  });

  return await enrichSession({
    instance: d.instance,
    session: d.session
  });
};

export let assertMagicMcpSessionMutable = async (d: {
  sessionId: string;
  allow?: boolean;
  action: 'updated' | 'deleted';
}) => {
  if (d.allow) return;

  let magicMcpLink = await metorialDb.magicMcpSession.findFirst({
    where: { subspaceSessionId: d.sessionId }
  });
  if (!magicMcpLink) return;

  throw new ServiceError(
    badRequestError({
      message: `This session cannot be ${d.action}.`
    })
  );
};
