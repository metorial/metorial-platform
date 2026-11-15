import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { slateInvocationService } from '../../services/slateInvocation';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { createTriggerInstanceStack } from './_stack';
import { triggerWebhookTargetLinkQueue } from './webhookTargetLink';
import { triggerWebhookTargetPruneQueue } from './webhookTargetSweep';

let include = {
  triggerGroup: true,
  triggerRegistration: {
    include: {
      tenant: true,
      slate: true,
      instance: true,
      instanceConfig: true,
      authConfig: { include: { authMethod: true } }
    }
  }
};

export let triggerWebhookTargetSearchQueue = createQueue<{
  triggerRegistrationInstanceId: string;
  pageToken?: any;
  discoveryStartedAt?: Date;
  isPartial?: boolean;
}>({
  name: 'shub/trg/whk/search/1',
  workerOpts: { concurrency: 1 },
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true }
});

export let triggerWebhookTargetSearchQueueProcessor = triggerWebhookTargetSearchQueue.process(
  async data => {
    let discoveryStartedAt = data.discoveryStartedAt ?? new Date();
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include
    });
    if (
      !instance ||
      instance.triggerRegistration.status !== 'active' ||
      instance.triggerRegistration.tenant.disableCallbacks
    )
      return;
    let invocation = instance.triggerGroup.spec.invocation;
    if (invocation.type !== 'webhook' || invocation.registration.mode !== 'auto') return;

    let stack = await createTriggerInstanceStack({
      registration: instance.triggerRegistration,
      sessionId: instance.id,
      note: `trigger-webhook-search:${instance.id}`
    });

    let result = await slateInvocationService.listWebhookTargets({
      stack,
      triggerGroupId: instance.triggerGroup.key,
      pageToken: data.pageToken ?? null,
      selection: instance.selection ?? undefined
    });

    if (result.status === 'error') {
      await createTriggerRegistrationInstanceError({
        triggerRegistrationInstanceOid: instance.oid,
        code: 'webhook_discovery_failed',
        message: `We couldn't list webhook targets: ${result.error.message}`
      });
      return;
    }

    let { targets, nextPageToken } = result.data;
    let isPartial = data.isPartial === true || result.data.isPartial === true;

    if (targets.length > 0) {
      // Refresh links here; link jobs may run after prune is scheduled.
      await db.triggerRegistrationWebhook.updateMany({
        where: {
          triggerRegistrationInstanceOid: instance.oid,
          triggerWebhookTarget: {
            targetIdentifier: { in: targets.map(target => target.webhookTargetIdentifier) }
          },
          lastDiscoveredAt: { lt: discoveryStartedAt }
        },
        data: { lastDiscoveredAt: discoveryStartedAt }
      });
      await triggerWebhookTargetLinkQueue.addManyWithOps(
        targets.map(target => ({
          data: {
            triggerRegistrationInstanceId: instance.id,
            target,
            discoveredAt: discoveryStartedAt
          },
          opts: {
            id: `${instance.id}:${discoveryStartedAt.getTime()}:${target.webhookTargetIdentifier}`
          }
        }))
      );
    }

    // Empty pages don't end discovery; only a missing token does.
    if (nextPageToken == null || nextPageToken === '') {
      if (!isPartial) {
        await triggerWebhookTargetPruneQueue.add({
          triggerRegistrationInstanceId: instance.id,
          discoveredBefore: discoveryStartedAt
        });
      }
      return;
    }

    await triggerWebhookTargetSearchQueue.add(
      {
        triggerRegistrationInstanceId: instance.id,
        pageToken: nextPageToken,
        discoveryStartedAt,
        isPartial
      },
      { id: `${instance.id}:${discoveryStartedAt.getTime()}:${JSON.stringify(nextPageToken)}` }
    );
  }
);
