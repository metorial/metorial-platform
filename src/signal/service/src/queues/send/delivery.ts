import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import axios from 'axios';
import type { EventDeliveryAttemptStatus } from '../../../prisma/generated/enums';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { calculateRetryDelaySeconds } from '../../lib/retry';
import { generateSignature } from '../../lib/signature';
import { getAxiosSsrfFilter } from '../../lib/ssrf';
import { storageKey } from '../../lib/storageKey';
import { buildWebhookDeliveryHeaders } from '../../lib/webhookDeliveryHeaders';
import { storage } from '../../storage';
import { buildEventDestinationDeliveryCompatibilityWhere } from './destinationRouting';
import { intentFailedQueue, intentSucceededQueue } from './intent';
import { enqueueDeliveryAttempt } from './deliveryRetry';

export let createDeliveryQueue = createQueue<{
  eventId: string;
  destinationId: string;
}>({
  name: 'sgnl/event/del',
  redisUrl: env.service.REDIS_URL
});

export let createDeliveryQueueProcessor = createDeliveryQueue.process(async data => {
  let event = await db.event.findFirst({
    where: { id: data.eventId }
  });
  if (!event) throw new QueueRetryError();

  let destination = await db.eventDestination.findFirst({
    where: {
      id: data.destinationId,
      tenantOid: event.tenantOid,
      AND: [buildEventDestinationDeliveryCompatibilityWhere(event)]
    }
  });
  if (!destination) throw new QueueRetryError();

  let intent = await db.eventDeliveryIntent.upsert({
    where: {
      eventOid_destinationOid: {
        eventOid: event.oid,
        destinationOid: destination.oid
      }
    },
    create: {
      ...getId('eventDeliveryIntent'),
      status: 'pending',
      eventOid: event.oid,
      destinationOid: destination.oid,
      nextAttemptAt: new Date()
    },
    update: {}
  });

  await enqueueDeliveryAttempt({
    enqueue: attemptDeliveryQueue.add,
    intentId: intent.id,
    attemptNumber: intent.attemptCount + 1
  });
});

export let attemptDeliveryQueue = createQueue<{
  intentId: string;
}>({
  name: 'sgnl/event/att',
  redisUrl: env.service.REDIS_URL
});

export let attemptDeliveryQueueProcessor = attemptDeliveryQueue.process(async data => {
  let intent = await db.eventDeliveryIntent.findFirst({
    where: { id: data.intentId },
    include: {
      event: {
        include: {
          sender: true
        }
      },
      destination: {
        include: {
          currentInstance: {
            include: {
              webhook: true
            }
          }
        }
      }
    }
  });
  if (!intent) throw new QueueRetryError();
  if (intent.status === 'delivered' || intent.status === 'failed') return;

  let instance = intent.destination.currentInstance;
  let event = intent.event;

  if (!instance?.webhook) {
    await intentFailedQueue.add(
      {
        intentId: intent.id,
        errorCode: 'no_destination',
        errorMessage: 'No active destination instance found'
      },
      { id: intent.id }
    );
    return;
  }

  let finalizeAttempt = async (attempt: {
    attemptNumber: number;
    status: EventDeliveryAttemptStatus;
    errorCode: string | null;
    errorMessage: string | null;
  }) => {
    if (attempt.status === 'succeeded') {
      await intentSucceededQueue.add(
        { intentId: intent.id, attemptCount: attempt.attemptNumber },
        { id: intent.id }
      );
      return;
    }

    if (attempt.attemptNumber >= intent.destination.retryMaxAttempts) {
      await intentFailedQueue.add(
        {
          intentId: intent.id,
          errorCode: attempt.errorCode ?? 'delivery_failed',
          errorMessage: attempt.errorMessage ?? 'Webhook delivery failed',
          attemptCount: attempt.attemptNumber
        },
        { id: intent.id }
      );
      return;
    }

    let delaySeconds = calculateRetryDelaySeconds({
      baseDelaySeconds: intent.destination.retryDelaySeconds,
      attemptNumber: attempt.attemptNumber,
      retryType: intent.destination.retryType
    });
    let nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

    await db.eventDeliveryIntent.updateMany({
      where: { id: intent.id, status: { notIn: ['delivered', 'failed'] } },
      data: {
        status: 'retrying',
        attemptCount: attempt.attemptNumber,
        nextAttemptAt
      }
    });

    await enqueueDeliveryAttempt({
      enqueue: attemptDeliveryQueue.add,
      intentId: intent.id,
      attemptNumber: attempt.attemptNumber + 1,
      delayMs: delaySeconds * 1000
    });
  };

  let attemptNumber = intent.attemptCount + 1;
  let existingAttempt = await db.eventDeliveryAttempt.findUnique({
    where: {
      intentOid_attemptNumber: {
        intentOid: intent.oid,
        attemptNumber
      }
    }
  });
  if (existingAttempt) {
    await finalizeAttempt(existingAttempt);
    return;
  }

  let status: EventDeliveryAttemptStatus = 'failed';
  let requestErrorCode: string | null = null;
  let requestErrorMessage: string | null = null;
  let responseStatusCode = -1;
  let responseBody: string | null = null;
  let responseHeaders: [string, string][] = [];

  let body = intent.event.payloadJson!;
  let signature = await generateSignature(body, instance.webhook.signingSecret);

  let start = Date.now();

  try {
    let res = await axios.post(instance.webhook.url, body, {
      ...getAxiosSsrfFilter(instance.webhook.url),
      responseType: 'text',
      timeout: 10000,
      validateStatus: () => true,
      maxRedirects: 5,
      headers: buildWebhookDeliveryHeaders({
        eventHeaders: event.headers as [string, string][],
        webhookId: instance.webhook.id,
        notificationId: intent.id,
        eventId: event.id,
        signature,
        attemptNumber: intent.attemptCount + 1,
        sender: `${event.sender.name} (${event.sender.id})`
      })
    });

    status = res.status >= 200 && res.status < 300 ? 'succeeded' : 'failed';
    responseStatusCode = res.status;
    responseBody = String(res.data).slice(0, 10_000);
    responseHeaders = Object.entries(res.headers);
    if (status === 'failed') {
      requestErrorCode = 'http_error';
      requestErrorMessage = `Destination responded with HTTP status ${res.status}`;
    }
  } catch (e: any) {
    status = 'failed';
    requestErrorCode = 'request_error';
    requestErrorMessage = e.message;
  }

  let end = Date.now();
  let durationMs = end - start;

  let attempt = await db.eventDeliveryAttempt.create({
    data: {
      ...getId('eventDeliveryAttempt'),
      status,
      intentOid: intent.oid,
      destinationInstanceOid: instance.oid,
      attemptNumber,
      responseStatusCode: responseStatusCode,
      durationMs,
      errorCode: requestErrorCode,
      errorMessage: requestErrorMessage
    }
  });

  await storage.putObject(
    env.storage.LOGS_BUCKET_NAME,
    storageKey.attempt(attempt),
    JSON.stringify({
      body: responseBody,
      headers: responseHeaders
    })
  );

  await finalizeAttempt(attempt);
});
