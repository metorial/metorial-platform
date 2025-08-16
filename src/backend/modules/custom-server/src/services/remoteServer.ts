import { db, Instance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  providerOAuthDiscoveryDocument: true
};

class RemoteServerServiceImpl {
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
