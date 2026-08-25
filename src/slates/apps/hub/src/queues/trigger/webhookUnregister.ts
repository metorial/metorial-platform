import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';

let include = {
  tenant: true,
  triggerGroup: { include: { slate: true } },
  webhookRegistration: true
};

export let triggerWebhookUnregisterQueue = createQueue<{ triggerWebhookTargetId: string }>({
  name: 'shub/trg/whk/unregister',
  redisUrl: env.service.REDIS_URL
});

export let triggerWebhookUnregisterQueueProcessor = triggerWebhookUnregisterQueue.process(
  async data => {
    let target = await db.triggerWebhookTarget.findUnique({
      where: { id: data.triggerWebhookTargetId },
      include
    });
    if (!target || target.status === 'deleted') return;

    if (target.webhookRegistration) {
      let version = await getActiveSlateVersion({ slate: target.triggerGroup.slate });

      let stack = await slateInvocationService.createInvocation({
        participants: [],
        slateVersion: version,
        tenant: target.tenant
      });

      let decrypted = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: target.webhookRegistration.secretOid,
        purpose: 'slate_webhook_registration_payload',
        tenant: target.tenant,
        note: `trigger-webhook-unregister:${target.id}`
      });

      let result = await slateInvocationService.unregisterWebhook({
        stack,
        triggerGroupId: target.triggerGroup.key,
        webhookRegistrationIdentifier: target.webhookRegistration.registrationIdentifier ?? '',
        webhookRegistrationPayload: decrypted.payload
      });

      await db.triggerWebhookTargetRegistrationAttempt.create({
        data: {
          ...getId('triggerWebhookTargetRegistrationAttempt'),
          status: result.status === 'success' ? 'succeeded' : 'failed',
          triggerWebhookTargetOid: target.oid,
          invocationOid: result.invocation.oid,
          errorCode: result.status === 'error' ? result.error.code : null,
          errorMessage: result.status === 'error' ? result.error.message : null
        }
      });
      // Best-effort: a 404/gone/... on unregister shouldn't block cleanup,
      // so we record the outcome above but proceed to delete anyway
    }

    await db.$transaction([
      db.triggerWebhookTarget.update({
        where: { oid: target.oid },
        data: { status: 'deleted' }
      }),
      ...(target.webhookRegistrationOid
        ? [
            db.slateWebhookRegistration.update({
              where: { oid: target.webhookRegistrationOid },
              data: { status: 'deleted' }
            })
          ]
        : [])
    ]);
  }
);
