import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  receiver: true,
  receiverTrigger: true,
  action: true,
  event: true
};

class slateTriggerEventInputServiceImpl {
  async listTriggerEventInputs(d: {
    tenant: Tenant;
    receiverIds?: string[];
    statuses?: string[];
  }) {
    let receivers = d.receiverIds
      ? await db.slateTriggerReceiver.findMany({
          where: { id: { in: d.receiverIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateTriggerEventInput.findMany({
            ...opts,
            where: {
              receiver: { tenantOid: d.tenant.oid },
              receiverOid: receivers ? { in: receivers.map(r => r.oid) } : undefined,
              status: d.statuses ? { in: d.statuses as any } : undefined
            },
            include
          })
      )
    );
  }
}

export let slateTriggerEventInputService = Service.create(
  'slateTriggerEventInputService',
  () => new slateTriggerEventInputServiceImpl()
).build();
