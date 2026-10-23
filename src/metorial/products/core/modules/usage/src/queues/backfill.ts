import { db } from '@metorial-subspace/db';
import { createCron } from '@metorial/cron';
import { db as metorialDb } from '@metorial/db';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { UsageMetricModel, USAGE_RETENTION_MS, type UsageMetric } from '../models';
import { getUsageBackfillState, updateUsageBackfillSource } from '../lib/backfillState';
import {
  accumulateUsageEvent,
  decodeUsageBucketKey,
  getUsageMetricId,
  type UsageAccumulatedBucket
} from '../lib/bucket';
import { isUsageEnabled, usageDbConnect } from '../lib/connection';
import {
  buildAuthErrorUsageEvent,
  buildAuthEventUsageEvent,
  buildConnectionTimeUsageEvent,
  buildConnectionUsageEvent,
  buildConsumerUsageEvent,
  buildMessageUsageEvent,
  buildSessionErrorUsageEvent,
  buildSessionUsageEvent
} from '../lib/events';
import {
  resolveUsageAgentIds,
  resolveUsageConsumersByActor,
  resolveUsageInstances,
  resolveUsageSessionDimsMany,
  type UsageInstanceRef,
  type UsageParticipantRef,
  type UsageSessionDims
} from '../lib/subspace';
import type { UsageEvent } from '../lib/types';

let BACKFILL_BATCH_SIZE = 500;
let BACKFILL_STALE_AFTER_MS = 30 * 60_000;

type BackfillWindow = { from: Date; cutoff: Date; cursor: bigint | null };

type BackfillPage = { lastOid: bigint | null; size: number; events: UsageEvent[] };

let oidAfter = (cursor: bigint | null) => (cursor === null ? undefined : { gt: cursor });

let resolveSessionContexts = async (
  rows: {
    instanceOid: bigint | null;
    session: { oid: bigint; id: string; identityActorOid?: bigint | null };
    identityActorOid?: bigint | null;
    participant?: UsageParticipantRef | null;
  }[]
) => {
  let [instances, sessions, consumers, getAgentId] = await Promise.all([
    resolveUsageInstances(rows.flatMap(row => (row.instanceOid ? [row.instanceOid] : []))),
    resolveUsageSessionDimsMany(rows.map(row => row.session)),
    resolveUsageConsumersByActor(
      rows.flatMap(row => {
        let actorOid = row.identityActorOid ?? row.session.identityActorOid;
        return actorOid ? [actorOid] : [];
      })
    ),
    resolveUsageAgentIds(rows.map(row => row.participant))
  ]);

  return (row: (typeof rows)[number]) => {
    let instance = row.instanceOid ? instances.get(row.instanceOid.toString()) : null;
    if (!instance) return null;

    let actorOid = row.identityActorOid ?? row.session.identityActorOid;

    return {
      instance,
      session: sessions.get(row.session.oid.toString()) as UsageSessionDims | undefined,
      consumerId: actorOid ? (consumers.get(actorOid.toString()) ?? null) : null,
      agentId: getAgentId(row.participant)
    };
  };
};

let resolveInstanceContexts = async (instanceOids: (bigint | null)[]) => {
  let instances = await resolveUsageInstances(instanceOids.flatMap(oid => (oid ? [oid] : [])));

  return (instanceOid: bigint | null): { instance: UsageInstanceRef } | null => {
    let instance = instanceOid ? instances.get(instanceOid.toString()) : null;
    return instance ? { instance } : null;
  };
};

let sessionSelect = { oid: true, id: true, identityActorOid: true } as const;
let participantSelect = {
  id: true,
  type: true,
  agentInstanceOid: true,
  identityActorOid: true
} as const;

