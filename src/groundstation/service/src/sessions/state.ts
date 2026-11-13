import { maybeClassifySession } from '../classification/trigger';
import { queueSessionSettle } from '../queues/sessionSettle';
import { getStore } from '../store/connection';

let minuteMs = 60 * 1000;

let hourMs = 60 * minuteMs;

export let idleAfterMs = 30 * minuteMs;

export let endAfterIdleMs = 24 * hourMs;

export let reconcileWindowMs = 48 * hourMs;

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

export let idleSessions = async (d: { now: Date; limit: number }) => {
  let { sessions } = await collections();
  let cutoff = new Date(d.now.getTime() - idleAfterMs);

  let found = await sessions
    .find(
      { state: 'active', lastActivityAt: { $lt: cutoff } },
      { projection: { _id: 1 }, sort: { state: 1, lastActivityAt: 1 }, limit: d.limit }
    )
    .toArray();
  if (!found.length) return 0;

  let ids = found.map(session => session._id);

  await sessions.updateMany(
    { _id: { $in: ids }, state: 'active', lastActivityAt: { $lt: cutoff } },
    { $set: { state: 'idle' } }
  );

  for (let sessionKey of ids) await maybeClassifySession({ sessionKey, reason: 'idle' });

  return found.length;
};

export let endIdleSessions = async (d: { now: Date; limit: number }) => {
  let { sessions } = await collections();
  let cutoff = new Date(d.now.getTime() - idleAfterMs - endAfterIdleMs);

  let found = await sessions
    .find(
      { state: 'idle', lastActivityAt: { $lt: cutoff } },
      {
        projection: { _id: 1, lastActivityAt: 1 },
        sort: { state: 1, lastActivityAt: 1 },
        limit: d.limit
      }
    )
    .toArray();
  if (!found.length) return 0;

  await sessions.bulkWrite(
    found.map(session => ({
      updateOne: {
        filter: { _id: session._id, state: 'idle', lastActivityAt: { $lt: cutoff } },
        update: { $set: { state: 'ended', endedAt: session.lastActivityAt } }
      }
    })),
    { ordered: false }
  );

  return found.length;
};

export type ReconcileCursor = { lastActivityAt: string; sessionKey: string };

// settlePending is set by every write and cleared by a settle that covered that write, so a set
// flag means the session's facts are older than its records.
export let requeueUnsettledSessions = async (d: {
  now: Date;
  limit: number;
  cursor?: ReconcileCursor;
}) => {
  let { sessions } = await collections();
  let since = new Date(d.now.getTime() - reconcileWindowMs);

  let after = d.cursor
    ? {
        $or: [
          { lastActivityAt: { $gt: new Date(d.cursor.lastActivityAt) } },
          {
            lastActivityAt: new Date(d.cursor.lastActivityAt),
            _id: { $gt: d.cursor.sessionKey }
          }
        ]
      }
    : {};

  let found = await sessions
    .find(
      { settlePending: true, lastActivityAt: { $gte: since }, ...after },
      {
        projection: { _id: 1, lastActivityAt: 1 },
        sort: { lastActivityAt: 1, _id: 1 },
        limit: d.limit
      }
    )
    .toArray();

  await queueSessionSettle(found.map(session => session._id));

  let last = found[found.length - 1];
  let next: ReconcileCursor | undefined =
    last && found.length == d.limit
      ? { lastActivityAt: last.lastActivityAt.toISOString(), sessionKey: last._id }
      : undefined;

  return { count: found.length, next };
};
