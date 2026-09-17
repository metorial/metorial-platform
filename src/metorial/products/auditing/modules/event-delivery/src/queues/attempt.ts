import { safeFetch } from '@lowerdeck/ssrf';
import { db, ID, withTransaction } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { resolveSystemEventDeliveryPayload } from '../lib/payload';
import {
  calculateRetryDelaySeconds,
  isRetryableStatusCode,
  parseRetryAfterSeconds
} from '../lib/retry';
import { generateSignature } from '../lib/signature';
import { assertDeliveryUrlAllowed, DeliveryUrlNotAllowedError } from '../lib/url';

export let DELIVERY_TIMEOUT_MS = 20_000;
export let MAX_STORED_RESPONSE_BODY_BYTES = 16_384;

export let attemptDeliveryQueue = createQueue<{ intentId: string; attemptNumber: number }>({
  name: 'auditing/eventDelivery/attempt',
  workerOpts: { concurrency: 20 }
});

let eventDeliveryIntentInclude = {
  systemEvent: true,
  eventDestination: { include: { webhookDestination: true } },
  organization: true,
  instance: true
} as const;

let buildEventBody = (
  event: {
    id: string;
    source: string;
    eventType: string;
    callbackId: string | null;
    callbackTriggerKey: string | null;
    chatEventId: string | null;
    chatConnectionId: string | null;
    providerId: string | null;
    createdAt: Date;
  },
  d: { organizationId: string; instanceId: string | null; payload: Record<string, any> | null }
) => ({
  object: 'event',

  id: event.id,
  source: event.source,
  event_type: event.eventType,

  compartments: [
    d.instanceId
      ? {
          type: 'instance',
          organization_id: d.organizationId,
          instance_id: d.instanceId
        }
      : {
          type: 'organization',
          organization_id: d.organizationId
        }
  ],

  callback_id: event.callbackId,
  callback_trigger_key: event.callbackTriggerKey,

  chat_event_id: event.chatEventId,
  chat_connection_id: event.chatConnectionId,

  occurred_at: event.createdAt.toISOString(),

  payload: d.payload
});

let readResponseBody = async (response: Response) => {
  let body = await response.text();
  if (body.length <= MAX_STORED_RESPONSE_BODY_BYTES) {
    return { body, isBodyTruncated: false };
  }

  return { body: body.slice(0, MAX_STORED_RESPONSE_BODY_BYTES), isBodyTruncated: true };
};

let headerEntries = (headers: Headers | Record<string, string>) =>
  (headers instanceof Headers ? [...headers.entries()] : Object.entries(headers)).map(
    ([key, value]) => ({ key, value })
  );

