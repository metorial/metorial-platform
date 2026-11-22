import { db } from '@metorial/db';
import { findDetectionTool, isDetectionReportStale } from '@metorial/model-catalog/detection';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { getAgentTracking, ignoreNotFound } from '../lib/client';
import {
  isAgentTrackingEnabledForOrganization,
  isAiToolDetectionOnForInstance
} from '../lib/flag';
import { withOrganizationScope } from '../lib/scope';
import {
  clientAgentEntityInput,
  consumerEntityInput,
  detectedAgentEntityInput,
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

    await withOrganizationScope({ organization }, async () => {
      await agentTracking.entity.upsert(consumerEntityInput({ organization, consumer }));
    });
    return;
  }

  let consumerDevice = await db.consumerDevice.findUnique({
    where: { id: data.id },
    include: {
      instance: { include: { organization: true, project: true } },
      consumerProfile: { include: { consumer: { include: consumerInclude } } },
      clients: {
        where: { reported: true, detected: true },
        include: { mcpClientType: true }
      },
      detections: { where: { goneAt: null } }
    }
  });
  if (!consumerDevice || consumerDevice.instance.organization.status != 'active') return;

  let { organization } = consumerDevice.instance;
  if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

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

  let detections =
    consumerDevice.detections.length &&
    !isDetectionReportStale(consumerDevice.detectionReportedAt) &&
    (await isAiToolDetectionOnForInstance({
      organization,
      project: consumerDevice.instance.project,
      instanceOid: consumerDevice.instanceOid
    }))
      ? consumerDevice.detections
      : [];

  await withOrganizationScope({ organization }, async () => {
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

    let agents = new Map(
      consumerDevice.clients.map(client => {
        let input = clientAgentEntityInput({ organization, client });
        return [input.ref, input];
      })
    );
    for (let detection of detections) {
      let tool = findDetectionTool(detection.toolKey);
      if (!tool) continue;

      let input = detectedAgentEntityInput({ organization, tool });
      if (!agents.has(input.ref)) agents.set(input.ref, input);
    }

    await Promise.all([...agents.values()].map(input => agentTracking.entity.upsert(input)));
  });
};

export let syncEntityQueueProcessor = combineQueueProcessors([
  syncEntityQueue.process(syncEntity),
  backfillSyncEntityQueue.process(syncEntity)
]);
