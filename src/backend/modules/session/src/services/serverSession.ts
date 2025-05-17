import { db, ID, ServerDeployment, Session } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { ingestEventService } from '@metorial/module-event';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  serverDeployment: {
    include: {
      serverVariant: true
    }
  }
};

class ServerSessionImpl {
  async ensureServerSession(d: { session: Session; serverDeployment: ServerDeployment }) {
    let existing = await db.serverSession.findUnique({
      where: {
        serverDeploymentOid_sessionOid: {
          serverDeploymentOid: d.serverDeployment.oid,
          sessionOid: d.session.oid
        }
      },
      include
    });
    if (existing) return existing;

    let id = await ID.generateId('serverSession');

    let session = await db.serverSession.upsert({
      where: {
        serverDeploymentOid_sessionOid: {
          serverDeploymentOid: d.serverDeployment.oid,
          sessionOid: d.session.oid
        }
      },
      update: {},
      create: {
        id,
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

    if (session.id == id) {
      await ingestEventService.ingest('session.server_session:created', {
        session: d.session,
        serverSession: session,

        instance: session.instance,
        organization: session.instance.organization
      });
    }

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
