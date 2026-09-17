import { createQueue, QueueRetryError } from '@lowerdeck/queue';
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
import { webhookTargetLock } from './_webhookTargetLock';
import { createTriggerRegistrationInstanceError } from './_instanceError';

let include = {
  triggerGroup: true,
  webhooks: {
    take: 1,
    where: {
      triggerRegistrationInstance: { triggerRegistration: { status: 'active' as const } }
    },
    include: {
      triggerRegistrationInstance: {
        include: {
          triggerRegistration: {
            include: {
              tenant: true,
              slate: true,
              instance: true,
              instanceConfig: true,
              authConfig: { include: { authMethod: true } }
            }
          }
        }
      }
    }
  }
};

export let triggerWebhookRegisterQueue = createQueue<{
  triggerWebhookTargetId: string;
  triggerRegistrationInstanceId?: string;
}>({
  name: 'shub/trg/whk/register/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { attempts: TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS, removeOnFail: true }
});

export let triggerWebhookRegisterQueueProcessor = triggerWebhookRegisterQueue.process(
  async (data, job) =>
    webhookTargetLock.usingLock(data.triggerWebhookTargetId, async () => {
      let findTarget = (triggerRegistrationInstanceId?: string) =>
        db.triggerWebhookTarget.findUnique({
          where: { id: data.triggerWebhookTargetId },
          include: {
            ...include,
            webhooks: {
              ...include.webhooks,
              where: {
                triggerRegistrationInstance: {
                  id: triggerRegistrationInstanceId,
                  triggerRegistration: { status: 'active' }
                }
              }
            }
          }
        });

      let target = await findTarget(data.triggerRegistrationInstanceId);
      if (!target || !['creating', 'failed'].includes(target.status)) return;

      // Requested connection may be gone; fall back to any active one.
      if (target.webhooks.length === 0 && data.triggerRegistrationInstanceId) {
        target = await findTarget();
      }
      let link = target?.webhooks[0];
      if (!target || !link) return;
      let registration = link.triggerRegistrationInstance.triggerRegistration;

      let version = await getActiveSlateVersion({
        slate: registration.slate,
        instance: registration.instance
      });

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
            webhookRegistrationIdentifier: result.data.webhookRegistrationIdentifier,
            authRouting: 'any'
          });

        await db.$transaction([
          db.triggerWebhookTarget.update({
            where: { oid: target.oid },
            data: {
              status: 'active',
              webhookRegistrationOid: webhookRegistration.oid,
              registeredByTriggerRegistrationOid: registration.oid
            }
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

      if (job.attemptsMade + 1 < TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS)
        throw new QueueRetryError();

      await db.triggerWebhookTarget.update({
        where: { oid: target.oid },
        data: { status: 'failed' }
      });

      // Only the connection whose credentials were used is at fault.
      await createTriggerRegistrationInstanceError({
        triggerRegistrationInstanceOid: link.triggerRegistrationInstance.oid,
        triggerWebhookTargetOid: target.oid,
        registrationAttemptOid: attempt.oid,
        code: 'webhook_registration_failed',
        message: `We couldn't set up the webhook for "${target.name}" after ${TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS} attempts: ${result.error.message}`
      });
    })
);
