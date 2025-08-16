import { CustomServer, db, Instance } from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  customServer: true,
  customServerVersion: true
};

class CustomServerEventServiceImpl {
  async listCustomServerEvents(d: {
    instance: Instance;
    server: CustomServer;
    versionIds?: string[];
  }) {
    let versionIdsUnique = d.versionIds ? [...new Set(d.versionIds)] : [];
    let versionOids = d.versionIds
      ? await db.customServerVersion
          .findMany({
            where: { id: { in: versionIdsUnique } },
            select: { oid: true }
          })
          .then(r => r.map(v => v.oid))
      : undefined;

    if (d.versionIds && (!versionOids || versionIdsUnique.length !== versionOids.length)) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid version IDs provided'
        })
      );
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.customServerEvent.findMany({
            ...opts,
            where: {
              sourceInstanceOid: d.instance.oid,
              customServerOid: d.server.oid,
              customServerVersionOid: versionOids ? { in: versionOids } : undefined
            },
            include
          })
      )
    );
  }

  async getCustomServerEventById(d: {
    instance: Instance;
    server: CustomServer;
    eventId: string;
  }) {
    let server = await db.customServerEvent.findFirst({
      where: {
        id: d.eventId,
        sourceInstanceOid: d.instance.oid,
        customServerOid: d.server.oid
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('custom_server_event', d.eventId));
    }

    return server;
  }
}

export let customServerEventService = Service.create(
  'customServerEvent',
  () => new CustomServerEventServiceImpl()
).build();
