import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import { generateWebhookRegistrationUrlKey } from '../../services/slateWebhookRegistration';
import { TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS } from './_config';
import { isDeliveryShared, usingDeliveryRemovalLock } from './_deliveryRoutes';
import { createTriggerInstanceStack } from './_stack';
import {
  assertClaimCoversProviderCall,
  claimWebhookTarget,
  fencedTargetWhere,
  releaseWebhookTarget
} from './_targetClaim';
import { webhookTargetLock } from './_webhookTargetLock';
import { triggerWebhookRegisterQueue } from './webhookRegister';

let include = {
  tenant: true,
  triggerGroup: { include: { slate: true } },
  webhookRegistration: true,
  registeredByTriggerRegistration: { select: { id: true } }
};

let registrationInclude = {
  tenant: true,
  slate: true,
  instance: true,
  instanceConfig: true,
  authConfig: { include: { authMethod: true } }
};

export let triggerWebhookUnregisterQueue = createQueue<{
  triggerWebhookTargetId: string;
  triggerRegistrationId?: string;
}>({
  name: 'shub/trg/whk/unregister/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { attempts: TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS, removeOnFail: true },
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let triggerWebhookUnregisterQueueProcessor = triggerWebhookUnregisterQueue.process(
  async (data, job) =>
    webhookTargetLock.usingLock(data.triggerWebhookTargetId, async () => {
      // Best-effort: on the last attempt the target is deleted locally regardless.
      let isLastAttempt = job.attemptsMade + 1 >= TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS;
      let retryUnlessLastAttempt = () => {
        if (!isLastAttempt) throw new QueueRetryError();
      };

      let target = await db.triggerWebhookTarget.findUnique({
        where: { id: data.triggerWebhookTargetId },
        include
      });
      if (!target || target.status === 'deleted') return;

      let token = await claimWebhookTarget({ targetOid: target.oid });
      if (!token) throw new QueueRetryError();

      try {
        let activeLinks = await db.triggerRegistrationWebhook.findMany({
          where: {
            triggerWebhookTargetOid: target.oid,
            triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
          },
          select: { triggerRegistrationInstance: { select: { id: true } } }
        });
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
          let restored = await db.triggerWebhookTarget.updateMany({
            where: { ...fencedTargetWhere(token), oid: target.oid },
            data: { status: target.webhookRegistrationOid ? 'active' : 'creating' }
          });
          if (!restored.count) throw new QueueRetryError();
          if (!target.webhookRegistrationOid) await scheduleRegister();
          return;
        }

        let webhookRegistration = target.webhookRegistration;
        let providerHookLeft = false;
        if (webhookRegistration) {
          // Past this point a reconnect needs a new hook.
          if (!target.unregistrationStarted) {
            let deleting = await db.triggerWebhookTarget.updateMany({
              where: { ...fencedTargetWhere(token), oid: target.oid },
              data: { status: 'deleting', unregistrationStarted: true }
            });
            if (!deleting.count) throw new QueueRetryError();
          }

          let routes = await db.triggerDeliveryRoute.findMany({
            where: { webhookRegistrationOid: webhookRegistration.oid },
            select: { bindingId: true, routingKey: true }
          });

          // Only the last registration holding a routing key removes the provider resource.
          await usingDeliveryRemovalLock(routes[0]?.bindingId, async () => {
            let sharedWith = await isDeliveryShared({
              routes,
              exceptWebhookRegistrationOid: webhookRegistration.oid,
              exceptTargetOid: target.oid
            });

            let decrypted = await secretService.DANGEROUSLY_decryptSecret({
              secretOid: webhookRegistration.secretOid,
              purpose: 'slate_webhook_registration_payload',
              tenant: target.tenant,
              note: `trigger-webhook-unregister:${target.id}`
            });

            let registrationScope = {
              tenantOid: target.tenantOid,
              instances: { some: { triggerGroupOid: target.triggerGroupOid } }
            };
            // status asc puts 'active' before 'deleted'.
            let otherRegistrations = await db.triggerRegistration.findMany({
              where: registrationScope,
              orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
              select: { id: true },
              take: TRIGGER_WEBHOOK_UNREGISTER_MAX_ATTEMPTS
            });
            let candidates = [
              ...new Set(
                [
                  target.registeredByTriggerRegistration?.id,
                  data.triggerRegistrationId,
                  ...otherRegistrations.map(registration => registration.id)
                ].filter((id): id is string => typeof id === 'string')
              )
            ];
            let registrationId = candidates[job.attemptsMade % Math.max(candidates.length, 1)];
            let registration =
              registrationId && !sharedWith
                ? await db.triggerRegistration.findFirst({
                    where: { id: registrationId, ...registrationScope },
                    include: registrationInclude
                  })
                : null;

            if (!registration) {
              if (!sharedWith) {
                retryUnlessLastAttempt();
                providerHookLeft = true;
              }
              return;
            }

            let stack = await createTriggerInstanceStack({
              registration,
              sessionId: target.id,
              note: `trigger-webhook-unregister:${target.id}`
            });

            await assertClaimCoversProviderCall(target.oid, token);
            let result = await slateInvocationService.unregisterWebhook({
              stack,
              triggerGroupId: target.triggerGroup.key,
              webhookRegistrationIdentifier: webhookRegistration.registrationIdentifier ?? '',
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
            if (result.status === 'error') {
              retryUnlessLastAttempt();
              providerHookLeft = true;
            }
          });
        }

        // A renewal that already succeeded at the provider is rolled back by its own queue.
        if (
          (await db.triggerWebhookRenewalResult.count({ where: { targetOid: target.oid } })) >
          0
        )
          throw new QueueRetryError();

        let webhookRegistrationOid = target.webhookRegistrationOid;
        await db.$transaction(async tx => {
          let changed = await tx.triggerWebhookTarget.updateMany({
            where: {
              ...fencedTargetWhere(token),
              oid: target.oid,
              renewalResults: { none: {} }
            },
            data: {
              status: activeLinks.length > 0 ? 'creating' : 'deleted',
              webhookRegistrationOid: null,
              registeredByTriggerRegistrationOid: null,
              unregistrationStarted: false,
              renewalOperationId: null,
              // A hook still at the provider can only be replaced at its
              // URL, so the next registration reuses it.
              registrationUrlKey: providerHookLeft
                ? (webhookRegistration?.urlKey ?? null)
                : null,
              renewalNextAttemptAt: null
            }
          });
          if (!changed.count) throw new QueueRetryError();

          if (webhookRegistrationOid) {
            await tx.triggerDeliveryRoute.deleteMany({ where: { webhookRegistrationOid } });
            await tx.slateWebhookRegistration.update({
              where: { oid: webhookRegistrationOid },
              data: {
                status: 'deleted',
                ...(providerHookLeft
                  ? { urlKey: generateWebhookRegistrationUrlKey('tenant') }
                  : {})
              }
            });
          }
        });

        if (activeLinks.length > 0) await scheduleRegister();
      } finally {
        await releaseWebhookTarget(target.oid, token);
      }
    })
);
