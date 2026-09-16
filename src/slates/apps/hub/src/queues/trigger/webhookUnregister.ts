import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import { TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS } from './_config';
import { webhookTargetLock } from './_webhookTargetLock';
import { triggerWebhookRegisterQueue } from './webhookRegister';

let include = {
  tenant: true,
  triggerGroup: { include: { slate: true } },
  webhookRegistration: true
};

export let triggerWebhookUnregisterQueue = createQueue<{
  triggerWebhookTargetId: string;
  triggerRegistrationId?: string;
}>({
  name: 'shub/trg/whk/unregister/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { attempts: TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS, removeOnFail: true }
});

export let triggerWebhookUnregisterQueueProcessor = triggerWebhookUnregisterQueue.process(
  async (data, job) =>
    webhookTargetLock.usingLock(data.triggerWebhookTargetId, async () => {
      // Provider cleanup is best-effort: it retries with other credentials, but on the
      // last attempt the target is deleted locally anyway so it cannot stay `deleting`
      // forever. The recorded attempt rows keep the failure reason visible.
      let isLastAttempt = job.attemptsMade + 1 >= TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS;
      let retryUnlessLastAttempt = () => {
        if (!isLastAttempt) throw new QueueRetryError();
      };

      let target = await db.triggerWebhookTarget.findUnique({
        where: { id: data.triggerWebhookTargetId },
        include
      });
      if (!target || target.status === 'deleted') return;

      let activeLinks = await db.triggerRegistrationWebhook.findMany({
        where: {
          triggerWebhookTargetOid: target.oid,
          triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
        },
        select: { triggerRegistrationInstance: { select: { id: true } } }
      });
      // Every active connection is its own registration candidate, like on discovery.
      let scheduleRegister = () =>
        triggerWebhookRegisterQueue.addManyWithOps(
          activeLinks.map(link => ({
            data: {
              triggerWebhookTargetId: target.id,
              triggerRegistrationInstanceId: link.triggerRegistrationInstance.id
            },
            opts: { id: `${target.id}:${link.triggerRegistrationInstance.id}` }
          }))
        );

      if (activeLinks.length > 0 && !target.unregistrationStarted) {
        await db.triggerWebhookTarget.update({
          where: { oid: target.oid },
          data: { status: target.webhookRegistrationOid ? 'active' : 'creating' }
        });
        if (!target.webhookRegistrationOid) await scheduleRegister();
        return;
      }

      if (target.webhookRegistration) {
        // Once provider deletion starts, a reconnect must wait for a replacement hook.
        if (!target.unregistrationStarted) {
          await db.triggerWebhookTarget.update({
            where: { oid: target.oid },
            data: { status: 'deleting', unregistrationStarted: true }
          });
        }
        let decrypted = await secretService.DANGEROUSLY_decryptSecret({
          secretOid: target.webhookRegistration.secretOid,
          purpose: 'slate_webhook_registration_payload',
          tenant: target.tenant,
          note: `trigger-webhook-unregister:${target.id}`
        });

        let registrationScope = {
          tenantOid: target.tenantOid,
          instances: { some: { triggerGroupOid: target.triggerGroupOid } }
        };
        // Active connections first ('active' sorts before 'deleted'); revoked credentials of
        // disconnected ones would otherwise burn attempts.
        let otherRegistrations = await db.triggerRegistration.findMany({
          where: registrationScope,
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
          select: { id: true },
          take: TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS
        });
        let candidates = [
          ...new Set(
            [
              decrypted.triggerRegistrationId,
              data.triggerRegistrationId,
              ...otherRegistrations.map(registration => registration.id)
            ].filter((id): id is string => typeof id === 'string')
          )
        ];
        let registrationInclude = {
          tenant: true,
          slate: true,
          instance: true,
          instanceConfig: true,
          authConfig: { include: { authMethod: true } }
        };
        let registrationId = candidates[job.attemptsMade % Math.max(candidates.length, 1)];
        let registration = registrationId
          ? await db.triggerRegistration.findFirst({
              where: { id: registrationId, ...registrationScope },
              include: registrationInclude
            })
          : null;
        if (!registration) {
          retryUnlessLastAttempt();
        } else {
          let version = await getActiveSlateVersion({
            slate: registration.slate,
            instance: registration.instance
          });
          let auth: { authenticationMethodId: string; data: Record<string, any> } | null =
            null;
          if (registration.authConfig) {
            let credentials = await secretService.DANGEROUSLY_decryptSecret({
              secretOid: registration.authConfig.secretOid,
              purpose: 'slate_authentication_configuration',
              tenant: registration.tenant,
              note: `trigger-webhook-unregister:${target.id}`
            });
            auth = {
              authenticationMethodId: registration.authConfig.authMethod.key,
              data: credentials.output ?? credentials.input ?? {}
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

          let result = await slateInvocationService.unregisterWebhook({
            stack,
            triggerGroupId: target.triggerGroup.key,
            webhookRegistrationIdentifier:
              target.webhookRegistration.registrationIdentifier ?? '',
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
          if (result.status === 'error') retryUnlessLastAttempt();
        }
      }

      await db.$transaction([
        db.triggerWebhookTarget.update({
          where: { oid: target.oid },
          data: {
            status: activeLinks.length > 0 ? 'creating' : 'deleted',
            webhookRegistrationOid: null,
            unregistrationStarted: false
          }
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
      if (activeLinks.length > 0) await scheduleRegister();
    })
);
