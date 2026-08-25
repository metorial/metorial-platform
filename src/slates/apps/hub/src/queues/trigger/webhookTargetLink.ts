import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { triggerWebhookRegisterQueue } from './webhookRegister';

type DiscoveredTarget = {
  webhookTargetIdentifier: string;
  name: string;
  description?: string | null;
  metadata: Record<string, any>;
  webhookTargetPayload: any;
  targetOwnership: 'single_user' | 'multi_user';
};

export let triggerWebhookTargetLinkQueue = createQueue<{
  triggerRegistrationInstanceId: string;
  target: DiscoveredTarget;
}>({
  name: 'shub/trg/whk/link',
  redisUrl: env.service.REDIS_URL
});

export let triggerWebhookTargetLinkQueueProcessor = triggerWebhookTargetLinkQueue.process(
  async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include: { triggerGroup: true, triggerRegistration: true }
    });
    if (!instance) return;

    let target = data.target;
    let normalizedTargetIdentifier =
      target.targetOwnership === 'single_user'
        ? `${instance.id}:${target.webhookTargetIdentifier}`
        : target.webhookTargetIdentifier;

    let created = true;
    let webhookTarget;
    try {
      webhookTarget = await db.triggerWebhookTarget.create({
        data: {
          ...getId('triggerWebhookTarget'),
          status: 'creating',
          tenantOid: instance.triggerRegistration.tenantOid,
          triggerGroupOid: instance.triggerGroup.oid,
          targetIdentifier: target.webhookTargetIdentifier,
          normalizedTargetIdentifier,
          name: target.name,
          description: target.description,
          metadata: target.metadata,
          webhookTargetPayload: target.webhookTargetPayload
        }
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err;
      created = false;
      webhookTarget = await db.triggerWebhookTarget.findFirstOrThrow({
        where: {
          tenantOid: instance.triggerRegistration.tenantOid,
          triggerGroupOid: instance.triggerGroup.oid,
          normalizedTargetIdentifier
        }
      });
    }

    try {
      await db.triggerRegistrationWebhook.create({
        data: {
          oid: snowflake.nextId(),
          triggerRegistrationInstanceOid: instance.oid,
          triggerWebhookTargetOid: webhookTarget.oid
        }
      });
    } catch (err: any) {
      if (err.code !== 'P2002') throw err;
    }

    if (webhookTarget.status === 'creating' && created) {
      await triggerWebhookRegisterQueue.add(
        { triggerWebhookTargetId: webhookTarget.id },
        { id: webhookTarget.id }
      );
    } else if (webhookTarget.status === 'failed') {
      await createTriggerRegistrationInstanceError({
        triggerRegistrationInstanceOid: instance.oid,
        triggerWebhookTargetOid: webhookTarget.oid,
        code: 'webhook_registration_failed',
        message: `The webhook for "${webhookTarget.name}" previously failed to register and will not be retried automatically.`
      });
    }
  }
);
