import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/browser';
import { db } from '../db';

let include = {};

class slateInstanceEventServiceImpl {
  async getSlateInstanceEventById(d: { tenant: Tenant; id: string }) {
    let slateInstanceEvent = await db.slateInstanceEvent.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slateInstanceEvent) throw new ServiceError(notFoundError('slate.instance.event'));
    return slateInstanceEvent;
  }

  async listSlateInstanceEvents(d: { tenant: Tenant; slateInstanceIds?: string[] }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateInstanceEvent.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,

              instanceOid: slateInstances
                ? { in: slateInstances.map(si => si.oid) }
                : undefined
            },
            include
          })
      )
    );
  }

  async getManySlateInstanceEventsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateInstanceEvent.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateInstanceEventService = Service.create(
  'slateInstanceEventService',
  () => new slateInstanceEventServiceImpl()
).build();
