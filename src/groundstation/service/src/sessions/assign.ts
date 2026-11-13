import type { NormalizedRecord } from '@metorial/groundstation-spec';
import type { IngestPrincipal } from '../auth/principal';
import { sessionKey as deriveSessionKey, type OrganizationKey } from '../crypto/keys';
import type { StoreCollections } from '../store/connection';
import {
  buildInferKey,
  correlationKey,
  isInferable,
  recordActor,
  recordCorrelations
} from './keys';
import { correlationCacheKey, inferCacheKey, tryRedis } from './redis';

let defaultGapMinutes = 30;

let minuteMs = 60 * 1000;

export type InferredState = { sessionKey: string; startedAt: Date; lastActivityAt: Date };

export type SessionAssignment = {
  inferKeys: Map<string, string>;
  inferred: Map<string, InferredState>;
};

let occurredAt = (record: NormalizedRecord) => new Date(record.occurred_at);

export let inferredGapMs = (principal: IngestPrincipal) =>
  (principal.instance.settings.inferredSessionGapMinutes ?? defaultGapMinutes) * minuteMs;

let assignLinked = async (d: {
  instanceId: string;
  records: NormalizedRecord[];
  collections: StoreCollections;
}) => {
  let known = new Map<string, string>();

  for (let record of d.records) {
    let sessionKey = record.ctx.session_key;
    if (!sessionKey) continue;

    for (let correlation of recordCorrelations(record)) {
      let key = correlationKey(d.instanceId, correlation);
      if (!known.has(key)) known.set(key, sessionKey);
    }
  }

  let pending = d.records.filter(record => !record.ctx.session_key);

  let wanted = new Set<string>();
  for (let record of pending) {
    for (let correlation of recordCorrelations(record)) {
      let key = correlationKey(d.instanceId, correlation);
      if (!known.has(key)) wanted.add(key);
    }
  }

  if (wanted.size) {
    let keys = [...wanted];
    let cached = await tryRedis(redis => redis.mget(keys.map(correlationCacheKey)));

    let misses = keys.filter((key, index) => {
      let value = cached?.[index];
      if (value) known.set(key, value);

      return !value;
    });

    if (misses.length) {
      let links = await d.collections.sessionLinks
        .find({ _id: { $in: misses }, sessionKey: { $exists: true } })
        .toArray();

      for (let link of links) known.set(link._id, link.sessionKey!);
    }
  }

  for (let record of pending) {
    for (let correlation of recordCorrelations(record)) {
      let sessionKey = known.get(correlationKey(d.instanceId, correlation));
      if (!sessionKey) continue;

      record.ctx.session_key = sessionKey;
      record.ctx.session_origin = 'linked';
      break;
    }
  }
};

// A retried request re-derives the same record ids; reusing their stored sessions keeps a retry
// from opening a second inferred session.
let assignStored = async (d: {
  records: NormalizedRecord[];
  collections: StoreCollections;
}) => {
  let stored = await d.collections.events
    .find(
      {
        _id: { $in: d.records.map(record => record.id) },
        'ctx.sessionKey': { $exists: true }
      },
      { projection: { 'ctx.sessionKey': 1, 'ctx.sessionOrigin': 1 } }
    )
    .toArray();

  let byId = new Map(stored.map(document => [document._id, document.ctx]));

  for (let record of d.records) {
    let ctx = byId.get(record.id);
    if (!ctx?.sessionKey) continue;

    record.ctx.session_key = ctx.sessionKey;
    record.ctx.session_origin = ctx.sessionOrigin ?? 'inferred';
  }
};

let parseInferred = (value: string): InferredState | undefined => {
  try {
    let parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.sessionKey != 'string') return undefined;

    let startedAt = new Date(parsed.startedAt as string);
    let lastActivityAt = new Date(parsed.lastActivityAt as string);
    if (isNaN(startedAt.getTime()) || isNaN(lastActivityAt.getTime())) return undefined;

    return { sessionKey: parsed.sessionKey, startedAt, lastActivityAt };
  } catch {
    return undefined;
  }
};

