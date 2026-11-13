import type { RebuildFilter } from '../knowledge/types';
import { getStore, isStoreConfigured } from '../store/connection';
import {
  currentVersions,
  filteredSliceFilter,
  rebuildLayers,
  sessionlessPageFilter,
  sessionPageFilter,
  takenKeysFilter,
  type RebuildCursor,
  type RebuildLayer,
  type RebuildTarget
} from './plan';

export let rebuildPageSize = 500;

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

let withFilter = (target: RebuildTarget) =>
  target.filter ? { ...target, filter: target.filter } : null;

export let countRebuildItems = async (target: RebuildTarget) => {
  if (!isStoreConfigured()) return 0;

  let { sessions, usageSlices } = await collections();

  let filtered = withFilter(target);
  if (filtered) {
    let [counted] = await usageSlices
      .aggregate<{ count: number }>([
        { $match: filteredSliceFilter(filtered) },
        { $group: { _id: { session: '$sessionKey', sessionless: '$sessionlessKey' } } },
        { $count: 'count' }
      ])
      .toArray();

    return counted?.count ?? 0;
  }

  let [sessionCount, sessionless] = await Promise.all([
    sessions.countDocuments(sessionPageFilter(target)),
    usageSlices
      .aggregate<{ count: number }>([
        { $match: sessionlessPageFilter(target) },
        { $group: { _id: '$sessionlessKey' } },
        { $count: 'count' }
      ])
      .toArray()
  ]);

  return sessionCount + (sessionless[0]?.count ?? 0);
};

export let hasRebuildItems = async (target: RebuildTarget) => {
  if (!isStoreConfigured()) return false;

  let { sessions, usageSlices } = await collections();

  let filtered = withFilter(target);
  if (filtered) {
    return !!(await usageSlices.findOne(filteredSliceFilter(filtered), {
      projection: { _id: 1 }
    }));
  }

  let session = await sessions.findOne(sessionPageFilter(target), { projection: { _id: 1 } });
  if (session) return true;

  return !!(await usageSlices.findOne(sessionlessPageFilter(target), {
    projection: { _id: 1 }
  }));
};

let uniqueKeys = (values: (string | undefined)[]) => [
  ...new Set(values.filter((value): value is string => !!value))
];

// Pages end on a bucket boundary: a full page drops its oldest bucket, which may be cut off, and
// the next page starts with it. A page that is a single bucket takes that whole bucket.
let filteredRebuildPage = async (d: {
  target: RebuildTarget & { filter: RebuildFilter };
  cursor: RebuildCursor;
}): Promise<{ keys: string[]; cursor: RebuildCursor }> => {
  let { usageSlices } = await collections();
  let before = d.cursor.before ? new Date(d.cursor.before) : d.target.range.to;
  let projection = { bucket: 1, sessionKey: 1, sessionlessKey: 1 };

  let page = await usageSlices
    .find(filteredSliceFilter(d.target, { before }), { projection })
    .sort({ bucket: -1 })
    .limit(rebuildPageSize)
    .toArray();

  let covered = page;
  let nextBefore: Date | null = null;
  let oldest = page[page.length - 1];

  if (page.length == rebuildPageSize && oldest) {
    if (page[0]!.bucket.getTime() == oldest.bucket.getTime()) {
      covered = await usageSlices
        .find(filteredSliceFilter(d.target, { from: oldest.bucket, before }), { projection })
        .toArray();
      nextBefore = oldest.bucket;
    } else {
      covered = page.filter(slice => slice.bucket.getTime() > oldest.bucket.getTime());
      nextBefore = new Date(oldest.bucket.getTime() + 1);
    }
  }

  let keys: string[] = [];

  for (let owner of ['sessionKey', 'sessionlessKey'] as const) {
    let candidates = uniqueKeys(covered.map(slice => slice[owner]));
    if (!candidates.length) continue;

    let taken =
      before < d.target.range.to
        ? new Set(
            await usageSlices.distinct(
              owner,
              takenKeysFilter(d.target, { owner, keys: candidates, before })
            )
          )
        : new Set();

    keys.push(...candidates.filter(key => !taken.has(key)));
  }

  let enqueued = d.cursor.enqueued + keys.length;

  return {
    keys,
    cursor: nextBefore
      ? { phase: 'slices', enqueued, before: nextBefore.toISOString() }
      : { phase: 'done', enqueued }
  };
};

// Sessionless pages walk slices in key order and keep only the keys: a key cut off at the end
// of a page was already taken, so the next page starts after it.
export let rebuildPage = async (d: {
  target: RebuildTarget;
  cursor: RebuildCursor;
}): Promise<{ keys: string[]; cursor: RebuildCursor }> => {
  if (!isStoreConfigured() || d.cursor.phase == 'done') {
    return { keys: [], cursor: { phase: 'done', enqueued: d.cursor.enqueued } };
  }

  let filtered = withFilter(d.target);
  if (filtered) return await filteredRebuildPage({ target: filtered, cursor: d.cursor });

  let { sessions, usageSlices } = await collections();

  if (d.cursor.phase == 'sessions') {
    let page = await sessions
      .find(sessionPageFilter(d.target, d.cursor.after), {
        projection: { _id: 1, startedAt: 1 }
      })
      .sort({ startedAt: -1, _id: 1 })
      .limit(rebuildPageSize)
      .toArray();

    let keys = page.map(session => session._id);
    let enqueued = d.cursor.enqueued + keys.length;
    let last = page[page.length - 1];

    if (page.length == rebuildPageSize && last) {
      return {
        keys,
        cursor: {
          phase: 'sessions',
          enqueued,
          after: { startedAt: last.startedAt.toISOString(), key: last._id }
        }
      };
    }

    return { keys, cursor: { phase: 'sessionless', enqueued } };
  }

  let slices = await usageSlices
    .find(sessionlessPageFilter(d.target, d.cursor.after?.key), {
      projection: { sessionlessKey: 1 }
    })
    .sort({ sessionlessKey: 1 })
    .limit(rebuildPageSize)
    .toArray();

  let keys = [
    ...new Set(slices.flatMap(slice => (slice.sessionlessKey ? [slice.sessionlessKey] : [])))
  ];
  let enqueued = d.cursor.enqueued + keys.length;
  let lastKey = keys[keys.length - 1];

  if (slices.length == rebuildPageSize && lastKey) {
    return { keys, cursor: { phase: 'sessionless', enqueued, after: { key: lastKey } } };
  }

  return { keys, cursor: { phase: 'done', enqueued } };
};

export let organizationBehindLayers = async (organizationId: string) => {
  if (!isStoreConfigured()) return [];

  let { sessions, usageSlices } = await collections();
  let behind: RebuildLayer[] = [];

  for (let layer of rebuildLayers) {
    let session = await sessions.findOne(
      {
        organizationId,
        [`versions.${layer}`]: { $lt: currentVersions[layer] },
        ...(layer == 'attribution' ? {} : { frozen: { $ne: true } })
      },
      { projection: { _id: 1 } }
    );

    let slice =
      !session && layer != 'summary'
        ? await usageSlices.findOne(
            {
              organizationId,
              sessionlessKey: { $exists: true },
              ...(layer == 'attribution'
                ? { attributionVersion: { $lt: currentVersions.attribution } }
                : { factsVersion: { $lt: currentVersions.facts } })
            },
            { projection: { _id: 1 } }
          )
        : null;

    if (session || slice) behind.push(layer);
  }

  return behind;
};
