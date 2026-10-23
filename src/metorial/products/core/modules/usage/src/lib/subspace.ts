import { db } from '@metorial-subspace/db';
import { db as metorialDb } from '@metorial/db';
import { createTtlCache } from './ttlCache';

let CACHE_TTL_MS = 10 * 60_000;
let EMPTY_CACHE_TTL_MS = 30_000;
let CACHE_MAX_SIZE = 10_000;

export type UsageInstanceRef = {
  instanceId: string;
  organizationId: string;
};

export type UsageSessionDims = {
  magicMcpServerId: string | null;
  integrationId: string | null;
};

let instanceCache = createTtlCache<UsageInstanceRef | null>({
  ttlMs: CACHE_TTL_MS,
  emptyTtlMs: EMPTY_CACHE_TTL_MS,
  maxSize: CACHE_MAX_SIZE
});

let sessionCache = createTtlCache<UsageSessionDims>({
  ttlMs: CACHE_TTL_MS,
  emptyTtlMs: EMPTY_CACHE_TTL_MS,
  maxSize: CACHE_MAX_SIZE
});

let consumerCache = createTtlCache<string | null>({
  ttlMs: CACHE_TTL_MS,
  emptyTtlMs: EMPTY_CACHE_TTL_MS,
  maxSize: CACHE_MAX_SIZE
});

let agentInstanceCache = createTtlCache<string | null>({
  ttlMs: CACHE_TTL_MS,
  emptyTtlMs: EMPTY_CACHE_TTL_MS,
  maxSize: CACHE_MAX_SIZE
});

let providerCache = createTtlCache<string | null>({
  ttlMs: CACHE_TTL_MS,
  emptyTtlMs: EMPTY_CACHE_TTL_MS,
  maxSize: CACHE_MAX_SIZE
});

let splitCached = <V>(
  keys: string[],
  cache: { get: (key: string) => { value: V } | undefined }
) => {
  let result = new Map<string, V>();
  let missing: string[] = [];

  for (let key of new Set(keys)) {
    let cached = cache.get(key);
    if (cached) result.set(key, cached.value);
    else missing.push(key);
  }

  return { result, missing };
};

export let resolveUsageInstances = async (instanceOids: bigint[]) => {
  let { result, missing } = splitCached(
    instanceOids.map(oid => oid.toString()),
    instanceCache
  );
  if (!missing.length) return result;

  let instances = await db.instance.findMany({
    where: { oid: { in: missing.map(oid => BigInt(oid)) } },
    select: { oid: true, id: true, organization: { select: { id: true } } }
  });
  let byOid = new Map(instances.map(instance => [instance.oid.toString(), instance]));

  for (let oid of missing) {
    let instance = byOid.get(oid);
    let ref = instance
      ? { instanceId: instance.id, organizationId: instance.organization.id }
      : null;

    instanceCache.set(oid, ref, !ref);
    result.set(oid, ref);
  }

  return result;
};

export let resolveUsageInstance = async (instanceOid: bigint | null | undefined) => {
  if (!instanceOid) return null;

  let instances = await resolveUsageInstances([instanceOid]);
  return instances.get(instanceOid.toString()) ?? null;
};

export let resolveUsageSessionDimsMany = async (sessions: { oid: bigint; id: string }[]) => {
  let sessionIdsByOid = new Map(sessions.map(session => [session.oid.toString(), session.id]));
  let { result, missing } = splitCached([...sessionIdsByOid.keys()], sessionCache);
  if (!missing.length) return result;

  let [magicSessions, integrationSessions] = await Promise.all([
    metorialDb.magicMcpSession.findMany({
      where: {
        subspaceSessionId: { in: missing.map(oid => sessionIdsByOid.get(oid)!) },
        magicMcpServerOid: { not: null }
      },
      select: { subspaceSessionId: true, magicMcpServer: { select: { id: true } } }
    }),

    db.adapterIntegrationInstanceProviderSession.findMany({
      where: { sessionOid: { in: missing.map(oid => BigInt(oid)) } },
      select: {
        sessionOid: true,
        adapterIntegration: { select: { integration: { select: { id: true } } } }
      }
    })
  ]);

  let magicBySessionId = new Map(
    magicSessions.map(session => [session.subspaceSessionId, session.magicMcpServer?.id])
  );
  let integrationBySessionOid = new Map(
    integrationSessions.map(session => [
      session.sessionOid.toString(),
      session.adapterIntegration.integration.id
    ])
  );

  for (let oid of missing) {
    let dims = {
      magicMcpServerId: magicBySessionId.get(sessionIdsByOid.get(oid)!) ?? null,
      integrationId: integrationBySessionOid.get(oid) ?? null
    };

    sessionCache.set(oid, dims, !dims.magicMcpServerId && !dims.integrationId);
    result.set(oid, dims);
  }

  return result;
};

