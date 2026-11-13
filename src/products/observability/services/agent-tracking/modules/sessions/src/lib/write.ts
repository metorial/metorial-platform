import type { NormalizedRecord, SessionContextData } from '@mtsrc/agent-tracking-spec';
import type mongoose from 'mongoose';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import type { StoreCollections } from '@mtsrc/agent-tracking-store';
import type {
  SessionDocument,
  SessionLinkDocument,
  SessionTag,
  SourceHealthDocument
} from '@mtsrc/agent-tracking-store';
import type { SessionAssignment } from './assign';
import { correlationKey, orphanKey, recordActor, recordCorrelations } from './keys';
import { tryRedis } from '@mtsrc/agent-tracking-redis';
import { correlationCacheKey, inferCacheKey } from './cacheKeys';
import { sourceKindOf } from '@mtsrc/agent-tracking-module-usage';

let dayMs = 24 * 60 * 60 * 1000;

let linkTtlMs = dayMs;

let cacheTtlSeconds = 24 * 60 * 60;

type AnyBulkWrite<T extends mongoose.mongo.Document> = mongoose.mongo.AnyBulkWriteOperation<T>;

type Update = Record<string, Record<string, unknown>>;

type SessionGroup = { sessionKey: string; records: NormalizedRecord[] };

let occurredAt = (record: NormalizedRecord) => new Date(record.occurred_at);

let latestBy = (records: NormalizedRecord[]) =>
  [...records].sort((a, b) => occurredAt(b).getTime() - occurredAt(a).getTime());

let unique = <T>(values: (T | undefined)[]) => [
  ...new Set(values.filter((value): value is T => value !== undefined))
];

let addToSet = (values: unknown[]) => ({ $each: values });

let contextOf = (record: NormalizedRecord) =>
  record.type == 'session.context' ? (record.data as SessionContextData) : undefined;

let groupBySession = (records: NormalizedRecord[]) => {
  let groups = new Map<string, SessionGroup>();

  for (let record of records) {
    let sessionKey = record.ctx.session_key;
    if (!sessionKey) continue;

    let group = groups.get(sessionKey) ?? { sessionKey, records: [] };
    group.records.push(record);
    groups.set(sessionKey, group);
  }

  return [...groups.values()];
};

let loadRoots = async (groups: SessionGroup[], collections: StoreCollections) => {
  let parents = unique(
    groups.flatMap(group => group.records.map(record => record.ctx.parent_session_key))
  );
  if (!parents.length) return new Map<string, string>();

  let found = await collections.sessions
    .find({ _id: { $in: parents } }, { projection: { rootSessionKey: 1 } })
    .toArray();

  return new Map(found.map(session => [session._id, session.rootSessionKey]));
};

let stateOps = (group: SessionGroup): AnyBulkWrite<SessionDocument>[] => {
  let filter = { _id: group.sessionKey };

  let lastOf = (type: string) =>
    latestBy(group.records.filter(record => record.type == type))[0];

  let end = lastOf('session.end');
  let start = lastOf('session.start');

  if (end && (!start || occurredAt(end) >= occurredAt(start))) {
    return [
      {
        updateOne: {
          filter,
          update: { $set: { state: 'ended' }, $max: { endedAt: occurredAt(end) } }
        }
      }
    ];
  }

  if (start) {
    return [
      {
        updateOne: {
          filter: { ...filter, state: { $ne: 'active' } },
          update: { $set: { state: 'active' }, $unset: { endedAt: '' } }
        }
      }
    ];
  }

  return [
    {
      updateOne: {
        filter: { ...filter, state: 'idle' },
        update: { $set: { state: 'active' } }
      }
    }
  ];
};

