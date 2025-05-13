import { db, Organization } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';

let include = {
  importedServer: true,

  variants: {
    include: {
      currentVersion: {
        include: {
          config: true
        }
      }
    }
  }
};

class ServerService {
  async getServerById(d: { serverId: string; organization: Organization }) {
    let server = await db.server.findFirst({
      where: {
        id: d.serverId,

        OR: [
          { type: 'imported' } // Public servers
        ]
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('server_listing', d.serverId));
    }

    return server;
  }
}

export let serverService = Service.create('serverService', () => new ServerService()).build();
