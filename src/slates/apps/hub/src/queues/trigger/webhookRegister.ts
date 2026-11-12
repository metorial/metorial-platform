import { isServiceError } from '@lowerdeck/error';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { getWebhookUrl } from '../../lib/webhookUrl';
import { slateInvocationService } from '../../services/slateInvocation';
import { generateWebhookRegistrationUrlKey } from '../../services/slateWebhookRegistration';
import { getTriggerInfrastructure } from '../../services/triggerInfrastructure';
import { TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS } from './_config';
import {
  MISSING_ROUTING_KEYS_MESSAGE,
  replaceDeliveryRoutes,
  requireRoutingKeys,
  usingDeliveryRegistrationLock
} from './_deliveryRoutes';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { saveWebhookProviderResult } from './_providerResult';
import { createTriggerInstanceStack } from './_stack';
import { triggerStateInstanceInclude } from './_state';
import {
  assertClaimCoversProviderCall,
  claimWebhookTarget,
  fencedTargetWhere,
  releaseWebhookTarget
} from './_targetClaim';
import { webhookTargetLock } from './_webhookTargetLock';

export let triggerWebhookRegisterQueue = createQueue<{
  triggerWebhookTargetId: string;
  triggerRegistrationInstanceId?: string;
}>({
  name: 'shub/trg/whk/register/1',
  workerOpts: { concurrency: 50 },
  redisUrl: env.service.REDIS_URL,
  jobOpts: { attempts: TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS, removeOnFail: true }
});