let sessionUpsert = (d: {
  group: SessionGroup;
  principal: IngestPrincipal;
  observedAt: Date;
  inferKey?: string;
  roots: Map<string, string>;
}): AnyBulkWrite<SessionDocument> => {
  let { principal } = d;
  let records = d.group.records;
  let byTime = latestBy(records);
  let first = byTime[byTime.length - 1]!;
  let last = byTime[0]!;
  let startedAt = occurredAt(first);

  let set: Record<string, unknown> = { settlePending: true };
  let setOnInsert: Record<string, unknown> = {
    organizationId: principal.organization.id,
    projectId: principal.project.id,
    instanceId: principal.instance.id,
    origin: records.every(record => record.ctx.session_origin == 'inferred')
      ? 'inferred'
      : 'native',
    ...(d.inferKey ? { inferKey: d.inferKey } : {}),
    'versions.summary': 0,
    'versions.attribution': 0,
    'versions.facts': 0,
    'client.family': first.client.family,
    state: 'active'
  };

  let surface = byTime.find(record => record.client.surface)?.client.surface;
  if (surface) setOnInsert['client.surface'] = surface;

  let version = byTime.find(record => record.client.version)?.client.version;
  if (version) set['client.version'] = version;

  let parent = byTime.find(record => record.ctx.parent_session_key)?.ctx.parent_session_key;
  if (parent && parent != d.group.sessionKey) {
    set.parentSessionKey = parent;
    set.rootSessionKey = d.roots.get(parent) ?? parent;
  } else {
    setOnInsert.rootSessionKey = d.group.sessionKey;
  }

  let continues = byTime.find(record => record.ctx.continues_session_key)?.ctx
    .continues_session_key;
  if (continues && continues != d.group.sessionKey) set.continuesSessionKey = continues;

  let tokenRecords = byTime.filter(record => record.ingest.credential_kind == 'token');
  let observedTarget = tokenRecords.length ? set : setOnInsert;
  let actors = (tokenRecords.length ? tokenRecords : byTime).map(record =>
    recordActor(record, principal)
  );

  for (let field of ['userId', 'deviceId', 'agentId'] as const) {
    let value = actors.find(actor => actor[field])?.[field];
    if (value) observedTarget[`observed.${field}`] = value;
  }

  let contexts = byTime.flatMap(record => {
    let data = contextOf(record);
    return data ? [{ record, data }] : [];
  });

  let branch = contexts.find(entry => entry.data.branch)?.data;
  if (branch) {
    set['context.branch'] = branch.branch;
    if (branch.head) set['context.head'] = branch.head;
  }

  let pathStored = contexts.some(entry =>
    entry.record.content.some(content => content.role == 'path' && content.text !== undefined)
  );
  if (pathStored) set['context.pathStored'] = true;
  else setOnInsert['context.pathStored'] = false;

  let tags: SessionTag[] = contexts.flatMap(
    entry => entry.data.tags?.map(tag => ({ k: tag.k, v: tag.v, origin: tag.origin })) ?? []
  );

  let attribution = records.map(record => record.attribution ?? {});

  return {
    updateOne: {
      filter: { _id: d.group.sessionKey },
      update: {
        $set: set,
        $setOnInsert: setOnInsert,
        $min: {
          startedAt,
          expiresAt: new Date(
            startedAt.getTime() + principal.instance.usageRetentionDays * dayMs
          )
        },
        $max: { lastActivityAt: occurredAt(last), lastObservedAt: d.observedAt },
        $addToSet: {
          'observed.clientUserIds': addToSet(unique(attribution.map(a => a.client_user_id))),
          'observed.clientInstallationIds': addToSet(
            unique(attribution.map(a => a.client_installation_id))
          ),
          'context.workspaceIds': addToSet(unique(attribution.map(a => a.workspace_id))),
          'context.repoIds': addToSet(unique(attribution.map(a => a.repo_id))),
          'context.tags': addToSet(tags),
          'context.ticketRefs': addToSet(
            unique(contexts.flatMap(entry => entry.data.ticket_refs ?? []))
          )
        }
      } satisfies Update as never,
      upsert: true
    }
  };
};

let linkOps = (d: { instanceId: string; records: NormalizedRecord[]; observedAt: Date }) => {
  let expiresAt = new Date(d.observedAt.getTime() + linkTtlMs);
  let links = new Map<string, string>();
  let orphans = new Map<string, Set<string>>();

  for (let record of d.records) {
    let correlations = recordCorrelations(record);
    if (!correlations.length) continue;

    let claimed =
      record.ctx.session_key &&
      (record.ctx.session_origin == 'native' || record.ctx.session_origin == 'linked');

    for (let correlation of correlations) {
      if (claimed) {
        let key = correlationKey(d.instanceId, correlation);
        if (!links.has(key)) links.set(key, record.ctx.session_key!);
      } else if (record.kind == 'event') {
        let key = orphanKey(d.instanceId, correlation);
        let ids = orphans.get(key) ?? new Set();
        ids.add(record.id);
        orphans.set(key, ids);
      }
    }
  }

  let ops: AnyBulkWrite<SessionLinkDocument>[] = [
    ...[...links].map(([_id, sessionKey]) => ({
      updateOne: {
        filter: { _id },
        update: {
          $setOnInsert: { instanceId: d.instanceId, sessionKey },
          $max: { expiresAt }
        },
        upsert: true
      }
    })),
    ...[...orphans].map(([_id, ids]) => ({
      updateOne: {
        filter: { _id },
        update: {
          $setOnInsert: { instanceId: d.instanceId },
          $addToSet: { recordIds: { $each: [...ids] } },
          $max: { expiresAt }
        },
        upsert: true
      }
    }))
  ];

  return { ops, links };
};

