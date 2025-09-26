import {
  db,
  ID,
  Instance,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthTokenReference,
  ServerOAuthSession,
  ServerOAuthSessionStatus
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  connection: {
    include: {
      template: true,
      instance: true,
      config: true
    }
  }
};

class ServerOAuthSessionImpl {
  async getServerOAuthSessionById(d: { instance: Instance; serverOAuthSessionId: string }) {
    let serverOAuthSession = await db.serverOAuthSession.findFirst({
      where: {
        id: d.serverOAuthSessionId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!serverOAuthSession) throw new ServiceError(notFoundError('provider_oauth.session'));

    return serverOAuthSession;
  }

  async getServerOAuthSessionByClientSecretAndReportOpened(d: { clientSecret: string }) {
    let serverOAuthSession = await db.serverOAuthSession.findFirst({
      where: {
        clientSecret: d.clientSecret
      },
      include: {
        ...include,
        instance: {
          include: { organization: true }
        }
      }
    });
    if (!serverOAuthSession) throw new ServiceError(notFoundError('provider_oauth.session'));
    if (serverOAuthSession.status != 'pending' && serverOAuthSession.status != 'opened') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server OAuth session is not pending or opened anymore'
        })
      );
    }

    if (serverOAuthSession.status == 'pending') {
      let up = await db.serverOAuthSession.update({
        where: { id: serverOAuthSession.id },
        data: { status: 'opened' }
      });
      serverOAuthSession = { ...serverOAuthSession, ...up };
    }

    return serverOAuthSession;
  }

  async getManyServerOAuthSessions(d: { sessionIds: string[]; instance: Instance }) {
    if (d.sessionIds.length === 0) return [];

    return await db.serverOAuthSession.findMany({
      where: {
        id: { in: d.sessionIds },
        instanceOid: d.instance.oid
      },
      include
    });
  }

  async createServerOAuthSession(d: {
    instance: Instance;
    connection: ProviderOAuthConnection;
    input: {
      metadata?: Record<string, string>;
      redirectUri?: string;
    };
  }) {
    return await db.serverOAuthSession.create({
      data: {
        id: await ID.generateId('serverOAuthSession'),
        clientSecret: await ID.generateId('serverOAuthSession_ClientSecret'),
        status: 'pending',
        instanceOid: d.instance.oid,
        connectionOid: d.connection.oid,
        metadata: d.input.metadata,
        redirectUri: d.input.redirectUri
      },
      include
    });
  }

  async archiveServerOAuthSession(d: { session: ServerOAuthSession }) {
    if (d.session.status === 'archived') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server OAuth session is already archived'
        })
      );
    }

    return await db.serverOAuthSession.update({
      where: { id: d.session.id },
      data: { status: 'archived' },
      include
    });
  }

  async completeServerOAuthSession(d: {
    session: ServerOAuthSession;
    tokenReference: ProviderOAuthConnectionAuthTokenReference;
  }) {
    if (d.session.status != 'opened' && d.session.status != 'pending') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server OAuth session cannot be completed in its current state'
        })
      );
    }

    return await db.serverOAuthSession.update({
      where: { id: d.session.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        tokenReferenceOid: d.tokenReference.oid
      }
    });
  }

  async listServerOAuthSessions(d: {
    instance: Instance;
    status?: ServerOAuthSessionStatus[];
    sessionIds?: string[];
    oauthConnectionIds?: string[];
  }) {
    let oauthConnections = d.oauthConnectionIds?.length
      ? await db.providerOAuthConnection.findMany({
          where: { id: { in: d.oauthConnectionIds }, instanceOid: d.instance.oid }
        })
      : undefined;
    let sessions = d.sessionIds?.length
      ? await db.session.findMany({
          where: { id: { in: d.sessionIds }, instanceOid: d.instance.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverOAuthSession.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [
                d.status ? { status: { in: d.status } } : { not: 'archived' },

                sessions
                  ? {
                      sessionServerDeployments: {
                        some: {
                          sessionOid: { in: sessions.map(s => s.oid) }
                        }
                      }
                    }
                  : undefined!,

                oauthConnections
                  ? {
                      oauthConnectionOid: { in: oauthConnections.map(c => c.oid) }
                    }
                  : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }
}

export let serverOAuthSessionService = Service.create(
  'serverOAuthSession',
  () => new ServerOAuthSessionImpl()
).build();
