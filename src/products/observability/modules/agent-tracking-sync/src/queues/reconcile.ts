import { createCron } from '@metorial/cron';
import { db, type Organization } from '@metorial/db';
import { detectionStaleBefore } from '@metorial/model-catalog/detection';
import {
  catalogAgentForMcpClient,
  mcpClientForCatalogAgent
} from '../definitions/clientFamilies';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import { getAgentTracking, ignoreNotFound, isAgentTrackingEnabled } from '../lib/client';
import { isAgentTrackingEnabledForOrganization, isAiToolDetectionFlagged } from '../lib/flag';
import { archivableStatuses, syncedEntitySources } from '../lib/mapping';
import { unlinkOrganizationTree } from '../lib/links';
import { backfillOrganizationQueue } from './backfill';
import { syncScopeQueue } from './syncScope';

let pageSize = 500;
let entityPageSize = 100;
let agentReconcileDelayMs = 60_000;

export let reconcileCron = createCron(
  { name: 'agent-tracking/reconcile/cron', cron: '0 3 * * *', startupJitterMs: 60_000 },
  async () => {
    if (!isAgentTrackingEnabled()) return;

    await reconcileManyQueue.add({});
  }
);

export let reconcileManyQueue = createQueue<{ cursor?: string }>({
  name: 'agent-tracking/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileManyQueueProcessor = reconcileManyQueue.process(async data => {
  let organizations = await db.organization.findMany({
    where: { id: data.cursor ? { gt: data.cursor } : undefined },
    orderBy: { id: 'asc' },
    take: pageSize,
    select: { id: true }
  });
  if (!organizations.length) return;

  await reconcileSingleQueue.addManyWithOps(
    organizations.map(organization => ({
      data: { organizationId: organization.id },
      opts: { id: organization.id }
    }))
  );

  if (organizations.length == pageSize) {
    await reconcileManyQueue.add(
      { cursor: organizations[organizations.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let reconcileSingleQueue = createQueue<{
  organizationId: string;
  backfillRoster?: boolean;
}>({
  name: 'agent-tracking/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let reconcileSingleQueueProcessor = reconcileSingleQueue.process(async data => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) return;

  let organization = await db.organization.findUnique({
    where: { id: data.organizationId },
    include: { agentTrackingSettings: true }
  });
  if (!organization) return;

  if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

  let linked = !!organization.agentTrackingLinkedAt;
  let target = { type: 'organization' as const, id: organization.id };

  if (organization.status != 'active') {
    if (linked) await syncScopeQueue.add(target);
    return;
  }

  if (linked) {
    let remote = await ignoreNotFound(
      agentTracking.organization.get({ organizationId: organization.id })
    );
    if (!remote) await unlinkOrganizationTree(organization);
    else if (organization.agentTrackingSettings) await syncScopeQueue.add(target);
  }

  await reconcileScopesQueue.addMany([
    { organizationId: organization.id, type: 'project' },
    { organizationId: organization.id, type: 'instance' }
  ]);
  await reconcileEntitiesQueue.addMany([
    { organizationId: organization.id, kind: 'user' },
    { organizationId: organization.id, kind: 'device' },
    { organizationId: organization.id, kind: 'agent' }
  ]);

  let backfillRoster =
    data.backfillRoster ||
    !!(await db.instance.findFirst({
      where: {
        organizationOid: organization.oid,
        OR: [
          { agentTrackingIngestSources: { some: { status: 'active' } } },
          { agentTrackingIngestTokens: { some: { status: 'active' } } }
        ]
      },
      select: { oid: true }
    }));
  if (backfillRoster) {
    await backfillOrganizationQueue.add(
      { organizationId: organization.id },
      { id: organization.id }
    );
  }
});

export let reconcileScopesQueue = createQueue<{
  organizationId: string;
  type: 'project' | 'instance';
  cursor?: string;
}>({
  name: 'agent-tracking/reconcile/scopes',
  workerOpts: { concurrency: 1 }
});

// Unlinked active scopes are left to their first use. A linked one with stored settings is
// pushed, so a settings push that never landed is applied within a day; a deleted one with a
// link is archived, which unlinks it.
let linkedWithSettingsOrDeletedWhere = <Active extends object>(active: Active) => ({
  OR: [
    {
      ...active,
      agentTrackingLinkedAt: { not: null },
      agentTrackingSettings: { isNot: null }
    },
    { NOT: active, agentTrackingLinkedAt: { not: null } }
  ]
});

export let reconcileScopesQueueProcessor = reconcileScopesQueue.process(async data => {
  let where = {
    organization: { id: data.organizationId },
    id: data.cursor ? { gt: data.cursor } : undefined
  };
  let query = { orderBy: { id: 'asc' as const }, take: pageSize, select: { id: true } };

  let scopes =
    data.type == 'project'
      ? await db.project.findMany({
          ...query,
          where: {
            ...where,
            ...linkedWithSettingsOrDeletedWhere({ status: 'active' as const })
          }
        })
      : await db.instance.findMany({
          ...query,
          where: {
            ...where,
            ...linkedWithSettingsOrDeletedWhere({
              status: 'active' as const,
              project: { status: 'active' as const }
            })
          }
        });
  if (!scopes.length) return;

  await syncScopeQueue.addMany(scopes.map(scope => ({ type: data.type, id: scope.id })));

  if (scopes.length == pageSize) {
    await reconcileScopesQueue.add(
      { ...data, cursor: scopes[scopes.length - 1]!.id },
      dailyPacedDelay()
    );
  }
});

export let reconcileEntitiesQueue = createQueue<{
  organizationId: string;
  kind: keyof typeof syncedEntitySources;
  after?: string;
}>({
  name: 'agent-tracking/reconcile/entities',
  workerOpts: { concurrency: 2, limiter: { max: 5, duration: 1000 } }
});

export let reconcileEntitiesQueueProcessor = reconcileEntitiesQueue.process(async data => {
  let agentTracking = getAgentTracking();
  if (!agentTracking) return;

  let organization = await db.organization.findUnique({ where: { id: data.organizationId } });
  if (!organization || organization.status != 'active') return;
  if (!(await isAgentTrackingEnabledForOrganization({ organization }))) return;

  let source = syncedEntitySources[data.kind];

  let page = await agentTracking.entity.list({
    organizationId: organization.id,
    kinds: [data.kind],
    statuses: [...archivableStatuses],
    limit: entityPageSize,
    after: data.after
  });

  // Agents seen in telemetry are kept: they exist for more than the sync.
  let synced = page.items.filter(
    item => item.source == source && item.ref && (data.kind != 'agent' || !item.lastSeenAt)
  );
  let refs = synced.map(item => item.ref!);

  let liveRefs =
    data.kind == 'agent'
      ? await liveAgentRefs({ organization, refs })
      : new Set(
          (data.kind == 'user'
            ? await db.consumer.findMany({
                where: { id: { in: refs }, organizationOid: organization.oid },
                select: { id: true }
              })
            : await db.consumerDevice.findMany({
                where: {
                  id: { in: refs },
                  status: 'active',
                  instance: { organizationOid: organization.oid }
                },
                select: { id: true }
              })
          ).map(row => row.id)
        );

  await Promise.all(
    synced
      .filter(item => !liveRefs.has(item.ref!))
      .map(item =>
        ignoreNotFound(
          agentTracking.entity.archive({ organizationId: organization.id, entityId: item.id })
        )
      )
  );

  let last = page.items[page.items.length - 1];
  if (page.pagination.has_more_after && last) {
    await reconcileEntitiesQueue.add({ ...data, after: last.id }, dailyPacedDelay());
  }
});

// An agent stays while any device of the organization configures it, or reports it with
// detection on and a report that isn't stale.
let liveAgentRefs = async (d: { organization: Organization; refs: string[] }) => {
  let configured = await db.mcpClientType.findMany({
    where: {
      key: { in: d.refs },
      consumerDeviceClients: {
        some: { consumerDevice: { instance: { organizationOid: d.organization.oid } } }
      }
    },
    select: { key: true }
  });
  let live = new Set(configured.map(clientType => clientType.key));

  let detected = await db.consumerDeviceDetection.findMany({
    where: {
      toolKey: { in: d.refs.map(ref => catalogAgentForMcpClient(ref) ?? ref) },
      goneAt: null,
      consumerDevice: {
        status: 'active',
        detectionReportedAt: { gte: detectionStaleBefore() }
      },
      instance: {
        organizationOid: d.organization.oid,
        consumerDeviceSettings: { is: { aiToolDetectionEnabled: true } }
      }
    },
    distinct: ['toolKey', 'instanceOid'],
    select: { toolKey: true, instance: { select: { project: true } } }
  });

  let flagged = new Map<bigint, Promise<boolean>>();
  for (let detection of detected) {
    let project = detection.instance.project;
    if (!flagged.has(project.oid)) {
      flagged.set(
        project.oid,
        isAiToolDetectionFlagged({ organization: d.organization, project })
      );
    }
    if (await flagged.get(project.oid)) {
      live.add(mcpClientForCatalogAgent(detection.toolKey) ?? detection.toolKey);
    }
  }

  return live;
};

// Batches the reconcile of agents after changes that can leave detected agents behind.
export let enqueueAgentReconcile = async (organizationId: string) =>
  await reconcileEntitiesQueue.add(
    { organizationId, kind: 'agent' },
    { id: `agents-${organizationId}`, delay: agentReconcileDelayMs }
  );

export let reconcileQueueProcessor = combineQueueProcessors([
  reconcileCron,
  reconcileManyQueueProcessor,
  reconcileSingleQueueProcessor,
  reconcileScopesQueueProcessor,
  reconcileEntitiesQueueProcessor
]);
