import { maxIdLength } from '@mtsrc/agent-tracking-records-model';
import { recordReadbackService } from '@mtsrc/agent-tracking-module-records';
import { getStore } from '@mtsrc/agent-tracking-store';
import type {
  RecordMetorialLink,
  SessionDocument,
  SessionSummary,
  ToolCallLinkDocument,
  ToolCallLinkTarget
} from '@mtsrc/agent-tracking-store';
import { queueSessionSettle } from '../queues/sessionSettle';
import { toolCallPairReader, toolCallRecordReader, type ToolCallPairReader } from './records';
import type { SessionMcpToolCallRef } from './summary';
import {
  maxRecordsPerToolCall,
  storedToolCallId,
  toolCallKey,
  type ToolCallRecord,
  type ToolCallRecordReader,
  type ToolCallRef
} from './toolCalls';

export let maxToolCallLinks = 200;

export let maxSessionLinkLookups = 5000;

export let maxSummaryMetorialIds = 100;

let chunkSize = 500;

let lookupConcurrency = 20;

let maxResettledSessions = 50;

let dayMs = 24 * 60 * 60 * 1000;

let duplicateKeyCode = 11000;

type StampOp = {
  updateMany: {
    filter: Record<string, unknown>;
    update: { $set: { metorial: RecordMetorialLink } } | { $unset: { metorial: '' } };
  };
};

export type ToolCallLinkInput = ToolCallRef & {
  metorial: ToolCallLinkTarget;
  calledAt: Date;
};

type LinkScope = {
  organizationId: string;
  projectId: string;
  instanceId: string;
  recordRetentionDays: number;
};

let collections = async () => {
  let store = getStore();
  await store.ready();

  return store.collections();
};

let chunked = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );

let clamp = (value: string) => value.slice(0, maxIdLength);

let optional = (key: string, value: string | undefined) =>
  value ? { [key]: clamp(value) } : {};

let storedRef = (call: ToolCallRef): ToolCallRef => ({
  clientFamily: clamp(call.clientFamily),
  toolCallId: storedToolCallId(call.toolCallId)
});

export let toolCallLinkId = (d: { instanceId: string } & ToolCallRef) => {
  let ref = storedRef(d);
  return `${d.instanceId}:${ref.clientFamily}:${ref.toolCallId}`;
};

export let linkTargetOf = (input: ToolCallLinkTarget): RecordMetorialLink => ({
  toolCallId: clamp(input.toolCallId),
  providerId: clamp(input.providerId),
  ...optional('toolKey', input.toolKey),
  ...optional('deploymentId', input.deploymentId),
  ...optional('integrationId', input.integrationId),
  ...optional('magicMcpServerId', input.magicMcpServerId)
});

export let isLinked = (
  link: ToolCallLinkDocument
): link is ToolCallLinkDocument & Required<Pick<ToolCallLinkDocument, 'metorial'>> =>
  !!link.metorial && !link.conflict;

export let toolCallLinkOps = (d: {
  scope: LinkScope;
  links: ToolCallLinkInput[];
  now: Date;
}) => {
  let inserts = [];
  let updates = [];

  for (let link of d.links) {
    let target = linkTargetOf(link.metorial);
    let expiresAt = new Date(link.calledAt.getTime() + d.scope.recordRetentionDays * dayMs);
    if (expiresAt <= d.now) continue;

    let ref = storedRef(link);
    let _id = toolCallLinkId({ ...ref, instanceId: d.scope.instanceId });

    inserts.push({
      updateOne: {
        filter: { _id },
        update: {
          $setOnInsert: {
            organizationId: d.scope.organizationId,
            projectId: d.scope.projectId,
            instanceId: d.scope.instanceId,
            ...ref,
            metorial: { ...target, calledAt: link.calledAt },
            createdAt: d.now,
            expiresAt
          }
        },
        upsert: true
      }
    });

    updates.push({
      updateOne: {
        filter: {
          _id,
          conflict: { $ne: true },
          'metorial.toolCallId': { $ne: target.toolCallId }
        },
        update: { $set: { conflict: true as const }, $unset: { metorial: '' } }
      }
    });

    if (target.toolKey) {
      updates.push({
        updateOne: {
          filter: {
            _id,
            conflict: { $ne: true },
            'metorial.toolCallId': target.toolCallId,
            'metorial.toolKey': { $exists: false }
          },
          update: { $set: { 'metorial.toolKey': target.toolKey } }
        }
      });
    }
  }

  return { inserts, updates };
};

let isDuplicateKeyOnly = (error: unknown) => {
  let writeErrors = (error as { writeErrors?: unknown })?.writeErrors;
  let list = Array.isArray(writeErrors) ? writeErrors : writeErrors ? [writeErrors] : [];

  return (
    list.length > 0 && list.every(item => (item as { code?: number }).code == duplicateKeyCode)
  );
};

