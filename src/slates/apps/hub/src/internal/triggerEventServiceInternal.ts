import { Service } from '@lowerdeck/service';
import type {
  TriggerEventInvocationStatus,
  TriggerRawEventSource
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { retryOnOidCollision } from '../lib/retryOnOidCollision';

class triggerEventServiceInternalImpl {
  async upsertPending(d: {
    triggerRegistrationInstanceOid: bigint;
    rawEventOid: bigint;
    webhookEventOid: bigint | null;
    triggerId: string;
    source: TriggerRawEventSource;
  }) {
    return retryOnOidCollision(() =>
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
    attempt: number;
    payload: PrismaJson.AnyRecord;
    mappedType: string;
    mappedId: string;
  }) {
    await db.triggerEvent.update({
      where: { oid: d.eventOid },
      data: {
        status: 'mapped',
        attemptCount: d.attempt,
        payload: d.payload,
        mappedType: d.mappedType,
        mappedId: d.mappedId,
        errorCode: null,
        errorMessage: null
      }
    });
  }

  async resolveRetryableFailure(d: {
    eventOid: bigint;
    attempt: number;
    errorCode: string;
    errorMessage: string;
  }) {
    await db.triggerEvent.update({
      where: { oid: d.eventOid },
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
    await db.triggerEvent.update({
      where: { oid: d.eventOid },
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
