import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import {
  isTriggerDeliveryConfig,
  TRIGGER_DELIVERY_CONFIG_MISSING
} from '../../services/triggerInfrastructure';
import { triggerRegistrationInstanceSetupQueue } from './setup';
import { triggerWebhookRegisterQueue } from './webhookRegister';
import { triggerWebhookUnregisterQueue } from './webhookUnregister';

let batchSize = 100;

export let triggerWebhookRegistrationRematchQueue = createQueue<{
  webhookRegistrationId: string;
  cursor?: string;
}>({
  name: 'shub/trg/whk/rematch/1',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

// Registrations that failed while no delivery config matched are otherwise retried only
// when their target is rediscovered after the cooldown. A config is found by trigger group
// key, so the targets of every version of the group are included.
let retryFailedTargets = async (d: {
  slateOid: bigint;
  triggerGroupKey: string;
  tenantOid: bigint | undefined;
  cursor: string | undefined;
}) => {
  let targets = await db.triggerWebhookTarget.findMany({
    where: {
      id: d.cursor ? { gt: d.cursor } : undefined,
      status: 'failed',
      tenantOid: d.tenantOid,
      tenant: { disableCallbacks: false },
      triggerGroup: { slateOid: d.slateOid, key: d.triggerGroupKey }
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: { id: true, oid: true }
  });
  if (targets.length === 0) return targets;

  let targetOids = targets.map(target => target.oid);
  await db.triggerWebhookTarget.updateMany({
    where: { oid: { in: targetOids }, status: 'failed' },
    data: {
      status: 'creating',
      webhookRegistrationOid: null,
      registeredByTriggerRegistrationOid: null,
      unregistrationStarted: false
    }
  });
  // A retry that still finds no config for its OAuth app records the failure again.
  await db.triggerRegistrationInstanceError.deleteMany({
    where: {
      triggerWebhookTargetOid: { in: targetOids },
      code: TRIGGER_DELIVERY_CONFIG_MISSING
    }
  });

  let links = await db.triggerRegistrationWebhook.findMany({
    where: {
      triggerWebhookTargetOid: { in: targetOids },
      triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
    },
    select: {
      triggerWebhookTargetOid: true,
      triggerRegistrationInstance: { select: { id: true } }
    }
  });
  let targetIds = new Map(targets.map(target => [target.oid, target.id]));
  await triggerWebhookRegisterQueue.addManyWithOps(
    links.map(link => {
      let targetId = targetIds.get(link.triggerWebhookTargetOid!)!;
      let instanceId = link.triggerRegistrationInstance.id;
      return {
        data: { triggerWebhookTargetId: targetId, triggerRegistrationInstanceId: instanceId },
        opts: { id: `${targetId}:${instanceId}` }
      };
    })
  );

  return targets;
};

// Registrations delivering through a removed config are unregistered at the provider; those
// still in use then register again and find another config or record that none is set up.
let releaseConfigTargets = async (d: { configId: string; cursor: string | undefined }) => {
  let targets = await db.triggerWebhookTarget.findMany({
    where: {
      id: d.cursor ? { gt: d.cursor } : undefined,
      status: 'active',
      unregistrationStarted: false,
      webhookRegistration: { deliveryRoutes: { some: { bindingId: d.configId } } }
    },
    orderBy: { id: 'asc' },
    take: batchSize,
    select: { id: true, oid: true }
  });
  if (targets.length === 0) return targets;

  // Unlocked; the status filter guards against a concurrent removal. Without the flag the
  // unregister job leaves a target that is still in use registered as it is.
  await db.triggerWebhookTarget.updateMany({
    where: {
      oid: { in: targets.map(target => target.oid) },
      status: 'active',
      unregistrationStarted: false
    },
    data: { status: 'deleting', unregistrationStarted: true }
  });
  await triggerWebhookUnregisterQueue.addManyWithOps(
    targets.map(target => ({
      data: { triggerWebhookTargetId: target.id },
      opts: { id: target.id }
    }))
  );

  return targets;
};

export let triggerWebhookRegistrationRematchQueueProcessor =
  triggerWebhookRegistrationRematchQueue.process(async data => {
    let registration = await db.slateWebhookRegistration.findUnique({
      where: { id: data.webhookRegistrationId },
      select: {
        id: true,
        type: true,
        status: true,
        owner: true,
        tenantOid: true,
        slateOid: true,
        triggerGroupOid: true,
        triggerGroup: { select: { key: true, spec: true } }
      }
    });
    if (!registration) return;
    if (registration.owner === 'tenant' && !registration.tenantOid) return;

    // A tenant-owned registration can only ever match that tenant's instances. A global
    // registration is a candidate for every tenant's instances, so it must rematch across all of them.
    let tenantFilter =
      registration.owner === 'tenant' ? { tenantOid: registration.tenantOid! } : undefined;

    let continueAfter = async (rows: { id: string }[]) => {
      if (rows.length < batchSize) return;
      await triggerWebhookRegistrationRematchQueue.add({
        webhookRegistrationId: data.webhookRegistrationId,
        cursor: rows[rows.length - 1]!.id
      });
    };

    if (isTriggerDeliveryConfig(registration)) {
      if (registration.status === 'deleted') {
        await continueAfter(
          await releaseConfigTargets({ configId: registration.id, cursor: data.cursor })
        );
      } else if (registration.status === 'active') {
        await continueAfter(
          await retryFailedTargets({
            slateOid: registration.slateOid,
            triggerGroupKey: registration.triggerGroup.key,
            tenantOid: tenantFilter?.tenantOid,
            cursor: data.cursor
          })
        );
      }
      return;
    }

    let instances = await db.triggerRegistrationInstance.findMany({
      where: {
        triggerRegistration: tenantFilter,

        // Same trigger group means we don't match polling or auto webhook
        // instances - so we don't need to worry about handling those here.
        triggerGroupOid: registration.triggerGroupOid,

        webhooks: { none: {} },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true }
    });
    if (instances.length === 0) return;

    await triggerRegistrationInstanceSetupQueue.addManyWithOps(
      instances.map(instance => ({
        data: { triggerRegistrationInstanceId: instance.id },
        opts: { id: instance.id }
      }))
    );

    await continueAfter(instances);
  });