export let writeToolCallLinks = async (d: {
  scope: LinkScope;
  links: ToolCallLinkInput[];
  now?: Date;
}) => {
  let { toolCallLinks } = await collections();
  let ops = toolCallLinkOps({ ...d, now: d.now ?? new Date() });
  if (!ops.inserts.length) return 0;

  try {
    await toolCallLinks.bulkWrite(ops.inserts as never, { ordered: false });
  } catch (error) {
    if (!isDuplicateKeyOnly(error)) throw error;
  }

  await toolCallLinks.bulkWrite(ops.updates as never, { ordered: false });

  return ops.inserts.length;
};

export let readToolCallLinks = async (d: {
  session: Pick<SessionDocument, 'organizationId' | 'instanceId'>;
  calls: ToolCallRef[];
}) => {
  let wanted = new Map<string, string>();
  for (let call of d.calls) {
    if (wanted.size >= maxSessionLinkLookups) break;

    let ref = storedRef(call);
    wanted.set(toolCallKey(ref), toolCallLinkId({ ...ref, instanceId: d.session.instanceId }));
  }
  if (!wanted.size) return [];

  let { toolCallLinks } = await collections();
  let links: ToolCallLinkDocument[] = [];

  for (let ids of chunked([...new Set(wanted.values())], chunkSize)) {
    let found = await toolCallLinks
      .find({
        _id: { $in: ids },
        organizationId: d.session.organizationId,
        instanceId: d.session.instanceId
      })
      .toArray();

    links.push(...found.filter(link => wanted.has(toolCallKey(link))));
  }

  return links;
};

let isAmbiguous = (d: { sessionKey: string; records: ToolCallRecord[] }) => {
  let sessions = new Set(d.records.map(record => record.ctx?.sessionKey));

  return (
    d.records.length > maxRecordsPerToolCall ||
    sessions.size > 1 ||
    (sessions.size == 1 && !sessions.has(d.sessionKey))
  );
};

export let ambiguousToolCallPairs = async (d: {
  session: Pick<SessionDocument, '_id'>;
  links: ToolCallLinkDocument[];
  readPairs: ToolCallPairReader;
  readCall: ToolCallRecordReader;
}) => {
  let ambiguous = new Set<string>();
  let stale = new Set<string>();
  let families = new Map<string, string[]>();

  for (let link of d.links.filter(isLinked)) {
    families.set(link.clientFamily, [
      ...(families.get(link.clientFamily) ?? []),
      link.toolCallId
    ]);
  }

  for (let [clientFamily, toolCallIds] of families) {
    for (let ids of chunked([...new Set(toolCallIds)], chunkSize)) {
      let limit = ids.length * (maxRecordsPerToolCall + 1);
      let records = await d.readPairs({ clientFamily, toolCallIds: ids, limit });
      let byId = new Map<string, ToolCallRecord[]>();

      if (records.length >= limit) {
        for (let batch of chunked(ids, lookupConcurrency)) {
          await Promise.all(
            batch.map(async toolCallId =>
              byId.set(
                toolCallId,
                await d.readCall({
                  call: { clientFamily, toolCallId },
                  limit: maxRecordsPerToolCall + 1
                })
              )
            )
          );
        }
      } else {
        for (let record of records) {
          let id = record.ctx.toolCallId!;
          byId.set(id, [...(byId.get(id) ?? []), record]);
        }
      }

      for (let toolCallId of ids) {
        let found = byId.get(toolCallId) ?? [];
        if (!isAmbiguous({ sessionKey: d.session._id, records: found })) continue;

        ambiguous.add(toolCallKey({ clientFamily, toolCallId }));

        for (let record of found) {
          let sessionKey = record.ctx?.sessionKey;
          if (sessionKey && sessionKey != d.session._id && record.metorial)
            stale.add(sessionKey);
        }
      }
    }
  }

  return { ambiguous, staleSessionKeys: [...stale].sort().slice(0, maxResettledSessions) };
};

export let usableToolCallLinks = (d: {
  links: ToolCallLinkDocument[];
  ambiguous: Set<string>;
}) =>
  d.links.map(link => {
    if (!isLinked(link) || !d.ambiguous.has(toolCallKey(link))) return link;

    let { metorial: _metorial, ...blocked } = link;
    return blocked;
  });

