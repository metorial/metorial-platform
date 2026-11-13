import { resolveSessionAttribution } from '../attribution/resolve';
import { getKnowledge } from '../knowledge/cache';
import { maybeClassifySession } from '../classification/trigger';
import { writeSessionFacts } from '../facts/write';
import { queueSessionSettle } from '../queues/sessionSettle';
import { getRuntime } from '../runtime';
import { getStore } from '../store/connection';
import type { SessionDocument } from '../store/derivedModels';
import { isSummaryStale } from './freshness';
import { orphanKey, type Correlation } from './keys';
import { sessionEvents } from './records';
import { summaryLockKey, tryRedis } from './redis';
import { aggregateSession, type SessionAggregate } from './summary';
import { SUMMARY_VERSION } from './versions';

let summaryLockSeconds = 60;

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

export let computeSessionAggregate = async (
  session: SessionDocument,
  correlationsSince?: Date
) =>
  aggregateSession({
    records: await sessionEvents({
      organizationId: session.organizationId,
      sessionKey: session._id
    }),
    family: session.client.family,
    catalog: await getKnowledge(),
    correlationsSince
  });

// The watermark is the session's lastObservedAt read before aggregating, so records that arrive
// mid-aggregation leave the summary stale instead of being marked as included.
export let storeSessionSummary = async (d: {
  session: SessionDocument;
  aggregate: SessionAggregate;
  watermark: Date;
}) => {
  let { sessions } = await collections();
  let { coverage } = d.aggregate;

  let set = {
    summary: d.aggregate.summary,
    summaryWatermark: d.watermark,
    'coverage.hasUsage': coverage.hasUsage,
    'coverage.hasContext': coverage.hasContext,
    'coverage.hasRepo': coverage.hasRepo,
    'versions.summary': SUMMARY_VERSION,
    ...(coverage.usageSource ? { 'coverage.usageSource': coverage.usageSource } : {})
  };

  await sessions.updateOne(
    {
      _id: d.session._id,
      $or: [
        { summaryWatermark: { $exists: false } },
        { summaryWatermark: { $lte: d.watermark } }
      ]
    },
    {
      $set: set,
      ...(coverage.usageSource ? {} : { $unset: { 'coverage.usageSource': '' } })
    } as never
  );

  return {
    ...d.session,
    summary: d.aggregate.summary,
    summaryWatermark: d.watermark,
    coverage: { fullyAttributed: d.session.coverage?.fullyAttributed ?? false, ...coverage },
    versions: { ...d.session.versions, summary: SUMMARY_VERSION }
  } satisfies SessionDocument;
};

// Records that carried a correlation id before any session claimed it were registered as orphans;
// once this session holds that id, they move here. Records already in another native or linked
// session stay where they are.
let linkOrphans = async (session: SessionDocument, correlations: Correlation[]) => {
  if (getRuntime().memorySink || !correlations.length) return 0;

  let { events, sessionLinks, sessions } = await collections();

  let orphans = await sessionLinks
    .find(
      {
        _id: {
          $in: correlations.map(correlation => orphanKey(session.instanceId, correlation))
        }
      },
      { projection: { recordIds: 1 } }
    )
    .toArray();
  if (!orphans.length) return 0;

  let recordIds = [...new Set(orphans.flatMap(orphan => orphan.recordIds ?? []))];

  let movable = {
    organizationId: session.organizationId,
    instanceId: session.instanceId,
    $or: [
      { 'ctx.sessionKey': { $exists: false } },
      { 'ctx.sessionOrigin': 'inferred', 'ctx.sessionKey': { $ne: session._id } }
    ]
  };

  let records = recordIds.length
    ? await events
        .find(
          { _id: { $in: recordIds }, ...movable },
          { projection: { occurredAt: 1, 'ctx.sessionKey': 1 } }
        )
        .toArray()
    : [];

  if (records.length) {
    await events.updateMany(
      { _id: { $in: records.map(record => record._id) }, ...movable },
      { $set: { 'ctx.sessionKey': session._id, 'ctx.sessionOrigin': 'linked' } }
    );

    let times = records.map(record => record.occurredAt.getTime());

    await sessions.updateOne(
      { _id: session._id },
      {
        $min: { startedAt: new Date(Math.min(...times)) },
        $max: { lastActivityAt: new Date(Math.max(...times)) }
      }
    );

    let previous = [
      ...new Set(
        records.flatMap(record => (record.ctx?.sessionKey ? [record.ctx.sessionKey] : []))
      )
    ];
    if (previous.length) await queueSessionSettle(previous);
  }

  await sessionLinks.deleteMany({ _id: { $in: orphans.map(orphan => orphan._id) } });

  return records.length;
};

// While another caller holds the lock the stale summary is returned; without Redis every caller
// aggregates, which is correct, only slower.
export let refreshSessionSummary = async (session: SessionDocument) => {
  if (session.frozen || !isSummaryStale(session)) return session;

  let lockKey = summaryLockKey(session._id);
  let locked = await tryRedis(
    async redis => (await redis.set(lockKey, '1', 'EX', summaryLockSeconds, 'NX')) == 'OK'
  );
  if (locked === false) return session;

  try {
    let aggregate = await computeSessionAggregate(session);
    return await storeSessionSummary({
      session,
      aggregate,
      watermark: session.lastObservedAt
    });
  } finally {
    if (locked) await tryRedis(redis => redis.del(lockKey));
  }
};

export let settleSession = async (d: { sessionKey: string }) => {
  let { sessions } = await collections();

  let session = await sessions.findOne({ _id: d.sessionKey });
  if (!session || session.frozen) return;

  let startedAt = new Date();
  let watermark = session.lastObservedAt;
  let previouslySettled = session.settledObservedAt;

  let aggregate = await computeSessionAggregate(session, previouslySettled);

  if (await linkOrphans(session, aggregate.correlations)) {
    session = (await sessions.findOne({ _id: d.sessionKey })) ?? session;
    aggregate = await computeSessionAggregate(session);
  }

  if (!aggregate.records && session.origin == 'inferred') {
    await writeSessionFacts({ sessionKey: session._id, slices: [] });
    await sessions.deleteOne({ _id: session._id, lastObservedAt: watermark });
    return;
  }

  await storeSessionSummary({ session, aggregate, watermark });
  await resolveSessionAttribution({ sessionKey: session._id });
  await writeSessionFacts({ sessionKey: session._id, slices: aggregate.slices });

  await sessions.updateOne({ _id: session._id }, { $max: { settledObservedAt: watermark } });
  await sessions.updateOne(
    {
      _id: session._id,
      lastObservedAt: watermark,
      settlePending: true,
      factsComputedAt: { $gte: startedAt }
    },
    { $unset: { settlePending: '' } }
  );

  let lastTurn = aggregate.lastTurnObservedAt;
  if (lastTurn && (!previouslySettled || lastTurn > previouslySettled)) {
    await maybeClassifySession({ sessionKey: session._id, reason: 'turn_completed' });
  }
};
