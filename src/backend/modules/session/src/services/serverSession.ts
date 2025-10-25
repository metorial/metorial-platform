import { Context } from '@metorial/context';
import { db, ID, ServerDeployment, Session, SessionMcpConnectionType } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { createLock } from '@metorial/lock';
import { ingestEventService } from '@metorial/module-event';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { serverSessionCreatedQueue } from '../queue/serverSessionCreated';

let include = {
  serverDeployment: {
    include: {
      server: true,
      serverVariant: true,
      accessLimiter: true
    }
  },
  sessionConnection: true
};

let sessionLock = createLock({
  name: 'ses/srs/lock'
});

class ServerSessionImpl {
  async ensureServerSession(d: {
    session: Session;
    serverDeployment: ServerDeployment;
    context: Context;
    connectionType: SessionMcpConnectionType;
  }) {
    return sessionLock.usingLock(d.session.id, async () => {
      let serverSession = await db.serverSession.findFirst({
        where: {
          sessionOid: d.session.oid,
          serverDeploymentOid: d.serverDeployment.oid,
          status: 'running'
        },
        include
      });
      if (serverSession) return serverSession;

      return this.createServerSession(d);
    });
  }

  async createServerSession(d: {
    session: Session;
    serverDeployment: ServerDeployment;
    context: Context;
    connectionType: SessionMcpConnectionType;
  }) {
    let session = await db.serverSession.create({
      data: {
        id: await ID.generateId('serverSession'),
        serverDeploymentOid: d.serverDeployment.oid,
        instanceOid: d.session.instanceOid,
        sessionOid: d.session.oid,
        status: 'pending',
        mcpConnectionType: d.connectionType
      },
      include: {
        ...include,
        instance: {
          include: {
            organization: true
          }
        }
      }
    });

    await ingestEventService.ingest('session.server_session:created', {
      session: d.session,
      serverSession: session,

      instance: session.instance,
      organization: session.instance.organization
    });

    await serverSessionCreatedQueue.add({
      serverSessionId: session.id,
      context: d.context
    });

    return session;
  }

  async getServerSessionById(d: { session: Session; serverSessionId: string }) {
    let serverSession = await db.serverSession.findFirst({
      where: {
        id: d.serverSessionId,
        sessionOid: d.session.oid
      },
      include
    });
    if (!serverSession) throw new ServiceError(notFoundError('server_session'));

    return serverSession;
  }

  async listServerSessions(d: { session: Session }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.serverSession.findMany({
            ...opts,
            where: {
              sessionOid: d.session.oid
            },
            include
          })
      )
    );
  }
}

export let serverSessionService = Service.create(
  'serverSession',
  () => new ServerSessionImpl()
).build();
