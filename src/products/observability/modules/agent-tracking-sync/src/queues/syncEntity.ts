import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getAgentTracking, ignoreNotFound } from '../lib/client';
import { isAgentTrackingEnabledForOrganization } from '../lib/flag';
import { upsertOrganizationScope } from '../lib/scope';
import {
  clientAgentEntityInput,
  consumerEntityInput,
  deviceEntityInput,
  deviceEntitySource
} from '../lib/mapping';

export type EntitySyncTarget = { type: 'consumer' | 'device'; id: string };

let consumerInclude = {
  organization: true,
  profiles: true,
  instanceConsumers: true
} as const;

let syncEntityLimiter = { max: 20, duration: 1000 };

// Backfills have their own queue so a roster scan never delays a live member or device sync.
export let backfillSyncEntityLimiter = { max: 10, duration: 1000 };

export let syncEntityQueue = createQueue<EntitySyncTarget>({
  name: 'agent-tracking/sync/entity',
  workerOpts: { concurrency: 5, limiter: syncEntityLimiter }
});

export let backfillSyncEntityQueue = createQueue<EntitySyncTarget>({
  name: 'agent-tracking/sync/entity/backfill',
  workerOpts: { concurrency: 2, limiter: backfillSyncEntityLimiter }
});

let syncEntity = async (data: EntitySyncTarget) => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) return;

  if (data.type == 'consumer') {
    // Consumers merged into another one leave no row behind; the reconciler archives them.
    let consumer = await db.consumer.findUnique({
      where: { id: data.id },
      include: consumerInclude
    });
    if (!consumer || consumer.organization.status != 'active') return;

    let { organization } = consumer;
    if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

    await upsertOrganizationScope({ agentTracking, organization });
    await agentTracking.entity.upsert(consumerEntityInput({ organization, consumer }));
    return;
  }

  let consumerDevice = await db.consumerDevice.findUnique({
    where: { id: data.id },
    include: {
      instance: { include: { organization: true } },
      consumerProfile: { include: { consumer: { include: consumerInclude } } },
      clients: {
        where: { reported: true, detected: true },
        include: { mcpClientType: true }
      }
    }
  });
  if (!consumerDevice || consumerDevice.instance.organization.status != 'active') return;

  let { organization } = consumerDevice.instance;
  if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

  await upsertOrganizationScope({ agentTracking, organization });

  if (consumerDevice.status != 'active') {
    let entity = await ignoreNotFound(
      agentTracking.entity.getByRef({
        organizationId: organization.id,
        kind: 'device',
        source: deviceEntitySource,
        ref: consumerDevice.id
      })
    );
    if (!entity || entity.status == 'archived' || entity.status == 'merged') return;

    await ignoreNotFound(
      agentTracking.entity.archive({ organizationId: organization.id, entityId: entity.id })
    );
    return;
  }

  let user = await agentTracking.entity.upsert(
    consumerEntityInput({ organization, consumer: consumerDevice.consumerProfile.consumer })
  );
  let device = await agentTracking.entity.upsert(
    deviceEntityInput({ organization, consumerDevice })
  );

  await agentTracking.link.upsert({
    organizationId: organization.id,
    fromId: device.id,
    toId: user.id,
    type: 'owned_by',
    origin: 'sync',
    reach: 'from_now'
  });

  await Promise.all(
    consumerDevice.clients.map(client =>
      agentTracking.entity.upsert(clientAgentEntityInput({ organization, client }))
    )
  );
};

export let syncEntityQueueProcessor = combineQueueProcessors([
  syncEntityQueue.process(syncEntity),
  backfillSyncEntityQueue.process(syncEntity)
]);
