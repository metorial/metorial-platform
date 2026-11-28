import { createQueueCheckpoint } from '@lowerdeck/queue-checkpoint';
import { db as subspaceDb } from '@metorial-subspace/db';
import { createCron } from '@metorial/cron';
import { db, type Instance, type Organization, type Project } from '@metorial/db';
import { resolveUsageSessionDimsMany } from '@metorial/module-usage';
import { combineQueueProcessors, createQueue, pacedDelay } from '@metorial/queue';
import { getAgentTracking, isAgentTrackingEnabled } from '../lib/client';
import { isAgentTrackingEnabledForOrganization } from '../lib/flag';
import { withInstanceScope } from '../lib/scope';
import { organizationSettingsOf, readOrganizationSettings } from '../lib/settings';
import {
  cursorOf,
  pushedMessageSelect,
  linkFailureOf,
  toolCallLinksOf,
  windowWhere,
  type ToolCallCursor
} from '../lib/toolCalls';

let instancePageSize = 500;
let linksPerUpsert = 200;
let commitLagMs = 30_000;
let maxLookbackMs = 7 * 24 * 60 * 60 * 1000;
let nextPageDelay = { baseMs: 1000, jitterMs: 1000 };

type ScanWindow = { since: string; upTo: string; after?: ToolCallCursor };

let checkpointPrefix = 'agent-tracking/tool-calls/';

let checkpointPrefixEnd = 'agent-tracking/tool-calls0';

let checkpointQueue = (instance: Pick<Instance, 'id'>) => `${checkpointPrefix}${instance.id}`;

let toolCallCheckpoint = (instance: Pick<Instance, 'id'>) =>
  createQueueCheckpoint({
    db,
    queue: checkpointQueue(instance),
    overlapMs: 0,
    maxLookbackMs
  });

let instanceJobOpts = (instanceOid: string | bigint) => ({
  deduplication: { id: `tool-calls-${instanceOid}`, keepLastIfActive: true }
});

let clearToolCallCheckpoint = async (instance: Pick<Instance, 'id'>) => {
  await db.queueCheckpoint.deleteMany({ where: { queue: checkpointQueue(instance) } });
};

let hasActiveCredential = async (instance: Pick<Instance, 'oid'>) => {
  let where = { instanceOid: instance.oid, status: 'active' as const };
  let [token, source] = await Promise.all([
    db.agentTrackingIngestToken.findFirst({ where, select: { oid: true } }),
    db.agentTrackingIngestSource.findFirst({ where, select: { oid: true } })
  ]);

  return !!token || !!source;
};

let databaseNow = async () => {
  let [row] = await subspaceDb.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
  return row!.now;
};

type ManyScan = { credential: 'token' | 'source' | 'checkpoint'; cursor?: string };

type TrackedInstance = Instance & { organization: Organization; project: Project };

let sweepCheckpoints = async (data: ManyScan) => {
  let rows = await db.queueCheckpoint.findMany({
    where: {
      queue: {
        ...(data.cursor ? { gt: data.cursor } : { gte: checkpointPrefix }),
        lt: checkpointPrefixEnd
      }
    },
    orderBy: { queue: 'asc' },
    take: instancePageSize,
    select: { queue: true }
  });
  if (!rows.length) return;

  let owned = rows.filter(row => row.queue.startsWith(checkpointPrefix));
  let instanceIds = owned.map(row => row.queue.slice(checkpointPrefix.length));
  let instances = await db.instance.findMany({
    where: { id: { in: instanceIds } },
    select: { id: true, oid: true }
  });
  let known = new Set(instances.map(instance => instance.id));
  let orphaned = owned.filter(row => !known.has(row.queue.slice(checkpointPrefix.length)));

  if (orphaned.length) {
    await db.queueCheckpoint.deleteMany({
      where: { queue: { in: orphaned.map(row => row.queue) } }
    });
  }

  if (instances.length) {
    await pushToolCallsInstanceQueue.addManyWithOps(
      instances.map(instance => ({
        data: { instanceOid: instance.oid.toString() },
        opts: instanceJobOpts(instance.oid)
      }))
    );
  }

  if (rows.length == instancePageSize) {
    await pushToolCallsManyQueue.add(
      { ...data, cursor: rows[rows.length - 1]!.queue },
      pacedDelay(nextPageDelay)
    );
  }
};

let scanCredentials = async (data: ManyScan) => {
  let where = {
    status: 'active' as const,
    instanceOid: data.cursor ? { gt: BigInt(data.cursor) } : undefined
  };
  let page = { orderBy: { instanceOid: 'asc' as const }, take: instancePageSize };

  let groups =
    data.credential == 'token'
      ? await db.agentTrackingIngestToken.groupBy({ by: ['instanceOid'], where, ...page })
      : await db.agentTrackingIngestSource.groupBy({ by: ['instanceOid'], where, ...page });
  if (!groups.length) return;

  await pushToolCallsInstanceQueue.addManyWithOps(
    groups.map(group => ({
      data: { instanceOid: group.instanceOid.toString() },
      opts: instanceJobOpts(group.instanceOid)
    }))
  );

  if (groups.length == instancePageSize) {
    await pushToolCallsManyQueue.add(
      { ...data, cursor: groups[groups.length - 1]!.instanceOid.toString() },
      pacedDelay(nextPageDelay)
    );
  }
};

