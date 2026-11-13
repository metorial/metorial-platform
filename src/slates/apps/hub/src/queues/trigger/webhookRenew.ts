import { createCron } from '@lowerdeck/cron';
import { isServiceError } from '@lowerdeck/error';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { snowflake } from '../../id';
import { triggerDeliveryConfigServiceInternal } from '../../internal/triggerDeliveryConfigServiceInternal';
import { getWebhookUrl } from '../../lib/webhookUrl';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import {
  TRIGGER_WEBHOOK_RENEW_BATCH_SIZE,
  TRIGGER_WEBHOOK_RENEW_RETRY_MS,
  TRIGGER_WEBHOOK_RENEW_ROLLBACK_WINDOW_MS
} from './_config';
import {
  isDeliveryShared,
  MISSING_ROUTING_KEYS_MESSAGE,
  replaceDeliveryRoutes,
  requireRoutingKeys,
  usingDeliveryRemovalLock
} from './_deliveryRoutes';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { scheduleOrphanedTargetCleanup } from './_orphanedTargets';
import { saveWebhookProviderResult } from './_providerResult';
import { createTriggerInstanceStack } from './_stack';
import { triggerStateInstanceInclude, triggerStateLeaseMs } from './_state';
import {
  assertClaimCoversProviderCall,
  claimWebhookTarget,
  fencedTargetWhere,
  releaseWebhookTarget
} from './_targetClaim';
import { webhookTargetLock } from './_webhookTargetLock';
import { triggerWebhookRegisterQueue } from './webhookRegister';

let Sentry = getSentry();

let RENEWAL_FAILED = 'webhook_renewal_failed';