export let triggerWebhookRegisterQueueProcessor = triggerWebhookRegisterQueue.process(
  async (data, job) =>
    webhookTargetLock.usingLock(data.triggerWebhookTargetId, async () => {
      let findTarget = (instanceId?: string) =>
        db.triggerWebhookTarget.findUnique({
          where: { id: data.triggerWebhookTargetId },
          include: {
            triggerGroup: true,
            webhooks: {
              take: 1,
              where: {
                triggerRegistrationInstance: {
                  id: instanceId,
                  triggerRegistration: {
                    status: 'active',
                    tenant: { disableCallbacks: false }
                  }
                }
              },
              include: {
                triggerRegistrationInstance: { include: triggerStateInstanceInclude }
              }
            }
          }
        });

      let target = await findTarget(data.triggerRegistrationInstanceId);
      if (!target || !['creating', 'failed'].includes(target.status)) return;
      if (target.webhooks.length === 0 && data.triggerRegistrationInstanceId)
        target = await findTarget();

      let instance = target?.webhooks[0]?.triggerRegistrationInstance;
      if (!target || !instance) return;

      let registration = instance.triggerRegistration;
      let isLastAttempt = job.attemptsMade + 1 >= TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS;
      let operationId = target.renewalOperationId ?? `register:${snowflake.nextId()}`;
      let urlKey = target.registrationUrlKey ?? generateWebhookRegistrationUrlKey('tenant');

      let token = await claimWebhookTarget({
        targetOid: target.oid,
        where: {
          status: { in: ['creating', 'failed'] },
          renewalOperationId: target.renewalOperationId,
          tenant: { disableCallbacks: false }
        },
        data: { renewalOperationId: operationId, registrationUrlKey: urlKey }
      });
      if (!token) {
        // The claim holder owns the target, so only record the error; the stale-target sweep requeues.
        if (isLastAttempt)
          await createTriggerRegistrationInstanceError({
            triggerRegistrationInstanceOid: instance.oid,
            triggerWebhookTargetOid: target.oid,
            code: 'webhook_registration_failed',
            message: `We couldn't set up the webhook for "${target.name}" because an earlier attempt has not finished. It will be tried again automatically.`
          });
        throw new QueueRetryError();
      }

      let failureRecorded = false;
      let resultSaved = false;

      // Nothing saved to resume, so the next attempt must not reuse an identity the provider saw.
      let recordFailure = async (d: {
        code: string;
        message: string;
        registrationAttemptOid?: bigint;
      }) => {
        failureRecorded = true;
        let released = await db.triggerWebhookTarget.updateMany({
          where: {
            oid: target.oid,
            renewalClaimToken: token,
            status: { in: ['creating', 'failed'] }
          },
          data: isLastAttempt
            ? { renewalOperationId: null, status: 'failed' }
            : { renewalOperationId: null }
        });
        if (!released.count || !isLastAttempt) return;

        await createTriggerRegistrationInstanceError({
          triggerRegistrationInstanceOid: instance.oid,
          triggerWebhookTargetOid: target.oid,
          registrationAttemptOid: d.registrationAttemptOid,
          code: d.code,
          message: d.message
        });
      };

      let recordFailedAttempt = async (d: {
        invocationOid: bigint;
        errorCode: string;
        errorMessage: string;
      }) => {
        let attempt = await db.triggerWebhookTargetRegistrationAttempt.create({
          data: {
            ...getId('triggerWebhookTargetRegistrationAttempt'),
            status: 'failed',
            triggerWebhookTargetOid: target.oid,
            invocationOid: d.invocationOid,
            errorCode: d.errorCode,
            errorMessage: d.errorMessage
          }
        });

        await recordFailure({
          registrationAttemptOid: attempt.oid,
          code: 'webhook_registration_failed',
          message: `We couldn't set up the webhook for "${target.name}" after ${TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS} attempts: ${d.errorMessage}`
        });
        if (!isLastAttempt) throw new QueueRetryError();
      };

      try {
        let pending = await db.triggerWebhookRenewalResult.findUnique({
          where: { operationId }
        });
        if (!pending) {
          let delivery = await getTriggerInfrastructure({
            tenant: registration.tenant,
            slate: registration.slate,
            triggerGroup: target.triggerGroup,
            oauthClientId: registration.authConfig?.oauthCredentials?.clientId
          }).catch(async error => {
            await recordFailure({
              code: isServiceError(error)
                ? error.data.code
                : 'trigger_infrastructure_setup_failed',
              message: isServiceError(error)
                ? error.data.message
                : 'The delivery setup for this connection could not be loaded.'
            });
            throw error;
          });

          let stack = await createTriggerInstanceStack({
            registration,
            sessionId: instance.id,
            note: `trigger-webhook-register:${target.id}`
          });

          pending = await usingDeliveryRegistrationLock(
            { bindingId: delivery?.bindingId, targetOid: target.oid },
            async () => {
              await assertClaimCoversProviderCall(target.oid, token);
              let result = await slateInvocationService.registerWebhook({
                stack,
                triggerGroupId: target.triggerGroup.key,
                webhookTargetIdentifier: target.targetIdentifier,
                webhookTargetPayload: target.webhookTargetPayload,
                webhookUrl: getWebhookUrl({ urlKey }),
                operationId,
                selection: instance.selection ?? undefined,
                infrastructure: delivery?.infrastructure
              });
              if (result.status === 'error') {
                await recordFailedAttempt({
                  invocationOid: result.invocation.oid,
                  errorCode: result.error.code,
                  errorMessage: result.error.message
                });
                return null;
              }

              let routingKeys = requireRoutingKeys(delivery, result.data.routingKeys);
              if (!routingKeys) {
                await recordFailedAttempt({
                  invocationOid: result.invocation.oid,
                  errorCode: 'webhook_routing_keys_missing',
                  errorMessage: MISSING_ROUTING_KEYS_MESSAGE
                });
                return null;
              }

              return saveWebhookProviderResult({
                tenant: registration.tenant,
                operationId,
                targetOid: target.oid,
                instanceOid: instance.oid,
                invocationOid: result.invocation.oid,
                oldRegistrationIdentifier: '',
                registrationIdentifier: result.data.webhookRegistrationIdentifier,
                payload: result.data.webhookRegistrationPayload,
                lease: result.data,
                delivery: delivery && { bindingId: delivery.bindingId, routingKeys }
              });
            }
          );
          if (!pending) return;
        }

        let saved = pending;
        resultSaved = true;

        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT "oid" FROM "Tenant" WHERE "oid" = ${target.tenantOid} FOR SHARE`;
          let updated = await tx.triggerWebhookTarget.updateMany({
            where: {
              ...fencedTargetWhere(token),
              oid: target.oid,
              status: { in: ['creating', 'failed'] },
              renewalOperationId: operationId,
              tenant: { disableCallbacks: false },
              webhooks: {
                some: {
                  triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
                }
              }
            },
            data: {
              status: 'active',
              registeredByTriggerRegistrationOid: registration.oid,
              renewalNextAttemptAt: saved.nextRenewalAt,
              renewalOperationId: null
            }
          });
          if (!updated.count) throw new QueueRetryError();

          let webhookRegistration = await tx.slateWebhookRegistration.create({
            data: {
              ...getId('slateWebhookRegistration'),
              type: 'automated',
              owner: 'tenant',
              status: 'active',
              urlKey,
              name: target.name,
              description: target.description,
              metadata: target.metadata,
              tenantOid: registration.tenantOid,
              slateOid: registration.slateOid,
              triggerGroupOid: target.triggerGroupOid,
              secretOid: saved.secretOid,
              registrationIdentifier: saved.registrationIdentifier,
              expiresAt: saved.expiresAt,
              renewAfter: saved.renewAfter,
              authRouting: 'any'
            }
          });
          await tx.triggerWebhookTarget.update({
            where: { oid: target.oid },
            data: { webhookRegistrationOid: webhookRegistration.oid }
          });

          await replaceDeliveryRoutes(tx, {
            webhookRegistrationOid: webhookRegistration.oid,
            bindingId: saved.deliveryBindingId,
            routingKeys: saved.routingKeys
          });

          await tx.triggerWebhookTargetRegistrationAttempt.create({
            data: {
              ...getId('triggerWebhookTargetRegistrationAttempt'),
              status: 'succeeded',
              triggerWebhookTargetOid: target.oid,
              invocationOid: saved.invocationOid
            }
          });
          await tx.triggerRegistrationWebhook.updateMany({
            where: { triggerWebhookTargetOid: target.oid },
            data: { webhookRegistrationOid: webhookRegistration.oid }
          });
          await tx.triggerWebhookRenewalResult.delete({ where: { operationId } });
        });
      } catch (error) {
        // Last attempt: an exception must end failed like a rejected call; renewal cleanup handles
        // any saved provider result.
        if (isLastAttempt && !failureRecorded && !resultSaved)
          await recordFailure({
            code: 'webhook_registration_failed',
            message: `We couldn't set up the webhook for "${target.name}" after ${TRIGGER_WEBHOOK_REGISTER_MAX_ATTEMPTS} attempts: ${
              isServiceError(error) ? error.data.message : 'an internal error occurred.'
            }`
          });
        throw error;
      } finally {
        await releaseWebhookTarget(target.oid, token);
      }
    })
);
