import { Service } from '@lowerdeck/service';
import {
  Prisma,
  type TriggerEventInvocationStatus,
  type TriggerRawEventSource
} from '@mtsrc/slates-hub-db/client';
import { db } from '@mtsrc/slates-hub-db/db';
import { getId } from '@mtsrc/slates-hub-db/id';
import { retryOnOidCollision } from '@mtsrc/slates-hub-db/retryOnOidCollision';
import { TRIGGER_DISPATCH_RECHECK_DELAY_MS } from '../queues/trigger/_config';

class triggerEventServiceInternalImpl {
  async upsertPending(d: {
    triggerRegistrationInstanceOid: bigint;
    rawEventOid: bigint;
    webhookEventOid: bigint | null;
    triggerId: string;
    source: TriggerRawEventSource;
  }) {
    return retryOnOidCollision(async () =>
      db.triggerEvent.upsert({
        where: {
          rawEventOid_triggerId: { rawEventOid: d.rawEventOid, triggerId: d.triggerId }
        },
        create: {
          ...getId('triggerEvent'),
          status: 'pending',
          triggerRegistrationInstanceOid: d.triggerRegistrationInstanceOid,
          rawEventOid: d.rawEventOid,
          webhookEventOid: d.webhookEventOid,
          triggerId: d.triggerId,
          source: d.source
        },
        update: {}
      })
    );
  }

  async recordInvocation(d: {
    eventOid: bigint;
    attempt: number;
    invocationOid: bigint;
    status: TriggerEventInvocationStatus;
    errorCode?: string;
    errorMessage?: string;
  }) {
    await db.triggerEventInvocation.create({
      data: {
        ...getId('triggerEventInvocation'),
        triggerEventOid: d.eventOid,
        attempt: d.attempt,
        invocationOid: d.invocationOid,
        status: d.status,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage
      }
    });
  }

  async resolveMapped(d: {
    eventOid: bigint;
    rawEventOid: bigint;
    attempt: number;
    payload: SlatesHubPrismaJson.AnyRecord;
    mappedType: string;
    mappedId: string;
    attributes: SlatesHubPrismaJson.TriggerEventAttributes | null;
  }) {
    return db.$transaction(async tx => {
      let changed = await tx.triggerEvent.updateMany({
        where: { oid: d.eventOid, status: { in: ['pending', 'mapping_failed'] } },
        data: {
          status: 'mapped',
          attemptCount: d.attempt,
          payload: d.payload,
          mappedType: d.mappedType,
          mappedId: d.mappedId,
          attributes: d.attributes ?? Prisma.DbNull,
          errorCode: null,
          errorMessage: null
        }
      });
      if (!changed.count) return { accepted: false, rawEvent: null };
      let rawEvent = await tx.triggerRawEvent.update({
        where: { oid: d.rawEventOid },
        data: { pendingTriggerMapCount: { decrement: 1 } }
      });
      // The caller enqueues the delivery right after this commits, so the scanner looks later.
      await tx.triggerEventDispatch.upsert({
        where: { eventOid: d.eventOid },
        create: {
          eventOid: d.eventOid,
          nextAttemptAt: new Date(Date.now() + TRIGGER_DISPATCH_RECHECK_DELAY_MS)
        },
        update: {}
      });
      return { accepted: true, rawEvent };
    });
  }

  async resolveRetryableFailure(d: {
    eventOid: bigint;
    attempt: number;
    errorCode: string;
    errorMessage: string;
  }) {
    await db.triggerEvent.updateMany({
      where: {
        oid: d.eventOid,
        status: { in: ['pending', 'mapping_failed'] },
        attemptCount: { lte: d.attempt }
      },
      data: {
        status: 'mapping_failed',
        attemptCount: d.attempt,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage
      }
    });
  }

  async resolveFinalFailure(d: {
    eventOid: bigint;
    attempt: number;
    errorCode: string;
    errorMessage: string;
  }) {
    await db.triggerEvent.updateMany({
      where: {
        oid: d.eventOid,
        status: { in: ['pending', 'mapping_failed'] },
        attemptCount: { lte: d.attempt }
      },
      data: {
        status: 'mapping_failed_final',
        attemptCount: d.attempt,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage
      }
    });
  }
}

export let triggerEventServiceInternal = Service.create(
  'triggerEventServiceInternal',
  () => new triggerEventServiceInternalImpl()
).build();
