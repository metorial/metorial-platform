import { randomUUID } from 'node:crypto';
import { createCron } from '@lowerdeck/cron';
import { createQueue, QueueRetryError, combineQueueProcessors } from '@lowerdeck/queue';
import { createClient } from '@lowerdeck/rpc-client';
import { db, getId, type Prisma } from '@metorial-subspace/db';
import { env } from '../../env';
import {
  buildProvisionedBindingProjection,
  buildProvisionedRouteProjection,
  digestProvisionedProjection,
  type ProvisionedBindingProjectionV1,
  type ProvisionedRouteProjectionV1
} from '../../services/provisionedTenantApp';

let slatesHubSubspaceSecretKeyIdHeader = 'metorial-subspace-secret-key-id';

type ProjectionEnvelope = {
  projection: ProvisionedRouteProjectionV1 | ProvisionedBindingProjectionV1;
  projectionDigest: string;
  correlationId: string;
  idempotencyKey: string;
};

export interface ProvisionedAppHubProjectionTransport {
  projectProvisionedAppRoute(d: ProjectionEnvelope): Promise<{
    generation: number;
    projectionDigest: string;
    idempotent: boolean;
  }>;
  projectProvisionedTenantApp(d: ProjectionEnvelope): Promise<{
    generation: number;
    projectionDigest: string;
    idempotent: boolean;
  }>;
  getProvisionedAppProjectionState(d: {
    entityKind: 'route' | 'binding';
    entityId: string;
  }): Promise<{ generation: number; projectionDigest: string } | null>;
}

let configuredTransport: ProvisionedAppHubProjectionTransport | null = null;
let defaultTransport: ProvisionedAppHubProjectionTransport | null = null;
export let configureProvisionedAppHubProjectionTransport = (
  transport: ProvisionedAppHubProjectionTransport | null
) => {
  configuredTransport = transport;
};

let getTransport = () => {
  if (configuredTransport) return configuredTransport;
  if (defaultTransport) return defaultTransport;
  let endpoint = env.service.SLATES_HUB_SECRET_RPC_URL;
  let token = env.service.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT;
  if (!endpoint || !token) {
    throw new Error('Authenticated Hub projection transport is not configured');
  }
  defaultTransport = createClient<ProvisionedAppHubProjectionTransport>({
    endpoint,
    getHeaders: () => ({ [slatesHubSubspaceSecretKeyIdHeader]: 'current' }),
    getSignatureToken: () => token,
    timeoutMs: 15_000
  });
  return defaultTransport;
};

let LEASE_MS = 30_000;
let safeErrorCode = (error: unknown) => {
  let message = error instanceof Error ? error.message : '';
  if (message.includes('generation')) return 'projection_generation_rejected';
  if (message.includes('digest')) return 'projection_digest_conflict';
  if (message.includes('auth')) return 'projection_authentication_failed';
  return 'projection_transport_failed';
};

export let processProvisionedProjectionOutbox = async (outboxId: string, now = new Date()) => {
  let current = await db.provisionedAppProjectionOutbox.findUnique({
    where: { id: outboxId }
  });
  if (!current || current.status === 'delivered') return { status: 'already_delivered' };
  let deliveryToken = randomUUID();
  let claimed = await db.provisionedAppProjectionOutbox.updateMany({
    where: {
      oid: current.oid,
      status: { in: ['pending', 'delivering'] },
      OR: [
        { status: 'pending' },
        { deliveryLeaseExpiresAt: null },
        { deliveryLeaseExpiresAt: { lte: now } }
      ]
    },
    data: {
      status: 'delivering',
      deliveryToken,
      deliveryLeaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      lastAttemptAt: now,
      attemptCount: { increment: 1 },
      lastErrorCode: null
    }
  });
  if (claimed.count !== 1) return { status: 'leased' };

  try {
    let envelope: ProjectionEnvelope = {
      projection: current.payload as unknown as ProjectionEnvelope['projection'],
      projectionDigest: current.projectionDigest,
      correlationId: current.correlationId,
      idempotencyKey: current.idempotencyKey
    };
    let response =
      current.entityKind === 'route'
        ? await getTransport().projectProvisionedAppRoute(envelope)
        : await getTransport().projectProvisionedTenantApp(envelope);
    if (
      response.generation !== current.generation ||
      response.projectionDigest !== current.projectionDigest
    ) {
      throw new Error('projection digest or generation acknowledgement mismatch');
    }
    let deliveredAt = new Date();
    let delivered = await db.provisionedAppProjectionOutbox.updateMany({
      where: {
        oid: current.oid,
        status: 'delivering',
        deliveryToken,
        deliveryLeaseExpiresAt: { gt: deliveredAt }
      },
      data: {
        status: 'delivered',
        deliveryToken: null,
        deliveryLeaseExpiresAt: null,
        deliveredAt,
        lastErrorCode: null
      }
    });
    if (delivered.count !== 1) throw new Error('projection delivery lease lost');
    return { status: 'delivered', idempotent: response.idempotent };
  } catch (error) {
    await db.provisionedAppProjectionOutbox.updateMany({
      where: { oid: current.oid, status: 'delivering', deliveryToken },
      data: {
        status: 'pending',
        deliveryToken: null,
        deliveryLeaseExpiresAt: null,
        lastErrorCode: safeErrorCode(error)
      }
    });
    throw error;
  }
};