let backfillSources: Record<string, (window: BackfillWindow) => Promise<BackfillPage>> = {
  session_message: async window => {
    let rows = await db.sessionMessage.findMany({
      where: {
        oid: oidAfter(window.cursor),
        createdAt: { gte: window.from, lt: window.cutoff },
        finalizedAt: { not: null },
        session: { isInternal: false }
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        oid: true,
        type: true,
        status: true,
        createdAt: true,
        completedAt: true,
        methodOrToolKey: true,
        instanceOid: true,
        session: { select: sessionSelect },
        senderParticipant: { select: participantSelect },
        sessionProvider: {
          select: { provider: { select: { id: true } }, deployment: { select: { id: true } } }
        },
        toolCall: { select: { tool: { select: { key: true } } } }
      }
    });

    let withParticipant = (row: (typeof rows)[number]) => ({
      ...row,
      identityActorOid: row.senderParticipant?.identityActorOid,
      participant: row.senderParticipant
    });
    let getContext = await resolveSessionContexts(rows.map(withParticipant));

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.flatMap(row => {
        let ctx = getContext(withParticipant(row));
        return ctx ? [buildMessageUsageEvent(row, ctx)] : [];
      })
    };
  },

  session: async window => {
    let rows = await db.session.findMany({
      where: {
        oid: oidAfter(window.cursor),
        createdAt: { gte: window.from, lt: window.cutoff },
        isInternal: false
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        ...sessionSelect,
        instanceOid: true,
        createdAt: true,
        providers: { select: { provider: { select: { id: true } } } }
      }
    });

    let getContext = await resolveSessionContexts(rows.map(row => ({ ...row, session: row })));

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.flatMap(row => {
        let ctx = getContext({ ...row, session: row });
        if (!ctx) return [];

        return [
          buildSessionUsageEvent(
            {
              createdAt: row.createdAt,
              providerIds: row.providers.map(provider => provider.provider.id)
            },
            ctx
          )
        ];
      })
    };
  },

  session_connection: async window => {
    let inWindow = { gte: window.from, lt: window.cutoff };

    let rows = await db.sessionConnection.findMany({
      where: {
        oid: oidAfter(window.cursor),
        isInternal: false,
        OR: [{ createdAt: inWindow }, { disconnectedAt: inWindow }]
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        oid: true,
        instanceOid: true,
        createdAt: true,
        disconnectedAt: true,
        lastConnectedAt: true,
        session: { select: sessionSelect },
        participant: { select: participantSelect }
      }
    });

    let withParticipant = (row: (typeof rows)[number]) => ({
      ...row,
      identityActorOid: row.participant?.identityActorOid
    });
    let getContext = await resolveSessionContexts(rows.map(withParticipant));
    let isInWindow = (date: Date | null) =>
      !!date && date >= window.from && date < window.cutoff;

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.flatMap(row => {
        let ctx = getContext(withParticipant(row));
        if (!ctx) return [];

        let events: UsageEvent[] = [];
        if (isInWindow(row.createdAt)) events.push(buildConnectionUsageEvent(row, ctx));

        if (row.disconnectedAt && isInWindow(row.disconnectedAt)) {
          events.push(
            buildConnectionTimeUsageEvent({ ...row, disconnectedAt: row.disconnectedAt }, ctx)
          );
        }

        return events;
      })
    };
  },

  session_error: async window => {
    let rows = await db.sessionError.findMany({
      where: {
        oid: oidAfter(window.cursor),
        createdAt: { gte: window.from, lt: window.cutoff },
        session: { isInternal: false }
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        oid: true,
        type: true,
        createdAt: true,
        instanceOid: true,
        session: { select: sessionSelect },
        providerRun: { select: { provider: { select: { id: true } } } }
      }
    });

    let getContext = await resolveSessionContexts(rows);

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.flatMap(row => {
        let ctx = getContext(row);
        return ctx ? [buildSessionErrorUsageEvent(row, ctx)] : [];
      })
    };
  },

  auth_event: async window => {
    let rows = await db.providerAuthConfigEvent.findMany({
      where: {
        oid: oidAfter(window.cursor),
        createdAt: { gte: window.from, lt: window.cutoff }
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        oid: true,
        status: true,
        createdAt: true,
        instanceOid: true,
        provider: { select: { id: true } }
      }
    });

    let getContext = await resolveInstanceContexts(rows.map(row => row.instanceOid));

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.flatMap(row => {
        let ctx = getContext(row.instanceOid);
        return ctx ? [buildAuthEventUsageEvent(row, ctx)] : [];
      })
    };
  },

  auth_error: async window => {
    let rows = await db.providerAuthConfigError.findMany({
      where: {
        oid: oidAfter(window.cursor),
        createdAt: { gte: window.from, lt: window.cutoff }
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        oid: true,
        type: true,
        createdAt: true,
        instanceOid: true,
        provider: { select: { id: true } }
      }
    });

    let getContext = await resolveInstanceContexts(rows.map(row => row.instanceOid));

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.flatMap(row => {
        let ctx = getContext(row.instanceOid);
        return ctx ? [buildAuthErrorUsageEvent(row, ctx)] : [];
      })
    };
  },

  consumer: async window => {
    let rows = await metorialDb.instanceConsumer.findMany({
      where: {
        oid: oidAfter(window.cursor),
        createdAt: { gte: window.from, lt: window.cutoff }
      },
      orderBy: { oid: 'asc' },
      take: BACKFILL_BATCH_SIZE,
      select: {
        oid: true,
        id: true,
        createdAt: true,
        instance: { select: { id: true, organization: { select: { id: true } } } }
      }
    });

    return {
      lastOid: rows.at(-1)?.oid ?? null,
      size: rows.length,
      events: rows.map(row =>
        buildConsumerUsageEvent(
          { consumerId: row.id, createdAt: row.createdAt },
          {
            instance: {
              instanceId: row.instance.id,
              organizationId: row.instance.organization.id
            }
          }
        )
      )
    };
  }
};

