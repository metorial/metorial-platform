import { db, Organization } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';

let include = {
  importedServer: true,
  customServer: true,

  variants: {
    include: {
      currentVersion: {
        include: {
          schema: true
        }
      }
    }
  }
};

class ServerService {
  async getServerById(d: { serverId: string; organization?: Organization }) {
    let server = await db.server.findFirst({
      where: {
        AND: [
          {
            OR: [
              { id: d.serverId },
              { listing: { id: d.serverId } },
              { listing: { slug: d.serverId } }
            ]
          },

          {
            OR: [
              { type: 'imported' },

              { isPublic: true },
              { ownerOrganizationOid: d.organization?.oid }
            ]
          }
        ]
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('server_listing', d.serverId));
    }

    if (server.customServer && server.customServer.organizationOid != d.organization?.oid) {
      server.customServer = null;
    }

    return server;
  }
}

export let serverService = Service.create('serverService', () => new ServerService()).build();
