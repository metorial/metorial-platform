import { createQueue } from '@lowerdeck/queue';
import { SLATES_WEBHOOK_ERROR_DEFAULTS, type SlatesWebhookErrorCode } from '@slates/proto';
import { db } from '../../db';
import { env } from '../../env';
import {
  slateWebhookEventServiceInternal,
  triggerRoutingDropServiceInternal,
  triggerRoutingMatcherServiceInternal
} from '../../internal';
import { getLatestSlateVersionSupportingTriggerGroup } from '../../lib/slateVersion';
import { publishWebhookEventResolved } from '../../lib/webhookEventBus';
import { secretService, slateInvocationService } from '../../services';
import { globalTenant } from '../../services/tenant';
import { createTriggerRawEvents } from '../trigger/_rawEvent';
import { webhookEventPayloadOffloadQueue } from './payloadOffload';

export let processWebhookEventQueue = createQueue<{ webhookEventId: string }>({
  name: 'shub/whk/process',
  redisUrl: env.service.REDIS_URL
});

export let processWebhookEventQueueProcessor = processWebhookEventQueue.process(
  async (data, job) => {
    let event = await slateWebhookEventServiceInternal.getById({ id: data.webhookEventId });
    let registration = event.webhookRegistration;

    let attempt = await slateWebhookEventServiceInternal.beginAttempt({ eventOid: event.oid });
    let isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 25);

    let version = await getLatestSlateVersionSupportingTriggerGroup({
      slate: registration.slate,
      triggerGroup: registration.triggerGroup
    });
    let tenant = registration.tenant ?? globalTenant;

    if (event.request === null) {
      // Invariant: request is only offloaded once a webhook event reaches a terminal
      // status, and this is the only place that still processes a pending event.
      throw new Error(`Webhook event ${event.id} has no request to process`);
    }

    let webhookRegistrationPayload = await secretService.DANGEROUSLY_decryptSecret({
      secretOid: registration.secretOid,
      purpose: 'slate_webhook_registration_payload',
      tenant,
      note: `webhook-process:${event.id}:${attempt}`
    });

    let stack = await slateInvocationService.createInvocation({
      participants: [],
      slateVersion: version,
      tenant
    });

    let result = await slateInvocationService.processWebhookRequest({
      stack,
      triggerGroupId: registration.triggerGroup.key,
      url: event.request.url,
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body,
      webhookRegistrationPayload: webhookRegistrationPayload.payload
    });

    if (result.status === 'error') {
      let defaults =
        SLATES_WEBHOOK_ERROR_DEFAULTS[result.error.code as SlatesWebhookErrorCode];
      let retryable = result.error.retryable ?? defaults?.retryable ?? true;

      await slateWebhookEventServiceInternal.recordInvocation({
        eventOid: event.oid,
        attempt,
        invocationOid: result.invocation.oid,
        status: 'failed',
        errorCode: result.error.code,
        errorMessage: result.error.message
      });

      if (!retryable) {
        await slateWebhookEventServiceInternal.resolveNonRetryableFailure({
          eventOid: event.oid
        });
        await slateWebhookEventServiceInternal.trySetResponseOverride({
          eventOid: event.oid,
          override: {
            webhookEventId: event.id,
            error: {
              code: result.error.code,
              message: result.error.message,
              status: result.error.status ?? defaults?.status ?? 400
            }
          }
        });
        await publishWebhookEventResolved(event.id);
        await webhookEventPayloadOffloadQueue.add({ webhookEventId: event.id });
        return;
      }

      await slateWebhookEventServiceInternal.resolveRetryableFailure({
        eventOid: event.oid,
        isFinalAttempt
      });

      if (isFinalAttempt) {
        await slateWebhookEventServiceInternal.trySetResponseOverride({
          eventOid: event.oid,
          override: {
            webhookEventId: event.id,
            warning: {
              code: 'retries_exhausted',
              message: `Failed after ${attempt} attempts: ${result.error.message}`
            }
          }
        });
        await publishWebhookEventResolved(event.id);
        await webhookEventPayloadOffloadQueue.add({ webhookEventId: event.id });

        return;
      }

      throw new Error(`trigger_group.webhook.process failed: ${result.error.message}`);
    }

    await slateWebhookEventServiceInternal.recordInvocation({
      eventOid: event.oid,
      attempt,
      invocationOid: result.invocation.oid,
      status: 'succeeded'
    });

    await slateWebhookEventServiceInternal.setSlateResponse({
      eventOid: event.oid,
      response: result.data.response ?? null
    });

    if (!result.data.response) {
      await slateWebhookEventServiceInternal.trySetResponseOverride({
        eventOid: event.oid,
        override: { webhookEventId: event.id }
      });
    }

    await slateWebhookEventServiceInternal.resolveSuccess({ eventOid: event.oid });
    await publishWebhookEventResolved(event.id);
    await webhookEventPayloadOffloadQueue.add({ webhookEventId: event.id });

    if (result.data.events.length > 0) {
      let target = registration.triggerWebhookTarget;

      let eventsForCreation: {
        triggerRegistrationInstanceOids: bigint[];
        payload: PrismaJson.AnyRecord;
        idempotencyKey?: string | null;
        triggerIds: string[];
        matchers?: PrismaJson.TriggerRawEventMatchers | null;
      }[];

      if (target) {
        let links = await db.triggerRegistrationWebhook.findMany({
          where: {
            triggerWebhookTargetOid: target.oid,
            triggerRegistrationInstance: {
              triggerRegistration: { tenantOid: target.tenantOid }
            }
          },
          select: { triggerRegistrationInstanceOid: true }
        });

        if (links.length === 0) {
          await triggerRoutingDropServiceInternal.recordDrop({
            webhookRegistration: registration,
            reason: 'no_subscribers',
            count: result.data.events.length
          });
        }

        eventsForCreation = result.data.events.map(webhookEvent => ({
          triggerRegistrationInstanceOids: links.map(
            link => link.triggerRegistrationInstanceOid
          ),
          payload: webhookEvent.payload,
          idempotencyKey: webhookEvent.idempotencyKey,
          triggerIds: webhookEvent.triggerIds,
          matchers: webhookEvent.matchers
        }));
      } else {
        let matched = await triggerRoutingMatcherServiceInternal.matchWebhookEvents({
          webhookRegistration: registration,
          events: result.data.events
        });

        eventsForCreation = matched.map(
          ({ event: webhookEvent, triggerRegistrationInstanceOids }) => ({
            triggerRegistrationInstanceOids,
            payload: webhookEvent.payload,
            idempotencyKey: webhookEvent.idempotencyKey,
            triggerIds: webhookEvent.triggerIds,
            matchers: webhookEvent.matchers
          })
        );
      }

      let { hadCandidates, hasRemainingCandidates } = await createTriggerRawEvents({
        source: 'webhook',
        webhookEventOid: event.oid,
        events: eventsForCreation
      });

      // Every tenant this webhook would have fanned out to has callbacks disabled -
      // nothing downstream will ever read this event, so discard it entirely.
      if (hadCandidates && !hasRemainingCandidates) {
        await triggerRoutingDropServiceInternal.recordDrop({
          webhookRegistration: registration,
          reason: 'callbacks_disabled',
          count: result.data.events.length
        });
        await db.slateWebhookEvent.deleteMany({ where: { oid: event.oid } });
      }
    }
  }
);
