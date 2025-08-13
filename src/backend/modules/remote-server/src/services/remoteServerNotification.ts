import { db, RemoteServerInstance } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  remoteServerInstance: true
};

class RemoteServerNotificationServiceImpl {
  async listRemoteServerNotifications(d: { server: RemoteServerInstance }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.remoteServerInstanceNotification.findMany({
            ...opts,
            where: {
              remoteServerInstanceOid: d.server.oid
            },
            include
          })
      )
    );
  }

  async getRemoteServerNotificationById(d: {
    server: RemoteServerInstance;
    notificationId: string;
  }) {
    let server = await db.remoteServerInstanceNotification.findFirst({
      where: {
        id: d.notificationId,
        remoteServerInstanceOid: d.server.oid
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('remote_server', d.notificationId));
    }

    return server;
  }
}

export let remoteServerNotificationService = Service.create(
  'remoteServerNotification',
  () => new RemoteServerNotificationServiceImpl()
).build();