let isTracked = async (instance: TrackedInstance) =>
  !!instance.agentTrackingLinkedAt &&
  instance.status == 'active' &&
  instance.organization.status == 'active' &&
  instance.project.status == 'active' &&
  (await hasActiveCredential(instance)) &&
  (await isAgentTrackingEnabledForOrganization({
    organization: instance.organization,
    project: instance.project
  }));

let openWindow = async (
  checkpoint: ReturnType<typeof toolCallCheckpoint>
): Promise<ScanWindow | null> => {
  let upTo = new Date((await databaseNow()).getTime() - commitLagMs);
  let since = await checkpoint.since();

  if (!since) {
    await checkpoint.commit(upTo);
    return null;
  }
  if (since >= upTo) return null;

  return { since: since.toISOString(), upTo: upTo.toISOString() };
};

let environmentOf = async (instance: Pick<Instance, 'subspaceEnvironmentId'>) =>
  instance.subspaceEnvironmentId
    ? await subspaceDb.environment.findUnique({
        where: { id: instance.subspaceEnvironmentId },
        select: { oid: true, tenantOid: true }
      })
    : null;

let listPushedMessages = async (d: {
  environment: { oid: bigint; tenantOid: bigint };
  window: ScanWindow;
}) =>
  await subspaceDb.sessionMessage.findMany({
    where: {
      tenantOid: d.environment.tenantOid,
      environmentOid: d.environment.oid,
      ...windowWhere(d.window),
      toolCall: {
        is: {
          tenantOid: d.environment.tenantOid,
          clientCallId: { not: null },
          clientCallSource: { not: null }
        }
      }
    },
    orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }],
    take: linksPerUpsert,
    select: pushedMessageSelect
  });

let pushLinks = async (d: {
  agentTracking: NonNullable<ReturnType<typeof getAgentTracking>>;
  instance: TrackedInstance;
  messages: Awaited<ReturnType<typeof listPushedMessages>>;
}) => {
  let instance = d.instance;
  let { organization, project } = instance;

  let [sessionDims, settings] = await Promise.all([
    resolveUsageSessionDimsMany(d.messages.map(message => message.session)),
    readOrganizationSettings(organization.id)
  ]);
  let links = toolCallLinksOf({
    messages: d.messages,
    sessionDims,
    toolDetails: organizationSettingsOf(organization, settings).desktop.toolDetails
  });
  if (!links.length) return 'continue' as const;

  let failure: ReturnType<typeof linkFailureOf>;

  await withInstanceScope({ organization, project, instance }, async () => {
    try {
      await d.agentTracking.toolCallLink.upsert({
        organizationId: organization.id,
        instanceId: instance.id,
        links
      });
    } catch (error) {
      failure = linkFailureOf(error);
      if (!failure) throw error;
    }
  });
  if (!failure) return 'continue' as const;

  console.warn(
    `[agent-tracking] tool call links of instance ${instance.id} failed with status ${failure.status}, ${failure.action == 'stop' ? 'stopping for now' : 'skipping the page'}`
  );

  return failure.action == 'stop' ? ('stop' as const) : ('continue' as const);
};

export let pushToolCallsCron = createCron(
  { name: 'agent-tracking/tool-calls/cron', cron: '*/5 * * * *' },
  async () => {
    if (!isAgentTrackingEnabled()) return;

    await pushToolCallsManyQueue.addMany([
      { credential: 'token' },
      { credential: 'source' },
      { credential: 'checkpoint' }
    ]);
  }
);

export let pushToolCallsManyQueue = createQueue<ManyScan>({
  name: 'agent-tracking/tool-calls/many',
  workerOpts: { concurrency: 1 }
});

export let pushToolCallsManyQueueProcessor = pushToolCallsManyQueue.process(async data => {
  if (data.credential == 'checkpoint') await sweepCheckpoints(data);
  else await scanCredentials(data);
});

export let pushToolCallsInstanceQueue = createQueue<{
  instanceOid: string;
  window?: ScanWindow;
}>({
  name: 'agent-tracking/tool-calls/instance',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

export let pushToolCallsInstanceQueueProcessor = pushToolCallsInstanceQueue.process(
  async data => {
    let agentTracking = getAgentTracking();
    if (!agentTracking) return;

    let instance = await db.instance.findUnique({
      where: { oid: BigInt(data.instanceOid) },
      include: { organization: true, project: true }
    });
    if (!instance) return;

    if (!(await isTracked(instance))) {
      await clearToolCallCheckpoint(instance);
      return;
    }

    let checkpoint = toolCallCheckpoint(instance);
    let window = data.window ?? (await openWindow(checkpoint));
    if (!window) return;

    let upTo = new Date(window.upTo);

    let environment = await environmentOf(instance);
    if (!environment) {
      await checkpoint.commit(upTo);
      return;
    }

    let messages = await listPushedMessages({ environment, window });
    if (messages.length) {
      let next = await pushLinks({ agentTracking, instance, messages });
      if (next == 'stop') return;
    }

    let last = messages[messages.length - 1];

    if (messages.length < linksPerUpsert || !last) {
      await checkpoint.commit(upTo);
      return;
    }

    await checkpoint.commit(last.createdAt);
    await pushToolCallsInstanceQueue.add(
      { instanceOid: data.instanceOid, window: { ...window, after: cursorOf(last) } },
      { ...pacedDelay(nextPageDelay), ...instanceJobOpts(data.instanceOid) }
    );
  }
);

export let pushToolCallsQueueProcessor = combineQueueProcessors([
  pushToolCallsCron,
  pushToolCallsManyQueueProcessor,
  pushToolCallsInstanceQueueProcessor
]);
