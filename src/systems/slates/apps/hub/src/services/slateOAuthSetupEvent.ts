import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  setup: true,
  invocation: {
    include: {
      slateInvocationAttachment: {
        include: {
          attachments: true
        }
      }
    }
  }
};

class slateOAuthSetupEventServiceImpl {
  async listSlateOAuthSetupEvents(d: { tenant: Tenant; slateOAuthSetupIds?: string[] }) {
    let setups = d.slateOAuthSetupIds?.length
      ? await db.slateInstanceOAuthSetup.findMany({
          where: {
            tenantOid: d.tenant.oid,
            id: { in: d.slateOAuthSetupIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.slateInstanceOAuthSetupEvent.findMany({
          ...opts,
          where: {
            id: { not: null },
            setup: {
              tenantOid: d.tenant.oid
            },
            setupOid: setups ? { in: setups.map(setup => setup.oid) } : undefined
          },
          include
        });

        return res.map(event => ({
          ...event,
          id: event.id!
        }));
      })
    );
  }

  async listSlateOAuthSetupEventsGlobal(d: { slateOAuthSetupIds?: string[] }) {
    let setups = d.slateOAuthSetupIds?.length
      ? await db.slateInstanceOAuthSetup.findMany({
          where: {
            id: { in: d.slateOAuthSetupIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let res = await db.slateInstanceOAuthSetupEvent.findMany({
          ...opts,
          where: {
            id: { not: null },
            setupOid: setups ? { in: setups.map(setup => setup.oid) } : undefined
          },
          include
        });

        return res.map(event => ({
          ...event,
          id: event.id!
        }));
      })
    );
  }

  async DANGEROUSLY_getSlateOAuthSetupEventById(d: { slateOAuthSetupEventId: string }) {
    let event = await db.slateInstanceOAuthSetupEvent.findFirst({
      where: {
        id: d.slateOAuthSetupEventId
      },
      include
    });
    if (!event) throw new ServiceError(notFoundError('slate_oauth_setup_event'));
    return event;
  }
}

export let slateOAuthSetupEventService = Service.create(
  'slateOAuthSetupEventService',
  () => new slateOAuthSetupEventServiceImpl()
).build();