export let triggerWebhookRenewQueue = createQueue<{ targetId: string }>({
  name: 'shub/trg/whk/renew/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let triggerWebhookRenewQueueProcessor = triggerWebhookRenewQueue.process(async data =>
  webhookTargetLock.usingLock(data.targetId, async () => {
    let target = await db.triggerWebhookTarget.findUnique({
      where: { id: data.targetId },
      include: { tenant: true, triggerGroup: true, webhookRegistration: true }
    });
    let now = new Date();
    if (
      !target ||
      target.status !== 'active' ||
      target.unregistrationStarted ||
      target.tenant.disableCallbacks ||
      !target.webhookRegistration ||
      !target.renewalNextAttemptAt ||
      target.renewalNextAttemptAt > now
    )
      return;

    let webhookRegistration = target.webhookRegistration;
    let invocation = target.triggerGroup.spec.invocation;
    if (invocation.type !== 'webhook' || !invocation.supportsRenewal) return;

    let operationId = target.renewalOperationId ?? snowflake.nextId().toString();
    let token = await claimWebhookTarget({
      targetOid: target.oid,
      now,
      where: {
        status: 'active',
        unregistrationStarted: false,
        webhookRegistrationOid: webhookRegistration.oid,
        renewalNextAttemptAt: { lte: now },
        renewalOperationId: target.renewalOperationId,
        tenant: { disableCallbacks: false }
      },
      data: { renewalOperationId: operationId }
    });
    if (!token) return;

    // Nothing saved to resume, so the next attempt needs a fresh identity; `finally` schedules it.
    let recordFailure = async (instanceOid: bigint, message: string) => {
      await db.triggerWebhookTarget.updateMany({
        where: { oid: target.oid, renewalClaimToken: token },
        data: { renewalOperationId: null }
      });

      if (!webhookRegistration.expiresAt || webhookRegistration.expiresAt > new Date()) return;

      await createTriggerRegistrationInstanceError({
        triggerRegistrationInstanceOid: instanceOid,
        triggerWebhookTargetOid: target.oid,
        code: RENEWAL_FAILED,
        message: `The event subscription for "${target.name}" expired and could not be renewed: ${message}`
      });
    };

    try {
      let pending = await db.triggerWebhookRenewalResult.findUnique({
        where: { operationId }
      });
      if (!pending) {
        let candidates = await db.triggerRegistrationInstance.findMany({
          where: {
            triggerRegistration: {
              tenantOid: target.tenantOid,
              status: 'active',
              tenant: { disableCallbacks: false }
            },
            webhooks: { some: { triggerWebhookTargetOid: target.oid } }
          },
          orderBy: { id: 'asc' },
          take: 25,
          include: triggerStateInstanceInclude
        });
        // Each retry is a new job, so the connection is rotated by time instead.
        let instance =
          candidates[
            Math.floor(Date.now() / TRIGGER_WEBHOOK_RENEW_RETRY_MS) %
              Math.max(candidates.length, 1)
          ];
        // Rescheduling would hide the target from the stale sweep, so an unused one goes to cleanup.
        if (!instance) {
          await scheduleOrphanedTargetCleanup({ targetOids: [target.oid] });
          return;
        }

        let saved = await secretService.DANGEROUSLY_decryptSecret({
          secretOid: webhookRegistration.secretOid,
          purpose: 'slate_webhook_registration_payload',
          tenant: target.tenant,
          note: `trigger-webhook-renew:${target.id}`
        });
        let stack = await createTriggerInstanceStack({
          registration: instance.triggerRegistration,
          sessionId: instance.id,
          note: `trigger-webhook-renew:${target.id}`
        });

        let delivery: Awaited<
          ReturnType<typeof triggerDeliveryConfigServiceInternal.selectDeliveryConfig>
        >;
        try {
          delivery = await triggerDeliveryConfigServiceInternal.selectDeliveryConfig({
            tenant: target.tenant,
            slate: instance.triggerRegistration.slate,
            triggerGroup: target.triggerGroup,
            oauthClientId: instance.triggerRegistration.authConfig?.oauthCredentials?.clientId
          });
        } catch (error) {
          if (!isServiceError(error)) throw error;
          await recordFailure(instance.oid, error.data.message);
          return;
        }

        await assertClaimCoversProviderCall(target.oid, token);
        let result = await slateInvocationService.renewWebhook({
          stack,
          triggerGroupId: target.triggerGroup.key,
          webhookRegistrationIdentifier: webhookRegistration.registrationIdentifier ?? '',
          webhookRegistrationPayload: saved.payload,
          webhookUrl: getWebhookUrl({ urlKey: webhookRegistration.urlKey }),
          webhookTargetIdentifier: target.targetIdentifier,
          webhookTargetPayload: target.webhookTargetPayload,
          operationId,
          selection: instance.selection ?? undefined,
          deliveryConfig: delivery?.deliveryConfig
        });
        if (result.status === 'error') {
          await recordFailure(instance.oid, result.error.message);
          return;
        }

        let routingKeys = requireRoutingKeys(delivery, result.data.routingKeys);
        if (!routingKeys) {
          await recordFailure(instance.oid, MISSING_ROUTING_KEYS_MESSAGE);
          return;
        }

        // Deletion races leave the saved result for durable cleanup.
        pending = await saveWebhookProviderResult({
          tenant: target.tenant,
          operationId,
          targetOid: target.oid,
          instanceOid: instance.oid,
          invocationOid: result.invocation.oid,
          oldRegistrationIdentifier: webhookRegistration.registrationIdentifier ?? '',
          registrationIdentifier: result.data.webhookRegistrationIdentifier,
          payload: result.data.webhookRegistrationPayload,
          // A result naming either date describes the new lease alone; old dates would schedule from the past.
          lease:
            result.data.expiresAt === undefined && result.data.renewAfter === undefined
              ? {
                  expiresAt: webhookRegistration.expiresAt?.toISOString(),
                  renewAfter: webhookRegistration.renewAfter?.toISOString()
                }
              : result.data,
          delivery: delivery && { bindingId: delivery.bindingId, routingKeys }
        });
      }

      let renewed = pending;

      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT "oid" FROM "Tenant" WHERE "oid" = ${target.tenantOid} FOR SHARE`;
        let updated = await tx.triggerWebhookTarget.updateMany({
          where: {
            ...fencedTargetWhere(token),
            oid: target.oid,
            status: 'active',
            unregistrationStarted: false,
            renewalOperationId: operationId,
            webhookRegistrationOid: webhookRegistration.oid,
            tenant: { disableCallbacks: false },
            webhooks: {
              some: {
                triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
              }
            }
          },
          data: {
            renewalOperationId: null,
            renewalClaimToken: null,
            renewalClaimUntil: null,
            renewalNextAttemptAt: renewed.nextRenewalAt
          }
        });
        if (!updated.count) throw new QueueRetryError();

        let registrationUpdated = await tx.slateWebhookRegistration.updateMany({
          where: {
            oid: webhookRegistration.oid,
            status: 'active',
            secretOid: webhookRegistration.secretOid
          },
          data: {
            secretOid: renewed.secretOid,
            registrationIdentifier: renewed.registrationIdentifier,
            expiresAt: renewed.expiresAt,
            renewAfter: renewed.renewAfter
          }
        });
        if (!registrationUpdated.count) throw new QueueRetryError();

        await replaceDeliveryRoutes(tx, {
          webhookRegistrationOid: webhookRegistration.oid,
          bindingId: renewed.deliveryBindingId,
          routingKeys: renewed.routingKeys
        });

        await tx.triggerWebhookRenewalResult.delete({ where: { operationId } });
        await tx.triggerRegistrationInstanceError.deleteMany({
          where: { triggerWebhookTargetOid: target.oid, code: RENEWAL_FAILED }
        });
      });

      // The renewed payload holds the live identities, so the old one is unread; best effort after commit.
      if (renewed.secretOid !== webhookRegistration.secretOid) {
        try {
          await secretService.DANGEROUSLY_deleteSecret({
            tenant: target.tenant,
            secretOid: webhookRegistration.secretOid
          });
        } catch (error) {
          Sentry.captureException(error);
        }
      }
    } finally {
      await releaseWebhookTarget(target.oid, token, {
        renewalNextAttemptAt: new Date(Date.now() + TRIGGER_WEBHOOK_RENEW_RETRY_MS)
      });
    }
  })
);

export let triggerWebhookRenewSearchQueue = createQueue<{ cutoff: string; cursor?: string }>({
  name: 'shub/trg/whk/renew/search/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: { concurrency: 1 }
});

export let triggerWebhookRenewSearchQueueProcessor = triggerWebhookRenewSearchQueue.process(
  async data => {
    let rows = await db.triggerWebhookTarget.findMany({
      where: {
        status: 'active',
        renewalNextAttemptAt: { lte: new Date(data.cutoff) },
        id: data.cursor ? { gt: data.cursor } : undefined,
        tenant: { disableCallbacks: false }
      },
      orderBy: { id: 'asc' },
      take: TRIGGER_WEBHOOK_RENEW_BATCH_SIZE,
      select: { id: true }
    });
    await triggerWebhookRenewQueue.addManyWithOps(
      rows.map(row => ({ data: { targetId: row.id }, opts: { id: row.id } }))
    );
    if (rows.length === TRIGGER_WEBHOOK_RENEW_BATCH_SIZE)
      await triggerWebhookRenewSearchQueue.add(
        { cutoff: data.cutoff, cursor: rows[rows.length - 1]!.id },
        { delay: 100 }
      );
  }
);

export let triggerWebhookRenewCron = createCron(
  { name: 'shub/trg/whk/renew/cron/1', redisUrl: env.service.REDIS_URL, cron: '* * * * *' },
  async () => {
    await triggerWebhookRenewSearchQueue.add({ cutoff: new Date().toISOString() });
    await triggerWebhookRenewResultSearchQueue.add({});
  }
);

export let triggerWebhookRenewResultCleanupQueue = createQueue<{ operationId: string }>({
  name: 'shub/trg/whk/renew/cleanup/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let triggerWebhookRenewResultCleanupQueueProcessor =
  triggerWebhookRenewResultCleanupQueue.process(async data => {
    let result = await db.triggerWebhookRenewalResult.findUnique({
      where: { operationId: data.operationId },
      include: {
        target: { include: { tenant: true, webhookRegistration: true, triggerGroup: true } },
        instance: { include: triggerStateInstanceInclude }
      }
    });
    if (!result) return;

    await webhookTargetLock.usingLock(result.target.id, async () => {
      let target = await db.triggerWebhookTarget.findUniqueOrThrow({
        where: { oid: result.targetOid },
        include: { tenant: true, webhookRegistration: true }
      });
      if (target.renewalClaimUntil && target.renewalClaimUntil > new Date()) return;
      if (
        ['creating', 'failed'].includes(target.status) &&
        !target.tenant.disableCallbacks &&
        target.renewalOperationId === result.operationId
      ) {
        await triggerWebhookRegisterQueue.add({ triggerWebhookTargetId: target.id });
        return;
      }
      if (
        target.status === 'active' &&
        !target.tenant.disableCallbacks &&
        !target.unregistrationStarted &&
        target.renewalOperationId === result.operationId
      ) {
        await triggerWebhookRenewQueue.add({ targetId: target.id });
        return;
      }

      let token = await claimWebhookTarget({
        targetOid: target.oid,
        where: { status: target.status, renewalOperationId: target.renewalOperationId }
      });
      if (!token) throw new QueueRetryError();

      try {
        await usingDeliveryRemovalLock(result.deliveryBindingId, async () => {
          let stillUsed = await isDeliveryShared({
            routes: result.deliveryBindingId
              ? result.routingKeys.map(routingKey => ({
                  bindingId: result.deliveryBindingId!,
                  routingKey
                }))
              : [],
            exceptOperationId: result.operationId
          });

          let rollBack =
            !stillUsed &&
            result.createdAt.getTime() >
              Date.now() - TRIGGER_WEBHOOK_RENEW_ROLLBACK_WINDOW_MS &&
            target.webhookRegistration?.secretOid !== result.secretOid &&
            (result.registrationIdentifier !== result.oldRegistrationIdentifier ||
              !target.webhookRegistration) &&
            result.registrationIdentifier !==
              target.webhookRegistration?.registrationIdentifier;
          if (!rollBack) return;

          let payload = await secretService.DANGEROUSLY_decryptSecret({
            secretOid: result.secretOid,
            purpose: 'slate_webhook_registration_payload',
            tenant: result.target.tenant,
            note: `trigger-renew-rollback:${result.operationId}`
          });
          let stack = await createTriggerInstanceStack({
            registration: result.instance.triggerRegistration,
            sessionId: result.instance.id,
            note: `trigger-renew-rollback:${result.operationId}`
          });

          await assertClaimCoversProviderCall(target.oid, token);
          let rollback = await slateInvocationService.unregisterWebhook({
            stack,
            triggerGroupId: result.target.triggerGroup.key,
            webhookRegistrationIdentifier: result.registrationIdentifier,
            webhookRegistrationPayload: payload.payload
          });
          if (rollback.status === 'error') throw new QueueRetryError();
        });

        // A registration being removed adopts its in-place renewal so removal uses the newest payload.
        let adopting =
          target.status === 'deleting' &&
          target.webhookRegistration?.registrationIdentifier === result.registrationIdentifier
            ? target.webhookRegistration
            : null;

        await db.$transaction(async tx => {
          let released = await tx.triggerWebhookTarget.updateMany({
            where: { ...fencedTargetWhere(token), oid: target.oid },
            data: { renewalClaimToken: null, renewalClaimUntil: null }
          });
          if (!released.count) throw new QueueRetryError();

          if (adopting) {
            await tx.slateWebhookRegistration.update({
              where: { oid: adopting.oid },
              data: { secretOid: result.secretOid }
            });
          }
          await tx.triggerWebhookRenewalResult.deleteMany({
            where: { operationId: result.operationId }
          });
        });

        // Whichever payload the registration does not point at now has no reader left.
        let unusedSecretOid = adopting ? adopting.secretOid : result.secretOid;
        let usedSecretOid = adopting
          ? result.secretOid
          : target.webhookRegistration?.secretOid;
        if (unusedSecretOid !== usedSecretOid)
          await secretService.DANGEROUSLY_deleteSecret({
            tenant: result.target.tenant,
            secretOid: unusedSecretOid
          });
      } finally {
        await releaseWebhookTarget(target.oid, token);
      }
    });
  });

export let triggerWebhookRenewResultSearchQueue = createQueue<{ cursor?: string }>({
  name: 'shub/trg/whk/renew/result/search/1',
  redisUrl: env.service.REDIS_URL,
  jobOpts: { removeOnFail: true },
  workerOpts: { concurrency: 1 }
});

export let triggerWebhookRenewResultSearchQueueProcessor =
  triggerWebhookRenewResultSearchQueue.process(async data => {
    let rows = await db.triggerWebhookRenewalResult.findMany({
      where: {
        createdAt: { lte: new Date(Date.now() - triggerStateLeaseMs) },
        operationId: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { operationId: 'asc' },
      take: TRIGGER_WEBHOOK_RENEW_BATCH_SIZE,
      select: { operationId: true }
    });
    await triggerWebhookRenewResultCleanupQueue.addManyWithOps(
      rows.map(row => ({ data: row, opts: { id: row.operationId } }))
    );
    if (rows.length === TRIGGER_WEBHOOK_RENEW_BATCH_SIZE)
      await triggerWebhookRenewResultSearchQueue.add(
        { cursor: rows[rows.length - 1]!.operationId },
        { delay: 100 }
      );
  });
