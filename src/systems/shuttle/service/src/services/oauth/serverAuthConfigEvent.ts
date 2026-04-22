import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';

let include = {
  serverAuthConfig: true
};

class serverAuthConfigEventServiceImpl {
  async listServerAuthConfigEvents(d: { tenant: Tenant; serverAuthConfigIds?: string[] }) {
    let authConfigs = d.serverAuthConfigIds?.length
      ? await db.serverAuthConfig.findMany({
          where: {
            tenantOid: d.tenant.oid,
            id: { in: d.serverAuthConfigIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.serverAuthConfigEvent.findMany({
          ...opts,
          where: {
            serverAuthConfig: {
              tenantOid: d.tenant.oid
            },
            serverAuthConfigOid: authConfigs
              ? { in: authConfigs.map(authConfig => authConfig.oid) }
              : undefined
          },
          include
        })
      )
    );
  }

  async listServerAuthConfigEventsGlobal(d: {
    serverAuthConfigIds?: string[];
    types?: string[];
  }) {
    let authConfigs = d.serverAuthConfigIds?.length
      ? await db.serverAuthConfig.findMany({
          where: {
            id: { in: d.serverAuthConfigIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.serverAuthConfigEvent.findMany({
          ...opts,
          where: {
            serverAuthConfigOid: authConfigs
              ? { in: authConfigs.map(authConfig => authConfig.oid) }
              : undefined,
            type: d.types?.length ? { in: d.types } : undefined
          },
          include
        })
      )
    );
  }

  async getServerAuthConfigEventById(d: { tenant: Tenant; serverAuthConfigEventId: string }) {
    let event = await db.serverAuthConfigEvent.findFirst({
      where: {
        id: d.serverAuthConfigEventId,
        serverAuthConfig: {
          tenantOid: d.tenant.oid
        }
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('server_auth_config_event'));
    return event;
  }

  async DANGEROUSLY_getServerAuthConfigEventById(d: { serverAuthConfigEventId: string }) {
    let event = await db.serverAuthConfigEvent.findFirst({
      where: {
        id: d.serverAuthConfigEventId
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('server_auth_config_event'));
    return event;
  }
}

export let serverAuthConfigEventService = Service.create(
  'serverAuthConfigEventService',
  () => new serverAuthConfigEventServiceImpl()
).build();