export let resolveSessionToolCallLinks = async (d: {
  session: Pick<SessionDocument, '_id' | 'organizationId' | 'instanceId' | 'summary'>;
  calls: SessionMcpToolCallRef[];
  strict?: boolean;
}) => {
  let staleSessionKeys: string[] = [];

  try {
    let links = await readToolCallLinks(d);
    if (links.some(isLinked)) {
      let scope = {
        organizationId: d.session.organizationId,
        instanceId: d.session.instanceId
      };
      let pairs = await ambiguousToolCallPairs({
        session: d.session,
        links,
        readPairs: await toolCallPairReader(scope),
        readCall: await toolCallRecordReader(scope)
      });

      links = usableToolCallLinks({ links, ambiguous: pairs.ambiguous });
      staleSessionKeys = pairs.staleSessionKeys;
    }

    return { links, metorial: metorialSummaryOf(links), staleSessionKeys };
  } catch (error) {
    if (d.strict) throw error;

    console.warn('[agent-tracking] tool call links are unavailable for a summary', error);
    return { links: [], metorial: d.session.summary?.metorial, staleSessionKeys: [] };
  }
};

let sortedBounded = (values: string[]) =>
  [...new Set(values)].sort().slice(0, maxSummaryMetorialIds);

export let metorialSummaryOf = (
  links: ToolCallLinkDocument[]
): SessionSummary['metorial'] | undefined => {
  let linked = links.filter(isLinked);
  if (!linked.length) return undefined;

  return {
    providerIds: sortedBounded(linked.map(link => link.metorial.providerId)),
    toolKeys: sortedBounded(
      linked.flatMap(link => (link.metorial.toolKey ? [link.metorial.toolKey] : []))
    )
  };
};

export let stampOps = (d: {
  session: Pick<SessionDocument, '_id' | 'organizationId' | 'instanceId'>;
  calls: SessionMcpToolCallRef[];
  links: ToolCallLinkDocument[];
}) => {
  let calls = new Map(d.calls.map(call => [toolCallKey(storedRef(call)), call]));

  return d.links.flatMap((link): StampOp[] => {
    let call = calls.get(toolCallKey(link));
    if (!call) return [];

    let filter = {
      organizationId: d.session.organizationId,
      instanceId: d.session.instanceId,
      'ctx.toolCallId': link.toolCallId,
      'client.family': link.clientFamily,
      'ctx.sessionKey': d.session._id,
      type: 'tool.call'
    };

    if (isLinked(link)) {
      let { calledAt: _calledAt, ...target } = link.metorial;
      let behind = call.unstamped || (!!target.toolKey && call.missingToolKey);
      if (!behind) return [];

      return [
        {
          updateMany: {
            filter: target.toolKey
              ? { ...filter, 'metorial.toolKey': { $ne: target.toolKey } }
              : { ...filter, metorial: { $exists: false } },
            update: { $set: { metorial: target } }
          }
        }
      ];
    }

    if (!call.stamped) return [];

    return [
      {
        updateMany: {
          filter: { ...filter, metorial: { $exists: true } },
          update: { $unset: { metorial: '' } }
        }
      }
    ];
  });
};

export let toolCallRepoOps = (d: {
  session: Pick<SessionDocument, '_id' | 'organizationId' | 'instanceId' | 'context'>;
  repoIds: (string | null)[];
}) => {
  let sessionRepos = d.session.context?.repoIds ?? [];
  let repoId = sessionRepos.length == 1 ? sessionRepos[0]! : null;
  if (d.repoIds.every(current => current === repoId)) return [];

  let filter = {
    organizationId: d.session.organizationId,
    instanceId: d.session.instanceId,
    'ctx.sessionKey': d.session._id,
    type: 'tool.call'
  };

  return [
    repoId
      ? {
          updateMany: {
            filter: { ...filter, 'attribution.repoId': { $ne: repoId } },
            update: { $set: { 'attribution.repoId': repoId } }
          }
        }
      : {
          updateMany: {
            filter: { ...filter, 'attribution.repoId': { $exists: true } },
            update: { $unset: { 'attribution.repoId': '' } }
          }
        }
  ];
};

export let applyToolCallLinks = async (d: {
  session: Pick<SessionDocument, '_id' | 'organizationId' | 'instanceId' | 'context'>;
  calls: SessionMcpToolCallRef[];
  links: ToolCallLinkDocument[];
  toolCallRepoIds: (string | null)[];
  staleSessionKeys: string[];
}) => {
  if (recordReadbackService.isAvailable()) return 0;

  let ops = [
    ...stampOps(d),
    ...toolCallRepoOps({ session: d.session, repoIds: d.toolCallRepoIds })
  ];

  if (ops.length) {
    let { events } = await collections();
    for (let chunk of chunked(ops, chunkSize)) {
      await events.bulkWrite(chunk as never, { ordered: false });
    }
  }

  await queueSessionSettle(d.staleSessionKeys);

  return ops.length;
};