let loadInferred = async (inferKey: string, collections: StoreCollections) => {
  let cached = await tryRedis(redis => redis.get(inferCacheKey(inferKey)));
  let fromCache = cached ? parseInferred(cached) : undefined;
  if (fromCache) return fromCache;

  let session = await collections.sessions.findOne(
    { inferKey, origin: 'inferred' },
    { sort: { lastActivityAt: -1 }, projection: { startedAt: 1, lastActivityAt: 1 } }
  );

  return session
    ? {
        sessionKey: session._id,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt
      }
    : undefined;
};

let assignInferred = async (d: {
  principal: IngestPrincipal;
  organizationKey: OrganizationKey;
  records: NormalizedRecord[];
  collections: StoreCollections;
  assignment: SessionAssignment;
}) => {
  let instanceId = d.principal.instance.id;
  let gapMs = inferredGapMs(d.principal);

  let groups = new Map<string, { family: string; records: NormalizedRecord[] }>();

  for (let record of d.records) {
    let actor = recordActor(record, d.principal);
    let actorKey = actor.deviceId ?? actor.userId;
    if (!actorKey) continue;

    let family = record.client.family;
    let key = `${family}\0${actorKey}`;

    let group = groups.get(key) ?? { family, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }

  for (let group of groups.values()) {
    let inferKey = buildInferKey({
      instanceId,
      family: group.family,
      actor: recordActor(group.records[0]!, d.principal)
    });
    if (!inferKey) continue;

    let loaded = await loadInferred(inferKey, d.collections);
    let states = loaded ? [loaded] : [];

    let sorted = [...group.records].sort(
      (a, b) => occurredAt(a).getTime() - occurredAt(b).getTime()
    );

    for (let record of sorted) {
      let at = occurredAt(record);

      let state = states.findLast(
        candidate =>
          at.getTime() <= candidate.lastActivityAt.getTime() + gapMs &&
          at.getTime() >= candidate.startedAt.getTime() - gapMs
      );

      if (!state) {
        state = {
          sessionKey: deriveSessionKey(
            d.organizationKey,
            instanceId,
            group.family,
            `inferred:${record.id}`
          ),
          startedAt: at,
          lastActivityAt: at
        };
        states.push(state);
      }

      if (at < state.startedAt) state.startedAt = at;
      if (at > state.lastActivityAt) state.lastActivityAt = at;

      record.ctx.session_key = state.sessionKey;
      record.ctx.session_origin = 'inferred';
      d.assignment.inferKeys.set(state.sessionKey, inferKey);
    }

    let latest = states.reduce((a, b) => (b.lastActivityAt > a.lastActivityAt ? b : a));
    d.assignment.inferred.set(inferKey, latest);
  }
};

export let assignSessions = async (d: {
  principal: IngestPrincipal;
  organizationKey: OrganizationKey;
  records: NormalizedRecord[];
  collections: StoreCollections;
}): Promise<SessionAssignment> => {
  let assignment: SessionAssignment = { inferKeys: new Map(), inferred: new Map() };

  for (let record of d.records) {
    if (record.ctx.session_key && !record.ctx.session_origin) {
      record.ctx.session_origin = 'native';
    }
  }

  if (d.records.every(record => record.ctx.session_key)) return assignment;

  await assignLinked({
    instanceId: d.principal.instance.id,
    records: d.records,
    collections: d.collections
  });

  let inferable = d.records.filter(record => !record.ctx.session_key && isInferable(record));
  if (!inferable.length) return assignment;

  await assignStored({ records: inferable, collections: d.collections });

  await assignInferred({
    principal: d.principal,
    organizationKey: d.organizationKey,
    records: inferable.filter(record => !record.ctx.session_key),
    collections: d.collections,
    assignment
  });

  return assignment;
};
