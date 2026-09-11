import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  SlateWebhookEventInvocationStatus,
  SlateWebhookRegistration
} from '../../prisma/generated/client';
import { Prisma } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

let include = {
  webhookRegistration: {
    include: {
      slate: true,
      triggerGroup: true,
      tenant: true,
      triggerWebhookTarget: true
    }
  }
};

class slateWebhookEventServiceInternalImpl {
  async createPendingEvent(d: {
    registration: Pick<SlateWebhookRegistration, 'oid'>;
    request: PrismaJson.SlateWebhookEventRequest;
  }) {
    return db.slateWebhookEvent.create({
      data: {
        ...getId('slateWebhookEvent'),
        status: 'pending',
        attemptCount: 0,
        webhookRegistrationOid: d.registration.oid,
        request: d.request
      },
      include
    });
  }

  async getById(d: { id: string }) {
    let event = await db.slateWebhookEvent.findUnique({ where: { id: d.id }, include });
    if (!event) throw new ServiceError(notFoundError('slate.webhook_event'));
    return event;
  }

  async beginAttempt(d: { eventOid: bigint }) {
    let event = await db.slateWebhookEvent.update({
      where: { oid: d.eventOid },
      data: { attemptCount: { increment: 1 } }
    });
    return event.attemptCount;
  }

  async recordInvocation(d: {
    eventOid: bigint;
    attempt: number;
    invocationOid: bigint;
    status: SlateWebhookEventInvocationStatus;
    errorCode?: string;
    errorMessage?: string;
  }) {
    await db.slateWebhookEventInvocation.create({
      data: {
        ...getId('slateWebhookEventInvocation'),
        webhookEventOid: d.eventOid,
        attempt: d.attempt,
        invocationOid: d.invocationOid,
        status: d.status,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage
      }
    });
  }

  async resolveRetryableFailure(d: { eventOid: bigint; isFinalAttempt: boolean }) {
    await db.slateWebhookEvent.update({
      where: { oid: d.eventOid },
      data: { status: d.isFinalAttempt ? 'failed_final' : 'failed_retrying' }
    });
  }

  async resolveNonRetryableFailure(d: { eventOid: bigint }) {
    await db.slateWebhookEvent.update({
      where: { oid: d.eventOid },
      data: { status: 'failed_final' }
    });
  }

  async resolveSuccess(d: { eventOid: bigint }) {
    await db.slateWebhookEvent.update({
      where: { oid: d.eventOid },
      data: { status: 'succeeded' }
    });
  }

  async setSlateResponse(d: {
    eventOid: bigint;
    response: PrismaJson.SlatesWebhookHttpResponse | null;
  }) {
    await db.slateWebhookEvent.update({
      where: { oid: d.eventOid },
      data: { slateResponse: d.response ?? Prisma.DbNull }
    });
  }

  async trySetResponseOverride(d: {
    eventOid: bigint;
    override: PrismaJson.SlateWebhookEventResponseOverride;
  }) {
    let res = await db.slateWebhookEvent.updateMany({
      // First writer wins
      where: { oid: d.eventOid, responseOverride: { equals: Prisma.DbNull } },
      data: { responseOverride: d.override }
    });
    return res.count > 0;
  }
}

export let slateWebhookEventServiceInternal = Service.create(
  'slateWebhookEventServiceInternal',
  () => new slateWebhookEventServiceInternalImpl()
).build();
