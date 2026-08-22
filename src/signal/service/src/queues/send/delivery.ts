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
import { storage } from '../../storage';
import { intentFailedQueue, intentSucceededQueue } from './intent';

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
      senderOid: event.senderOid
    }
  });
  if (!destination) throw new QueueRetryError();

  let intent = await db.eventDeliveryIntent.create({
    data: {
      ...getId('eventDeliveryIntent'),
      status: 'pending',
      eventOid: event.oid,
      destinationOid: destination.oid,
      nextAttemptAt: new Date()
    }
  });

  await attemptDeliveryQueue.add({ intentId: intent.id }, { id: intent.id });
});

let attemptDeliveryQueue = createQueue<{
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

  let instance = intent.destination.currentInstance;
  let event = intent.event;

  if (!instance) {
    await intentFailedQueue.add({
      intentId: intent.id,
      errorCode: 'no_destination',
      errorMessage: 'No active destination instance found'
    });
    return;
  }

  let status: EventDeliveryAttemptStatus = 'failed';
  let requestErrorCode: string | null = null;
  let requestErrorMessage: string | null = null;
  let responseStatusCode = -1;
  let responseBody: string | null = null;
  let responseHeaders: [string, string][] = [];

  let body = intent.event.payloadJson!;
  let signature = await generateSignature(body, instance.webhook!.signingSecret!);

  let start = Date.now();

  if (instance.webhook) {
    try {
      let res = await axios.post(instance.webhook.url, body, {
        ...getAxiosSsrfFilter(instance.webhook.url),
        responseType: 'text',
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 5,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Metorial (https://metorial.com)',
          'Metorial-Webhook-Id': instance.webhook.id,
          'Metorial-Notification-Id': intent.id,
          'Metorial-Event-Id': event.id,
          'Metorial-Signature': signature,
          'Metorial-Version': '2025-01-01',
          'Metorial-Delivery-Attempt': String(intent.attemptCount + 1),
          'Metorial-Sender': `${event.sender.name} (${event.sender.id})`,

          ...Object.fromEntries(event.headers as [string, string][])
        }
      });

      status = res.status >= 200 && res.status < 300 ? 'succeeded' : 'failed';
      responseStatusCode = res.status;
      responseBody = res.data.slice(0, 10_000);
      responseHeaders = Object.entries(res.headers);
    } catch (e: any) {
      status = 'failed';
      requestErrorCode = 'request_error';
      requestErrorMessage = e.message;
    }
  }

  let end = Date.now();
  let durationMs = end - start;

  let attempt = await db.eventDeliveryAttempt.create({
    data: {
      ...getId('eventDeliveryAttempt'),
      status,
      intentOid: intent.oid,
      destinationInstanceOid: instance.oid,
      attemptNumber: intent.attemptCount + 1,
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

  if (status === 'succeeded') {
    await intentSucceededQueue.add({
      intentId: intent.id,
      errorCode: requestErrorCode!,
      errorMessage: requestErrorMessage!
    });
  } else if (attempt.attemptNumber >= intent.destination.retryMaxAttempts) {
    await intentFailedQueue.add({
      intentId: intent.id,
      errorCode: requestErrorCode!,
      errorMessage: requestErrorMessage!
    });
  } else {
    const delaySeconds = calculateRetryDelaySeconds({
      baseDelaySeconds: intent.destination.retryDelaySeconds,
      attemptNumber: attempt.attemptNumber,
      retryType: intent.destination.retryType
    });

    let nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

    await db.eventDeliveryIntent.updateMany({
      where: { id: intent.id },
      data: {
        status: 'retrying',
        attemptCount: { increment: 1 },
        nextAttemptAt
      }
    });

    await attemptDeliveryQueue.add(
      { intentId: intent.id },
      { delay: delaySeconds * 1000, id: intent.id }
    );
  }
});