export let resolveUsageSessionDims = async (
  session: { oid: bigint; id: string } | null | undefined
) => {
  if (!session) return { magicMcpServerId: null, integrationId: null };

  let dims = await resolveUsageSessionDimsMany([session]);
  return dims.get(session.oid.toString()) ?? { magicMcpServerId: null, integrationId: null };
};

export let resolveUsageConsumersByActor = async (identityActorOids: bigint[]) => {
  let { result, missing } = splitCached(
    identityActorOids.map(oid => oid.toString()),
    consumerCache
  );
  if (!missing.length) return result;

  let actors = await db.identityActor.findMany({
    where: { oid: { in: missing.map(oid => BigInt(oid)) }, type: 'consumer' },
    select: { oid: true, instanceConsumer: { select: { id: true } } }
  });
  let byOid = new Map(actors.map(actor => [actor.oid.toString(), actor]));

  for (let oid of missing) {
    let consumerId = byOid.get(oid)?.instanceConsumer?.id ?? null;

    consumerCache.set(oid, consumerId, !consumerId);
    result.set(oid, consumerId);
  }

  return result;
};

export type UsageParticipantRef = {
  id: string;
  type: string;
  agentInstanceOid?: bigint | null;
};

let nonAgentParticipantTypes = new Set(['provider', 'system', 'unknown']);

let isAgentParticipant = (participant: UsageParticipantRef | null | undefined) =>
  !!participant && !nonAgentParticipantTypes.has(participant.type);

export let resolveUsageAgentIds = async (
  participants: (UsageParticipantRef | null | undefined)[]
) => {
  let agentParticipants = participants.filter(isAgentParticipant) as UsageParticipantRef[];
  let { result: agentInstanceIds, missing } = splitCached(
    agentParticipants.flatMap(participant =>
      participant.agentInstanceOid ? [participant.agentInstanceOid.toString()] : []
    ),
    agentInstanceCache
  );

  if (missing.length) {
    let agentInstances = await db.agentInstance.findMany({
      where: { oid: { in: missing.map(oid => BigInt(oid)) } },
      select: { oid: true, id: true }
    });
    let byOid = new Map(agentInstances.map(agent => [agent.oid.toString(), agent.id]));

    for (let oid of missing) {
      let id = byOid.get(oid) ?? null;
      agentInstanceCache.set(oid, id, !id);
      agentInstanceIds.set(oid, id);
    }
  }

  return (participant: UsageParticipantRef | null | undefined) => {
    if (!participant || !isAgentParticipant(participant)) return null;

    let agentInstanceId = participant.agentInstanceOid
      ? agentInstanceIds.get(participant.agentInstanceOid.toString())
      : null;
    return agentInstanceId ?? participant.id;
  };
};

export let resolveUsageAgentId = async (participant: UsageParticipantRef | null | undefined) =>
  (await resolveUsageAgentIds([participant]))(participant);

export let resolveUsageProvider = async (providerOid: bigint | null | undefined) => {
  if (!providerOid) return null;

  let key = providerOid.toString();
  let cached = providerCache.get(key);
  if (cached) return cached.value;

  let provider = await db.provider.findUnique({
    where: { oid: providerOid },
    select: { id: true }
  });
  let providerId = provider?.id ?? null;

  providerCache.set(key, providerId, !providerId);
  return providerId;
};

export let resolveUsageConsumerByActor = async (
  identityActorOid: bigint | null | undefined
) => {
  if (!identityActorOid) return null;

  let consumers = await resolveUsageConsumersByActor([identityActorOid]);
  return consumers.get(identityActorOid.toString()) ?? null;
};
