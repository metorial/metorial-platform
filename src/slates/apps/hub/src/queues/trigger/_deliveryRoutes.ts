import { createLock } from '@lowerdeck/lock';
import type { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { snowflake } from '../../id';

let DELIVERY_LOCK_SHARDS = 8;

let deliveryLock = createLock({
  name: 'shub/trg/delivery/lock',
  redisUrl: env.service.REDIS_URL
});

let deliveryLockOptions = { acquisitionTimeoutMs: 30_000 };

// A provider call can create the resource behind a shared routing key before its result is
// saved, so `isDeliveryShared` cannot see it yet. A registration holds one shard of its
// binding through the call and the saved result, so registrations still run in parallel;
// removing a provider resource holds every shard, which waits those registrations out.
export let usingDeliveryRegistrationLock = <T>(
  d: { bindingId: string | undefined; targetOid: bigint },
  fn: () => Promise<T>
) =>
  d.bindingId
    ? deliveryLock.usingLock(
        `${d.bindingId}:${d.targetOid % BigInt(DELIVERY_LOCK_SHARDS)}`,
        fn,
        deliveryLockOptions
      )
    : fn();

export let usingDeliveryRemovalLock = <T>(
  bindingId: string | null | undefined,
  fn: () => Promise<T>
) =>
  bindingId
    ? deliveryLock.usingLock(
        Array.from({ length: DELIVERY_LOCK_SHARDS }, (_, shard) => `${bindingId}:${shard}`),
        fn,
        deliveryLockOptions
      )
    : fn();

export let MISSING_ROUTING_KEYS_MESSAGE =
  'The provider did not say which deliveries belong to this webhook.';

// Managed delivery routes each push by key, so a registration without keys would never
// receive anything. Null means the provider result is unusable.
export let requireRoutingKeys = (
  delivery: { bindingId: string } | undefined,
  routingKeys: string[] | undefined
) => {
  if (!delivery) return [];
  return routingKeys?.length ? routingKeys : null;
};

export let replaceDeliveryRoutes = async (
  tx: Prisma.TransactionClient,
  d: { webhookRegistrationOid: bigint; bindingId: string | null; routingKeys: string[] }
) => {
  if (!d.bindingId) return;
  let bindingId = d.bindingId;

  await tx.triggerDeliveryRoute.deleteMany({
    where: { webhookRegistrationOid: d.webhookRegistrationOid }
  });
  if (!d.routingKeys.length) return;
  await tx.triggerDeliveryRoute.createMany({
    data: d.routingKeys.map(routingKey => ({
      oid: snowflake.nextId(),
      bindingId,
      routingKey,
      webhookRegistrationOid: d.webhookRegistrationOid
    })),
    skipDuplicates: true
  });
};

// The provider resource behind a routing key belongs to every registration holding the
// key, including one whose provider call succeeded but is not committed yet. Removing it
// for one of them would silence the others.
export let isDeliveryShared = async (d: {
  routes: { bindingId: string; routingKey: string }[];
  exceptWebhookRegistrationOid?: bigint;
  exceptTargetOid?: bigint;
  exceptOperationId?: string;
}) => {
  if (!d.routes.length) return false;

  let registrations = await db.triggerDeliveryRoute.count({
    where: {
      OR: d.routes,
      webhookRegistrationOid: d.exceptWebhookRegistrationOid
        ? { not: d.exceptWebhookRegistrationOid }
        : undefined,
      webhookRegistration: { status: 'active', triggerWebhookTarget: { status: 'active' } }
    }
  });
  if (registrations) return true;

  let uncommitted = await db.triggerWebhookRenewalResult.count({
    where: {
      OR: d.routes.map(route => ({
        deliveryBindingId: route.bindingId,
        routingKeys: { has: route.routingKey }
      })),
      targetOid: d.exceptTargetOid ? { not: d.exceptTargetOid } : undefined,
      operationId: d.exceptOperationId ? { not: d.exceptOperationId } : undefined
    }
  });

  return uncommitted > 0;
};
