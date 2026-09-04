import { Service } from '@lowerdeck/service';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';
import { startOfHour } from 'date-fns';
import type {
  SlateWebhookRegistration,
  TriggerRoutingDropReason
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

class TriggerRoutingDropServiceInternalImpl {
  async recordDrop(d: {
    webhookRegistration: Pick<
      SlateWebhookRegistration,
      'oid' | 'tenantOid' | 'triggerGroupOid'
    >;
    reason: TriggerRoutingDropReason;
    count: number;
    lastMatchers?: SlatesTriggerRoutingMatcher[] | null;
  }) {
    if (d.count <= 0) return;

    let where = {
      webhookRegistrationOid_reason_bucketStart: {
        webhookRegistrationOid: d.webhookRegistration.oid,
        reason: d.reason,
        bucketStart: startOfHour(new Date())
      }
    };

    let update = {
      count: { increment: d.count },
      lastMatchers: d.lastMatchers ?? undefined
    };

    try {
      await db.triggerRoutingDrop.upsert({
        where,
        create: {
          ...getId('triggerRoutingDrop'),
          ...where.webhookRegistrationOid_reason_bucketStart,
          tenantOid: d.webhookRegistration.tenantOid,
          triggerGroupOid: d.webhookRegistration.triggerGroupOid,
          count: d.count,
          lastMatchers: d.lastMatchers ?? undefined
        },
        update
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err;
      await db.triggerRoutingDrop.update({ where, data: update });
    }
  }
}

export let triggerRoutingDropServiceInternal = Service.create(
  'triggerRoutingDropServiceInternal',
  () => new TriggerRoutingDropServiceInternalImpl()
).build();
