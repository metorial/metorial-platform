import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { triggerWebhookRegistrationServiceInternal } from '../../internal/triggerWebhookRegistrationServiceInternal';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { getWebhookUrl } from '../../lib/webhookUrl';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import { generateWebhookRegistrationUrlKey } from '../../services/slateWebhookRegistration';
import { TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS } from './_config';
import { createTriggerRegistrationInstanceError } from './_instanceError';

let registerLock = createLock({
  name: 'shub/trg/whk/register/lock',
  redisUrl: env.service.REDIS_URL
});

let include = {
  triggerGroup: true,
  webhooks: {
    take: 1,
    include: {
      triggerRegistrationInstance: {
        include: {
          triggerRegistration: {
            include: {
              tenant: true,
              slate: true,
              instanceConfig: true,
              authConfig: { include: { authMethod: true } }
            }
          }
        }
      }
    }
  }
};

export let triggerWebhookRegisterQueue = createQueue<{ triggerWebhookTargetId: string }>({
  name: 'shub/trg/whk/register',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { attempts: TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS }
});

export let triggerWebhookRegisterQueueProcessor = triggerWebhookRegisterQueue.process(
  async (data, job) =>
    registerLock.usingLock(data.triggerWebhookTargetId, async () => {
      let target = await db.triggerWebhookTarget.findUnique({
        where: { id: data.triggerWebhookTargetId },
        include
      });
      if (!target || target.status !== 'creating') return;

      let link = target.webhooks[0];
      if (!link) return;
      let registration = link.triggerRegistrationInstance.triggerRegistration;

      let version = await getActiveSlateVersion({ slate: registration.slate });

      let auth: { authenticationMethodId: string; data: Record<string, any> } | null = null;
      if (registration.authConfig) {
        let decrypted = await secretService.DANGEROUSLY_decryptSecret({
          secretOid: registration.authConfig.secretOid,
          purpose: 'slate_authentication_configuration',
          tenant: registration.tenant,
          note: `trigger-webhook-register:${target.id}`
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
        session: { id: target.id, state: {} },
        config: registration.instanceConfig.value ?? {},
        auth
      });

      let urlKey = generateWebhookRegistrationUrlKey('tenant');
      let webhookUrl = getWebhookUrl({ urlKey });

      let result = await slateInvocationService.registerWebhook({
        stack,
        triggerGroupId: target.triggerGroup.key,
        webhookTargetIdentifier: target.targetIdentifier,
        webhookTargetPayload: target.webhookTargetPayload,
        webhookUrl
      });

      if (result.status === 'success') {
        let webhookRegistration =
          await triggerWebhookRegistrationServiceInternal.createWebhookRegistration({
            tenant: registration.tenant,
            slate: registration.slate,
            triggerGroup: target.triggerGroup,
            type: 'automated',
            owner: 'tenant',
            status: 'active',
            urlKey,
            name: target.name,
            description: target.description ?? undefined,
            metadata: target.metadata as Record<string, any>,
            webhookRegistrationPayload: result.data.webhookRegistrationPayload,
            webhookRegistrationIdentifier: result.data.webhookRegistrationIdentifier
          });

        await db.$transaction([
          db.triggerWebhookTarget.update({
            where: { oid: target.oid },
            data: { status: 'active', webhookRegistrationOid: webhookRegistration.oid }
          }),
          db.triggerWebhookTargetRegistrationAttempt.create({
            data: {
              ...getId('triggerWebhookTargetRegistrationAttempt'),
              status: 'succeeded',
              triggerWebhookTargetOid: target.oid,
              invocationOid: result.invocation.oid
            }
          }),
          db.triggerRegistrationWebhook.updateMany({
            where: { triggerWebhookTargetOid: target.oid },
            data: { webhookRegistrationOid: webhookRegistration.oid }
          })
        ]);

        return;
      }

      let attempt = await db.triggerWebhookTargetRegistrationAttempt.create({
        data: {
          ...getId('triggerWebhookTargetRegistrationAttempt'),
          status: 'failed',
          triggerWebhookTargetOid: target.oid,
          invocationOid: result.invocation.oid,
          errorCode: result.error.code,
          errorMessage: result.error.message
        }
      });

      if (job.attemptsMade + 1 < TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS) {
        throw new Error(
          `Webhook registration failed for target ${target.id} (attempt ${job.attemptsMade + 1}/${TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS}): ${result.error.message}`
        );
      }

      await db.triggerWebhookTarget.update({
        where: { oid: target.oid },
        data: { status: 'failed' }
      });

      let instanceOids = [
        ...new Set(
          (
            await db.triggerRegistrationWebhook.findMany({
              where: { triggerWebhookTargetOid: target.oid },
              select: { triggerRegistrationInstanceOid: true }
            })
          ).map(w => w.triggerRegistrationInstanceOid)
        )
      ];

      for (let instanceOid of instanceOids) {
        await createTriggerRegistrationInstanceError({
          triggerRegistrationInstanceOid: instanceOid,
          triggerWebhookTargetOid: target.oid,
          registrationAttemptOid: attempt.oid,
          code: 'webhook_registration_failed',
          message: `We couldn't set up the webhook for "${target.name}" after ${TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS} attempts: ${result.error.message}`
        });
      }
    })
);
