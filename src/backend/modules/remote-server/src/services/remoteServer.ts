import { db, ID, Instance, Organization, ProviderOAuthConnection } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { checkRemoteQueue } from '../queue/checkRemote';

let include = {
  connection: true
};

class RemoteServerServiceImpl {
  async createRemoteServer(d: {
    instance: Instance;
    organization: Organization;

    input: {
      name?: string;
      description?: string;

      remoteUrl: string;
      connection?: ProviderOAuthConnection;
    };
  }) {
    let remoteServer = await db.remoteServerInstance.create({
      data: {
        id: await ID.generateId('remoteServerInstance'),
        name: d.input.name,
        description: d.input.description,
        remoteUrl: d.input.remoteUrl,
        connectionOid: d.input.connection?.oid,
        instanceOid: d.instance.oid
      },
      include
    });

    await checkRemoteQueue.add({ remoteId: remoteServer.id }, { delay: 50 });

    return remoteServer;
  }

  async listRemoteServers(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.remoteServerInstance.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid
            },
            include
          })
      )
    );
  }

  async getRemoteServerById(d: { instance: Instance; serverId: string }) {
    let server = await db.remoteServerInstance.findFirst({
      where: {
        id: d.serverId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('remote_server', d.serverId));
    }

    return server;
  }
}

export let remoteServerService = Service.create(
  'remoteServer',
  () => new RemoteServerServiceImpl()
).build();