export let sourceHealthId = (d: { instanceId: string; actorKey: string; family: string }) =>
  `${d.instanceId}:${d.actorKey}:${d.family}`;

let sourceHealthOps = (d: {
  principal: IngestPrincipal;
  records: NormalizedRecord[];
  observedAt: Date;
}): AnyBulkWrite<SourceHealthDocument>[] => {
  let instanceId = d.principal.instance.id;
  let entries = new Map<
    string,
    {
      family: string;
      userId?: string;
      deviceId?: string;
      kinds: Set<string>;
      version?: string;
    }
  >();

  for (let record of d.records) {
    let actor = recordActor(record, d.principal);
    let actorKey = actor.deviceId ?? actor.userId;
    if (!actorKey) continue;

    let family = record.client.family;
    let id = sourceHealthId({ instanceId, actorKey, family });

    let entry = entries.get(id) ?? {
      family,
      ...(actor.deviceId ? { deviceId: actor.deviceId } : { userId: actor.userId }),
      kinds: new Set()
    };

    let kind = sourceKindOf({
      channel: record.source.channel,
      credentialKind: record.ingest.credential_kind,
      type: record.type,
      data: record.data
    });
    if (kind) entry.kinds.add(kind);
    if (record.client.version) entry.version = record.client.version;

    entries.set(id, entry);
  }

  return [...entries].flatMap(([_id, entry]) => {
    if (!entry.kinds.size) return [];

    let lastSeen = Object.fromEntries(
      [...entry.kinds].map(kind => [`lastSeen.${kind}`, d.observedAt])
    );

    return [
      {
        updateOne: {
          filter: { _id },
          update: {
            $setOnInsert: {
              organizationId: d.principal.organization.id,
              instanceId,
              family: entry.family,
              ...(entry.deviceId ? { deviceId: entry.deviceId } : {}),
              ...(entry.userId ? { userId: entry.userId } : {})
            },
            $max: { ...lastSeen, updatedAt: d.observedAt },
            ...(entry.version ? { $set: { clientVersion: entry.version } } : {})
          } satisfies Update as never,
          upsert: true
        }
      }
    ];
  });
};

let writeCaches = async (d: { links: Map<string, string>; assignment: SessionAssignment }) => {
  if (!d.links.size && !d.assignment.inferred.size) return;

  await tryRedis(async redis => {
    let pipeline = redis.pipeline();

    for (let [key, sessionKey] of d.links) {
      pipeline.set(correlationCacheKey(key), sessionKey, 'EX', cacheTtlSeconds, 'NX');
    }

    for (let [inferKey, state] of d.assignment.inferred) {
      pipeline.set(inferCacheKey(inferKey), JSON.stringify(state), 'EX', cacheTtlSeconds);
    }

    await pipeline.exec();
  });
};

export let writeSessions = async (d: {
  principal: IngestPrincipal;
  records: NormalizedRecord[];
  observedAt: Date;
  assignment: SessionAssignment;
  collections: StoreCollections;
}) => {
  let groups = groupBySession(d.records);
  let roots = await loadRoots(groups, d.collections);

  let sessionOps = groups.flatMap(group => [
    sessionUpsert({
      group,
      principal: d.principal,
      observedAt: d.observedAt,
      inferKey: d.assignment.inferKeys.get(group.sessionKey),
      roots
    }),
    ...stateOps(group)
  ]);

  let links = linkOps({
    instanceId: d.principal.instance.id,
    records: d.records,
    observedAt: d.observedAt
  });

  let health = sourceHealthOps({
    principal: d.principal,
    records: d.records,
    observedAt: d.observedAt
  });

  await Promise.all([
    sessionOps.length && d.collections.sessions.bulkWrite(sessionOps, { ordered: true }),
    links.ops.length && d.collections.sessionLinks.bulkWrite(links.ops, { ordered: false }),
    health.length && d.collections.sourceHealth.bulkWrite(health, { ordered: false })
  ]);

  await writeCaches({ links: links.links, assignment: d.assignment });

  return { sessionKeys: groups.map(group => group.sessionKey) };
};
