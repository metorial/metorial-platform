import { db, ID, ServerDeployment, Session } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { ingestEventService } from '@metorial/module-event';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { serverSessionCreatedQueue } from '../queue/serverSessionCreated';

let include = {
  serverDeployment: {
    include: {
      server: true,
      serverVariant: true
    }
  }
};

class ServerSessionImpl {
  async createServerSession(d: { session: Session; serverDeployment: ServerDeployment }) {
    let session = await db.serverSession.create({
      data: {
        id: await ID.generateId('serverSession'),
        serverDeploymentOid: d.serverDeployment.oid,
        instanceOid: d.session.instanceOid,
        sessionOid: d.session.oid,
        status: 'pending'
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
      serverSessionId: session.id
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
