import { createQueue } from '@lowerdeck/queue';
import { SLATES_WEBHOOK_ERROR_DEFAULTS, type SlatesWebhookErrorCode } from '@slates/proto';
import { db } from '../../db';
import { env } from '../../env';
import {
  slateWebhookEventServiceInternal,
  triggerRoutingMatcherServiceInternal
} from '../../internal';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { publishWebhookEventResolved } from '../../lib/webhookEventBus';
import { secretService, slateInvocationService } from '../../services';
import { globalTenant } from '../../services/tenant';
import { createTriggerRawEvents } from '../trigger/_rawEvent';

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

    let version = await getActiveSlateVersion({ slate: registration.slate });
    let tenant = registration.tenant ?? globalTenant;

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

    if (result.data.events.length > 0) {
      let target = registration.triggerWebhookTarget;

      if (target) {
        let links = await db.triggerRegistrationWebhook.findMany({
          where: { triggerWebhookTargetOid: target.oid },
          select: { triggerRegistrationInstanceOid: true }
        });

        await createTriggerRawEvents({
          source: 'webhook',
          events: result.data.events.map(webhookEvent => ({
            triggerRegistrationInstanceOids: links.map(
              link => link.triggerRegistrationInstanceOid
            ),
            payload: webhookEvent.payload,
            idempotencyKey: webhookEvent.idempotencyKey,
            triggerIds: webhookEvent.triggerIds,
            matchers: webhookEvent.matchers
          }))
        });
      } else {
        let matched = await triggerRoutingMatcherServiceInternal.matchWebhookEvents({
          webhookRegistration: registration,
          events: result.data.events
        });

        await createTriggerRawEvents({
          source: 'webhook',
          events: matched.map(({ event: webhookEvent, triggerRegistrationInstanceOids }) => ({
            triggerRegistrationInstanceOids,
            payload: webhookEvent.payload,
            idempotencyKey: webhookEvent.idempotencyKey,
            triggerIds: webhookEvent.triggerIds,
            matchers: webhookEvent.matchers
          }))
        });
      }
    }
  }
);