export let attemptDeliveryQueueProcessor = attemptDeliveryQueue.process(async data => {
  let intent = await db.eventDeliveryIntent.findUnique({
    where: { id: data.intentId },
    include: eventDeliveryIntentInclude
  });
  if (!intent) throw new QueueRetryError();

  if (
    intent.status == 'delivered' ||
    intent.status == 'failed' ||
    intent.status == 'cancelled'
  ) {
    return;
  }

  if (intent.attemptCount >= data.attemptNumber) return;

  if (intent.eventDestination.status != 'active') {
    await db.eventDeliveryIntent.update({
      where: { oid: intent.oid },
      data: {
        status: 'cancelled',
        errorCode: 'destination_archived',
        errorMessage: 'The event destination was archived before this delivery completed',
        nextAttemptAt: null,
        completedAt: new Date()
      }
    });
    return;
  }

  let organization = intent.organization;
  let instance = intent.instance;
  let webhook = intent.eventDestination.webhookDestination;

  let attemptNumber = data.attemptNumber;
  let startedAt = new Date();

  let status: 'succeeded' | 'failed' = 'failed';
  let isRetryable = false;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let responseStatusCode: number | null = null;
  let retryAfterSeconds: number | null = null;
  let details: PrismaJson.EventDeliveryAttemptDetails | null = null;

  if (intent.type != 'webhook' || !webhook) {
    errorCode = 'destination_unavailable';
    errorMessage = 'The event destination has no deliverable target configured';
  } else {
    let payload = await resolveSystemEventDeliveryPayload(intent.systemEvent);
    let body = JSON.stringify(
      buildEventBody(intent.systemEvent, {
        organizationId: organization.id,
        instanceId: instance?.id ?? null,
        payload
      })
    );

    let { timestamp, signature } = await generateSignature({
      body,
      signingSecret: webhook.signingSecret
    });

    let requestHeaders: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'Metorial (https://metorial.com)',
      accept: '*/*',
      'metorial-event-id': intent.systemEvent.id,
      'metorial-event-type': intent.systemEvent.eventType,
      'metorial-delivery-id': intent.id,
      'metorial-delivery-attempt': String(attemptNumber),
      'metorial-destination-id': intent.eventDestination.id,
      'metorial-signature': signature,
      'metorial-timestamp': String(timestamp)
    };

    details = {
      request: {
        url: webhook.url,
        method: webhook.method,
        headers: headerEntries(requestHeaders),
        body
      },
      response: null
    };

    try {
      assertDeliveryUrlAllowed(webhook.url);

      let response = await safeFetch(webhook.url, {
        method: webhook.method,
        headers: requestHeaders,
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
      });

      let { body: responseBody, isBodyTruncated } = await readResponseBody(response);

      responseStatusCode = response.status;
      details.response = {
        statusCode: response.status,
        headers: headerEntries(response.headers),
        body: responseBody,
        isBodyTruncated
      };

      if (response.status >= 200 && response.status < 300) {
        status = 'succeeded';
      } else {
        errorCode = `http_${response.status}`;
        errorMessage = `Destination responded with HTTP ${response.status}`;
        isRetryable = isRetryableStatusCode(response.status);
        retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('retry-after'));
      }
    } catch (error: any) {
      if (error instanceof DeliveryUrlNotAllowedError) {
        errorCode = 'url_not_allowed';
        errorMessage = error.message;
      } else if (error?.name == 'TimeoutError' || error?.name == 'AbortError') {
        errorCode = 'timeout';
        errorMessage = `Destination did not respond within ${DELIVERY_TIMEOUT_MS}ms`;
        isRetryable = true;
      } else {
        errorCode = 'request_failed';
        errorMessage = error?.message ?? 'Request failed';
        isRetryable = true;
      }
    }
  }

  let completedAt = new Date();
  let durationMs = completedAt.getTime() - startedAt.getTime();

  let hasAttemptsLeft = attemptNumber < intent.retryMaxAttempts;
  let willRetry = status == 'failed' && isRetryable && hasAttemptsLeft;

  let delaySeconds = willRetry
    ? calculateRetryDelaySeconds({
        policy: intent,
        attemptNumber,
        retryAfterSeconds
      })
    : null;

  let nextAttemptAt = delaySeconds != null ? new Date(Date.now() + delaySeconds * 1000) : null;

  await withTransaction(async db => {
    await db.eventDeliveryAttempt.create({
      data: {
        id: await ID.generateId('eventDeliveryAttempt'),
        status,
        attemptNumber,
        durationMs,
        isRetryable,
        errorCode,
        errorMessage,
        responseStatusCode,
        intentOid: intent.oid,
        organizationOid: intent.organizationOid,
        detailsJson: details ?? undefined,
        startedAt,
        completedAt
      }
    });

    await db.eventDeliveryIntent.update({
      where: { oid: intent.oid },
      data: {
        status: status == 'succeeded' ? 'delivered' : willRetry ? 'retrying' : 'failed',
        attemptCount: attemptNumber,
        errorCode,
        errorMessage,
        lastAttemptAt: completedAt,
        nextAttemptAt,
        completedAt: willRetry ? null : completedAt
      }
    });
  });

  if (!willRetry) return;

  await attemptDeliveryQueue.add(
    { intentId: intent.id, attemptNumber: attemptNumber + 1 },
    {
      delay: delaySeconds! * 1000,
      id: `event-delivery-attempt:${intent.id}:${attemptNumber + 1}`
    }
  );
});
