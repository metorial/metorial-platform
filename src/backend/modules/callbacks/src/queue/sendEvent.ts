import { CallbackNotificationAttemptStatus, db, ID } from '@metorial/db';
import { usageService } from '@metorial/module-usage';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import axios from 'axios';
import { generateSignature } from '../lib/signature';

export let sendEventQueue = createQueue<{ eventId: string }>({
  name: 'clb/evt/snd'
});

export let sendEventQueueProcessor = sendEventQueue.process(async data => {
  let event = await db.callbackEvent.findFirst({
    where: { id: data.eventId },
    include: { callback: { include: { instance: true } } }
  });
  if (!event) throw new QueueRetryError();

  let destinations = await db.callbackDestination.findMany({
    where: {
      status: 'active',
      instanceOid: event.callback.instanceOid,
      OR: [
        { selectionType: 'all' },
        { selectionType: 'selected', callbacks: { some: { callbackOid: event.callback.oid } } }
      ]
    },
    include: { callbacks: { where: { callbackOid: event.callback.oid } } }
  });

  await usageService.ingestUsageRecord({
    owner: {
      id: event.callback.instance.id,
      type: 'instance'
    },
    entity: {
      id: event.callback.id,
      type: 'callback'
    },
    type: 'callback.event.created'
  });

  // Either selected connections or ones that are linked to the callback anyway
  let selectedDestinationIds = new Set(
    destinations
      .filter(d => d.selectionType == 'selected' || d.callbacks.length > 0)
      .map(d => d.id)
  );

  let nonSelectedDestinations = destinations.filter(d => !selectedDestinationIds.has(d.id));

  // We also want to have links for destinations of selectionType `all`
  for (let nonSelectedDestination of nonSelectedDestinations) {
    await db.callbackDestinationCallback.create({
      data: {
        isSelected: false,
        callbackOid: event.callback.oid,
        destinationOid: nonSelectedDestination.oid
      }
    });
  }

  await prepareEventSingleQueue.addMany(
    Array.from(destinations).map(d => ({
      eventOid: event.oid,
      destinationOid: d.oid
    }))
  );
});

let prepareEventSingleQueue = createQueue<{ eventOid: bigint; destinationOid: bigint }>({
  name: 'clb/evt/prep'
});

export let prepareEventSingleQueueProcessor = prepareEventSingleQueue.process(async data => {
  let destination = await db.callbackDestination.findFirst({
    where: { oid: data.destinationOid }
  });
  if (!destination) throw new QueueRetryError();

  let event = await db.callbackEvent.findFirst({
    where: { oid: data.eventOid },
    include: { callback: true }
  });
  if (!event) throw new QueueRetryError();

  let notificationId = await ID.generateId('callbackNotification');
  let notification = await db.callbackNotification.create({
    data: {
      id: notificationId,
      eventOid: data.eventOid,
      destinationOid: data.destinationOid,
      status: 'pending',

      type: destination.type,

      url: destination.url,
      requestHeaders: [],
      requestBody: JSON.stringify({
        eventId: event.id,
        notificationId,
        callbackId: event.callback.id,

        object: 'callback.notification',
        type: event.eventType!,
        payload: JSON.parse(event.payloadOutgoing!)
      })
    }
  });

  await sendEventSingleQueue.add({
    notificationId: notification.id
  });
});

let sendEventSingleQueue = createQueue<{ notificationId: string }>({
  name: 'clb/evt/sngl',
  workerOpts: {
    concurrency: 50
  }
});

export let sendEventSingleQueueProcessor = sendEventSingleQueue.process(async data => {
  let notification = await db.callbackNotification.findFirst({
    where: { id: data.notificationId },
    include: { destination: true, event: { include: { callback: true } } }
  });
  if (!notification) throw new QueueRetryError();

  let status: CallbackNotificationAttemptStatus;
  let requestError: string | null = null;
  let responseStatusCode = -1;
  let responseBody: string | null = null;
  let responseHeaders: PrismaJson.Headers = [];

  let start = Date.now();

  let body = notification.requestBody!;
  let signature = await generateSignature(body, notification.destination.signingSecret!);

  try {
    let res = await axios.post(notification.url!, body, {
      ...getAxiosSsrfFilter(notification.url!),
      responseType: 'text',
      timeout: 10000,
      validateStatus: () => true,
      maxRedirects: 5,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Metorial Callbacks (https://metorial.com)',
        'Metorial-Notification-Id': notification.id,
        'Metorial-Event-Id': notification.event.id,
        'Metorial-Callback-Id': notification.event.callback.id,
        'Metorial-Signature': signature,
        'Metorial-Version': '2025-01-01'
      }
    });

    status = res.status >= 200 && res.status < 300 ? 'succeeded' : 'failed';
    responseStatusCode = res.status;
    responseBody = res.data;
    responseHeaders = Object.entries(res.headers);
  } catch (e: any) {
    status = 'failed';
    requestError = e.message;
  }

  let duration = Date.now() - start;
  let fullStatus =
    status == 'failed' && notification.attemptCount < 20 ? ('retrying' as const) : status;

  await db.callbackNotification.updateMany({
    where: { id: notification.id },
    data: {
      status: fullStatus,
      attemptCount: { increment: 1 }
    }
  });

  await db.callbackNotificationAttempt.create({
    data: {
      id: await ID.generateId('callbackNotificationAttempt'),
      notificationOid: notification.oid,
      attemptIndex: notification.attemptCount,
      status,
      responseStatusCode,
      responseHeaders,
      responseBody,
      requestError,
      durationMs: duration
    }
  });

  if (fullStatus == 'retrying') {
    await sendEventSingleQueue.add(
      {
        notificationId: notification.id
      },
      {
        delay: Math.min(1000 * 60 * 30, 1000 * 2 ** notification.attemptCount)
      }
    );
  }
});