let backfillSourceNames = Object.keys(backfillSources);

let getBackfillJobId = (source: string, cursor: string | null, suffix?: number) =>
  ['usage-backfill', source, cursor ?? 'start', ...(suffix ? [suffix] : [])].join('-');

export let usageBackfillPageQueue = createQueue<{ source: string; cursor: string | null }>({
  name: 'usage/backfill/page',
  workerOpts: { concurrency: 2, limiter: { max: 5, duration: 1000 } }
});

export let usageBackfillCron = createCron(
  { name: 'usage/backfill/cron', cron: '*/10 * * * *' },
  async () => {
    if (!isUsageEnabled()) return;

    let state = await getUsageBackfillState();
    if (!state) return;

    let now = Date.now();
    let pending = backfillSourceNames.flatMap(source => {
      let sourceState = state.sources?.[source];
      if (sourceState?.done) return [];

      let isStale =
        !!sourceState &&
        now - new Date(sourceState.updatedAt).getTime() > BACKFILL_STALE_AFTER_MS;
      let cursor = sourceState?.cursor ?? null;

      return [
        {
          data: { source, cursor },
          opts: { id: getBackfillJobId(source, cursor, isStale ? now : undefined) }
        }
      ];
    });

    if (pending.length) await usageBackfillPageQueue.addManyWithOps(pending);
  }
);

export let usageBackfillPageProcessor = usageBackfillPageQueue.process(async data => {
  let fetchPage = backfillSources[data.source];
  if (!fetchPage) return;

  let state = await getUsageBackfillState();
  if (!state || state.sources?.[data.source]?.done) return;

  let cutoff = new Date(state.cutoff);
  let page = await fetchPage({
    from: new Date(cutoff.getTime() - USAGE_RETENTION_MS),
    cutoff,
    cursor: data.cursor ? BigInt(data.cursor) : null
  });

  let buckets = new Map<string, UsageAccumulatedBucket>();
  for (let event of page.events) accumulateUsageEvent(buckets, event);

  await usageDbConnect();

  let documents = [...buckets.values()].map(
    (bucket): UsageMetric => ({
      _id: getUsageMetricId([
        'backfill',
        data.source,
        data.cursor ?? 'start',
        bucket.minute,
        bucket.field
      ]),
      ts: new Date(bucket.minute),
      source: 'backfill',
      ...decodeUsageBucketKey(bucket.field),
      ...bucket.counters
    })
  );

  if (documents.length) {
    await UsageMetricModel.bulkWrite(
      documents.map(document => ({
        updateOne: { filter: { _id: document._id }, update: { $set: document }, upsert: true }
      })),
      { ordered: false }
    );
  }

  let nextCursor = page.lastOid?.toString() ?? data.cursor;
  let isDone = page.size < BACKFILL_BATCH_SIZE;

  await updateUsageBackfillSource(data.source, { done: isDone, cursor: nextCursor });

  if (!isDone) {
    await usageBackfillPageQueue.add(
      { source: data.source, cursor: nextCursor },
      { id: getBackfillJobId(data.source, nextCursor), ...hourlyPacedDelay() }
    );
  }
});

export let usageBackfillProcessors = combineQueueProcessors([
  usageBackfillCron,
  usageBackfillPageProcessor
]);
