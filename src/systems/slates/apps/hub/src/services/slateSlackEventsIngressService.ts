import { badRequestError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { env } from '../env';
import { resolveSlackSigningSecret, verifySlackRequestSignature } from '../lib/slackSigning';
import { slateTriggerWebhookRequestService } from './slateTriggerWebhookRequest';

type IngestResult =
  | { type: 'challenge'; challenge: string }
  | { type: 'accepted'; dispatched: number };

class slateSlackEventsIngressServiceImpl {
  async ingest(d: {
    rawBody: string;
    signature: string | undefined;
    timestamp: string | undefined;
  }): Promise<IngestResult> {
    let payload: { type?: string; challenge?: string; team_id?: string; api_app_id?: string };
    try {
      payload = JSON.parse(d.rawBody);
    } catch {
      throw new ServiceError(badRequestError({ message: 'Invalid JSON body' }));
    }

    let signingSecret = resolveSlackSigningSecret({
      secretsJson: env.slackEvents.SLACK_EVENTS_SIGNING_SECRETS_JSON,
      singleSecret: env.slackEvents.SLACK_EVENTS_SIGNING_SECRET,
      apiAppId: typeof payload.api_app_id === 'string' ? payload.api_app_id : undefined
    });

    if (!signingSecret) {
      throw new ServiceError(
        badRequestError({
          message:
            'Slack Events signing is not configured (set SLACK_EVENTS_SIGNING_SECRET or SLACK_EVENTS_SIGNING_SECRETS_JSON)'
        })
      );
    }

    if (
      !verifySlackRequestSignature({
        signingSecret,
        rawBody: d.rawBody,
        requestTimestamp: d.timestamp,
        slackSignature: d.signature
      })
    ) {
      throw new ServiceError(
        unauthorizedError({ message: 'Invalid Slack request signature' })
      );
    }

    if (payload.type === 'url_verification' && typeof payload.challenge === 'string') {
      return { type: 'challenge', challenge: payload.challenge };
    }

    if (payload.type !== 'event_callback') {
      return { type: 'accepted', dispatched: 0 };
    }

    let teamId = typeof payload.team_id === 'string' ? payload.team_id : undefined;
    if (!teamId) {
      return { type: 'accepted', dispatched: 0 };
    }

    let receivers = await db.slateTriggerReceiver.findMany({
      where: {
        status: 'active',
        slate: { identifier: { in: ['slack', 'slack_user'] } },
        authConfigOid: { not: null },
        triggers: { some: { source: 'webhook' } }
      },
      include: {
        triggers: { where: { source: 'webhook' } },
        authConfig: true
      }
    });

    let dispatched = 0;
    let bodyContent = Buffer.from(d.rawBody, 'utf8').toString('base64');

    for (let receiver of receivers) {
      let profile = receiver.authConfig?.profile as { teamId?: string } | null | undefined;
      if (profile?.teamId !== teamId) continue;

      for (let trigger of receiver.triggers) {
        await slateTriggerWebhookRequestService.createWebhookRequest({
          receiverTriggerId: trigger.id,
          request: {
            url: 'https://slack.com/api/events-api',
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: { encoding: 'base64', content: bodyContent }
          }
        });
        dispatched++;
      }
    }

    return { type: 'accepted', dispatched };
  }
}

export let slateSlackEventsIngressService = Service.create(
  'slateSlackEventsIngress',
  () => new slateSlackEventsIngressServiceImpl()
).build();
