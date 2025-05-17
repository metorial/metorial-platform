import { db, ID, ServerDeployment, Session } from '@metorial/db';
import { Service } from '@metorial/service';

let include = {
  // session: true,
  serverDeployment: {
    include: {
      serverVariant: {
        // include: {
        //   currentVersion: true
        // }
      }
      // serverImplementation: true
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
        sessionOid: d.session.oid
      }
    });

    if (session.id == id) {
      // TODO: report event
    }

    return session;
  }
}

export let serverSessionService = Service.create(
  'serverSession',
  () => new ServerSessionImpl()
).build();
