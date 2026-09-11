import {
  createError,
  goneError,
  isServiceError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import type { SlateWebhookRegistration } from '../../prisma/generated/client';
import { env } from '../env';
import { slateWebhookEventServiceInternal } from '../internal';
import { processWebhookEventQueue } from '../queues/webhook/process';
import { subscribeToWebhookEvent, waitForSignalOrTimeout } from './webhookEventBus';

export let MAX_WEBHOOK_BODY_BYTES = 2 * 1024 * 1024;
export let DEFAULT_WEBHOOK_SYNC_TIMEOUT_MS = 60_000;

export let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: `The webhook payload exceeds the ${MAX_WEBHOOK_BODY_BYTES} byte limit.`
});

export let ingestWebhookRequest = async (d: {
  registration: Pick<SlateWebhookRegistration, 'oid' | 'status'>;
  request: PrismaJson.SlateWebhookEventRequest;
}) => {
  if (d.registration.status === 'deleted') {
    throw new ServiceError(
      goneError({
        message: 'This webhook registration has been deleted and no longer accepts requests.'
      })
    );
  }

  if (d.registration.status === 'awaiting_setup') {
    throw new ServiceError(
      preconditionFailedError({
        message:
          'This webhook registration has not finished being set up yet and cannot accept requests.'
      })
    );
  }

  let event = await slateWebhookEventServiceInternal.createPendingEvent({
    registration: d.registration,
    request: d.request
  });

  let timeoutMs = env.slates.SLATES_WEBHOOK_SYNC_TIMEOUT_MS ?? DEFAULT_WEBHOOK_SYNC_TIMEOUT_MS;

  let subscription = await subscribeToWebhookEvent(event.id);
  try {
    await processWebhookEventQueue.add({ webhookEventId: event.id });
    await waitForSignalOrTimeout(subscription, timeoutMs);
  } finally {
    await subscription.close();
  }

  try {
    let final = await slateWebhookEventServiceInternal.getById({ id: event.id });

    if (!final.slateResponse && !final.responseOverride) {
      await slateWebhookEventServiceInternal.trySetResponseOverride({
        eventOid: final.oid,
        override: {
          webhookEventId: final.id,
          warning: {
            code: 'deadline_exceeded',
            message: `No response within ${timeoutMs}ms.`
          }
        }
      });
      final = await slateWebhookEventServiceInternal.getById({ id: event.id });
    }

    return { event: final, discarded: false as const };
  } catch (err) {
    if (isServiceError(err) && err.data.code === 'not_found') {
      return { event: null, discarded: true as const, eventId: event.id };
    }
    throw err;
  }
};
