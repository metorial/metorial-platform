import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../../prisma/generated/client';
import { db } from '../../db';

let include = {
  serverOAuthSetup: true
};

class serverOAuthSetupEventServiceImpl {
  async listServerOAuthSetupEvents(d: { tenant: Tenant; serverOAuthSetupIds?: string[] }) {
    let setups = d.serverOAuthSetupIds?.length
      ? await db.serverOAuthSetup.findMany({
          where: {
            tenantOid: d.tenant.oid,
            id: { in: d.serverOAuthSetupIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.serverOAuthSetupEvent.findMany({
          ...opts,
          where: {
            serverOAuthSetup: {
              tenantOid: d.tenant.oid
            },
            serverOAuthSetupOid: setups ? { in: setups.map(setup => setup.oid) } : undefined
          },
          include
        })
      )
    );
  }

  async listServerOAuthSetupEventsGlobal(d: { serverOAuthSetupIds?: string[]; types?: string[] }) {
    let setups = d.serverOAuthSetupIds?.length
      ? await db.serverOAuthSetup.findMany({
          where: {
            id: { in: d.serverOAuthSetupIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        await db.serverOAuthSetupEvent.findMany({
          ...opts,
          where: {
            serverOAuthSetupOid: setups ? { in: setups.map(setup => setup.oid) } : undefined,
            type: d.types?.length ? { in: d.types } : undefined
          },
          include
        })
      )
    );
  }

  async DANGEROUSLY_getServerOAuthSetupEventById(d: { serverOAuthSetupEventId: string }) {
    let event = await db.serverOAuthSetupEvent.findFirst({
      where: {
        id: d.serverOAuthSetupEventId
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('server_oauth_setup_event'));
    return event;
  }
}

export let serverOAuthSetupEventService = Service.create(
  'serverOAuthSetupEventService',
  () => new serverOAuthSetupEventServiceImpl()
).build();
