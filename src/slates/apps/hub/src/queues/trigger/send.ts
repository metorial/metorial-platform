import { QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { slateTriggerReceiverService } from '../../services/slateTriggerReceiver';
import { slateTriggerEventSendQueue } from './eventQueues';
import { slateTriggerWebhookDispatchOutboxQueue } from './eventQueues';
import {
  WEBHOOK_OUTBOX_LEASE_MS,
  slateTriggerWebhookReplayService
} from '../../services/slateTriggerWebhookReplay';
import { randomUUID } from 'node:crypto';

let Sentry = getSentry();

export let WEBHOOK_OUTBOX_HEARTBEAT_INTERVAL_MS = Math.max(
  1000,
  Math.min(10_000, Math.floor(WEBHOOK_OUTBOX_LEASE_MS / 3))
);

export let runWithWebhookOutboxLeaseHeartbeat = async <T>(d: {
  renew: () => Promise<boolean>;
  run: (lease: { stopBeforeLeaseRelease: () => Promise<void> }) => Promise<T>;
  intervalMs?: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}) => {
  let leaseLost = false;
  let active = true;
  let intervalCleared = false;
  let renewalInFlight: Promise<void> | null = null;
  let interval = (d.setIntervalFn ?? setInterval)(async () => {
    if (!active || renewalInFlight || leaseLost) return;
    renewalInFlight = (async () => {
      try {
        if (!(await d.renew())) leaseLost = true;
      } catch {
        leaseLost = true;
      }
    })();
    try {
      await renewalInFlight;
    } finally {
      renewalInFlight = null;
    }
  }, d.intervalMs ?? WEBHOOK_OUTBOX_HEARTBEAT_INTERVAL_MS);
  if (typeof interval === 'object' && 'unref' in interval) interval.unref();
  let clearHeartbeat = () => {
    if (intervalCleared) return;
    intervalCleared = true;
    (d.clearIntervalFn ?? clearInterval)(interval);
  };
  let stopBeforeLeaseRelease = async () => {
    active = false;
    clearHeartbeat();
    if (renewalInFlight) await renewalInFlight;
    if (leaseLost) {
      throw new Error('Webhook outbox lease ownership was lost during dispatch');
    }
  };
  let result: T;
  try {
    result = await d.run({ stopBeforeLeaseRelease });
  } finally {
    active = false;
    clearHeartbeat();
    if (renewalInFlight) await renewalInFlight;
  }
  return { result, leaseLost };
};

export let slateTriggerEventSendQueueProcessor = slateTriggerEventSendQueue.process(
  async data => {
    let event = await db.slateTriggerEvent.findFirst({
      where: { id: data.eventId },
      select: { id: true }
    });
    if (!event) return;

    try {
      await slateTriggerReceiverService.sendTriggerEvent({ eventId: event.id });
    } catch (error) {
      Sentry.captureException(error, {
        extra: { eventId: data.eventId }
      });
      console.error('Failed to send trigger event:', error);
      throw new QueueRetryError();
    }
  }
);

export let slateTriggerWebhookDispatchOutboxQueueProcessor =
  slateTriggerWebhookDispatchOutboxQueue.process(async data => {
    let owner = `hub-outbox:${randomUUID()}`;
    let outbox = await slateTriggerWebhookReplayService.claimOutbox({
      outboxId: data.outboxId,
      owner
    });
    if (!outbox) return;
    try {
      let dispatched = await runWithWebhookOutboxLeaseHeartbeat({
        renew: async () =>
          await slateTriggerWebhookReplayService.renewLease({
            outboxId: outbox.id,
            owner
          }),
        run: async lease =>
          await slateTriggerWebhookReplayService.dispatchLeased({
            outboxId: outbox.id,
            owner,
            beforeLeaseRelease: lease.stopBeforeLeaseRelease
          })
      });
      if (dispatched.leaseLost) {
        throw new Error('Webhook outbox lease ownership was lost during dispatch');
      }
    } catch (error) {
      Sentry.captureException(error, { extra: { outboxId: outbox.id } });
      await slateTriggerWebhookReplayService.retryLeased({
        outboxId: outbox.id,
        owner,
        safeCode: 'signal_transport'
      });
      throw new QueueRetryError();
    }
  });
