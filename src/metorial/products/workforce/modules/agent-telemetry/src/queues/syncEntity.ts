import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getGroundstation, ignoreNotFound } from '../internal/groundstation';
import { upsertOrganizationScope } from '../internal/scope';
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

export let syncEntityQueue = createQueue<EntitySyncTarget>({
  name: 'agent-telemetry/sync/entity',
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export let syncEntityQueueProcessor = syncEntityQueue.process(async data => {
  let groundstation = getGroundstation();
  if (!groundstation) return;

  if (data.type == 'consumer') {
    // Consumers merged into another one leave no row behind; the reconciler archives them.
    let consumer = await db.consumer.findUnique({
      where: { id: data.id },
      include: consumerInclude
    });
    if (!consumer || consumer.organization.status != 'active') return;

    let { organization } = consumer;

    await upsertOrganizationScope({ groundstation, organization });
    await groundstation.entity.upsert(consumerEntityInput({ organization, consumer }));
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

  await upsertOrganizationScope({ groundstation, organization });

  if (consumerDevice.status != 'active') {
    let entity = await ignoreNotFound(
      groundstation.entity.getByRef({
        organizationId: organization.id,
        kind: 'device',
        source: deviceEntitySource,
        ref: consumerDevice.id
      })
    );
    if (!entity || entity.status == 'archived' || entity.status == 'merged') return;

    await ignoreNotFound(
      groundstation.entity.archive({ organizationId: organization.id, entityId: entity.id })
    );
    return;
  }

  let user = await groundstation.entity.upsert(
    consumerEntityInput({ organization, consumer: consumerDevice.consumerProfile.consumer })
  );
  let device = await groundstation.entity.upsert(
    deviceEntityInput({ organization, consumerDevice })
  );

  await groundstation.link.upsert({
    organizationId: organization.id,
    fromId: device.id,
    toId: user.id,
    type: 'owned_by',
    origin: 'sync',
    reach: 'from_now'
  });

  await Promise.all(
    consumerDevice.clients.map(client =>
      groundstation.entity.upsert(clientAgentEntityInput({ organization, client }))
    )
  );
});
