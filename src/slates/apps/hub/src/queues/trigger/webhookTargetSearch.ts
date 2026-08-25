import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { triggerWebhookTargetLinkQueue } from './webhookTargetLink';

let include = {
  triggerGroup: true,
  triggerRegistration: {
    include: {
      tenant: true,
      slate: true,
      instanceConfig: true,
      authConfig: { include: { authMethod: true } }
    }
  }
};

export let triggerWebhookTargetSearchQueue = createQueue<{
  triggerRegistrationInstanceId: string;
  pageToken?: any;
}>({
  name: 'shub/trg/whk/search',
  redisUrl: env.service.REDIS_URL
});

export let triggerWebhookTargetSearchQueueProcessor = triggerWebhookTargetSearchQueue.process(
  async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include
    });
    if (!instance) return;

    let registration = instance.triggerRegistration;
    let version = await getActiveSlateVersion({ slate: registration.slate });

    let auth: { authenticationMethodId: string; data: Record<string, any> } | null = null;
    if (registration.authConfig) {
      let decrypted = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: registration.authConfig.secretOid,
        purpose: 'slate_authentication_configuration',
        tenant: registration.tenant,
        note: `trigger-webhook-search:${instance.id}`
      });
      auth = {
        authenticationMethodId: registration.authConfig.authMethod.key,
        data: decrypted.output ?? decrypted.input ?? {}
      };
    }

    let stack = await slateInvocationService.createInvocationWithState({
      participants: [],
      slateVersion: version,
      tenant: registration.tenant,
      session: { id: instance.id, state: {} },
      config: registration.instanceConfig.value ?? {},
      auth
    });

    let result = await slateInvocationService.listWebhookTargets({
      stack,
      triggerGroupId: instance.triggerGroup.key,
      pageToken: data.pageToken ?? null
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

    if (targets.length > 0) {
      await triggerWebhookTargetLinkQueue.addManyWithOps(
        targets.map(target => ({
          data: { triggerRegistrationInstanceId: instance.id, target },
          opts: { id: `${instance.id}:${target.webhookTargetIdentifier}` }
        }))
      );
    }

    if (targets.length === 0 || !nextPageToken) return;

    await triggerWebhookTargetSearchQueue.add(
      { triggerRegistrationInstanceId: instance.id, pageToken: nextPageToken },
      { id: `${instance.id}:${JSON.stringify(nextPageToken)}` }
    );
  }
);