export let provisionTenantAppProjectionQueue = createQueue<{ outboxId: string }>({
  name: 'auth/provisioned-app/project',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5 }
});

export let provisionTenantAppProjectionQueueProcessor =
  provisionTenantAppProjectionQueue.process(async data => {
    try {
      await processProvisionedProjectionOutbox(data.outboxId);
    } catch {
      throw new QueueRetryError();
    }
  });

export let ensureProjectionOutbox = async (d: {
  projection: ProvisionedRouteProjectionV1 | ProvisionedBindingProjectionV1;
  storedDigest: string;
}) => {
  let entityId =
    d.projection.entityKind === 'route'
      ? d.projection.provisionedRouteId
      : d.projection.provisionedTenantAppId;
  let digest = digestProvisionedProjection(d.projection);
  if (digest !== d.storedDigest) {
    throw new Error('Authoritative projection digest drift');
  }
  let state = await getTransport().getProvisionedAppProjectionState({
    entityKind: d.projection.entityKind,
    entityId
  });
  if (state?.generation === d.projection.generation && state.projectionDigest === digest) {
    await db.provisionedAppProjectionOutbox.updateMany({
      where: {
        entityKind: d.projection.entityKind,
        entityId,
        generation: d.projection.generation,
        projectionDigest: digest
      },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        deliveryToken: null,
        deliveryLeaseExpiresAt: null,
        lastErrorCode: null
      }
    });
    return;
  }
  if (state && state.generation >= d.projection.generation) {
    throw new Error('Hub projection generation/digest conflict requires operator review');
  }
  let existing = await db.provisionedAppProjectionOutbox.findFirst({
    where: {
      entityKind: d.projection.entityKind,
      entityId,
      generation: { gt: state?.generation ?? 0 }
    },
    orderBy: { generation: 'asc' }
  });
  if (existing) {
    let expectedGeneration = state
      ? state.generation + 1
      : d.projection.entityKind === 'route'
        ? 1
        : existing.generation;
    let existingProjection = existing.payload as unknown as
      | ProvisionedRouteProjectionV1
      | ProvisionedBindingProjectionV1;
    if (
      existing.entityKind !== d.projection.entityKind ||
      existing.entityId !== entityId ||
      existing.generation !== expectedGeneration ||
      existing.generation > d.projection.generation ||
      digestProvisionedProjection(existingProjection) !== existing.projectionDigest
    ) {
      throw new Error('Historical projection outbox integrity check failed');
    }
    let row = await db.provisionedAppProjectionOutbox.update({
      where: { oid: existing.oid },
      data: {
        status: 'pending',
        deliveryToken: null,
        deliveryLeaseExpiresAt: null,
        lastErrorCode: null
      }
    });
    await provisionTenantAppProjectionQueue.add(
      { outboxId: row.id },
      { id: `provisioned-projection-${row.id}` }
    );
    return;
  }
  let seedableGeneration = state
    ? state.generation + 1
    : d.projection.entityKind === 'route'
      ? 1
      : d.projection.generation;
  if (seedableGeneration !== d.projection.generation) {
    throw new Error('Historical projection outbox is missing and cannot be reconstructed');
  }
  let correlationId = randomUUID();
  let idempotencyKey = `provisioned-projection/v1:${d.projection.entityKind}:${entityId}:${d.projection.generation}:${digest}`;
  let row = await db.provisionedAppProjectionOutbox.create({
    data: {
      ...getId('provisionedAppProjectionOutbox'),
      entityKind: d.projection.entityKind,
      entityId,
      generation: d.projection.generation,
      projectionDigest: digest,
      correlationId,
      idempotencyKey,
      tombstone: d.projection.tombstone,
      payload: d.projection as Prisma.InputJsonValue
    }
  });
  await provisionTenantAppProjectionQueue.add(
    { outboxId: row.id },
    { id: `provisioned-projection-${row.id}` }
  );
};

export let reconcileProvisionedAppProjections = async () => {
  let routes = await db.provisionedVendorAppRoute.findMany();
  for (let route of routes) {
    await ensureProjectionOutbox({
      projection: buildProvisionedRouteProjection(route),
      storedDigest: route.projectionDigest
    });
  }
  let bindings = await db.provisionedTenantApp.findMany({
    include: { tenant: true, callbackInstance: true, vendorAppRoute: true }
  });
  for (let binding of bindings) {
    await ensureProjectionOutbox({
      projection: buildProvisionedBindingProjection(binding),
      storedDigest: binding.projectionDigest
    });
  }
};

export let reconcileProvisionedAppProjectionCron = createCron(
  {
    name: 'auth/provisioned-app/reconcile',
    cron: '*/5 * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => await reconcileProvisionedAppProjections()
);

export let provisionTenantAppLifecycleQueues = combineQueueProcessors([
  provisionTenantAppProjectionQueueProcessor,
  reconcileProvisionedAppProjectionCron
]);
