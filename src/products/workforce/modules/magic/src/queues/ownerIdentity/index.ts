import { isServiceError } from '@lowerdeck/error';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { combineQueueProcessors, createQueue, dailyPacedDelay } from '@metorial/queue';
import {
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking,
  getConsumerOwnerForProfile,
  getConsumerOwnerProfileOidForServer
} from '../../lib/backing';
import { resolveOwnerActorOid } from '../../lib/ownerActor';

let OWNER_IDENTITY_RECONCILE_BATCH_SIZE = 500;

let reconcilableServerWhere = {
  status: 'active' as const,
  hasSubspaceBacking: true
};

let reconcilableEndpointWhere = {
  status: 'active' as const,
  hasSubspaceBacking: true,
  consumerProfileOid: null
};

type ServerBacking = Awaited<
  ReturnType<typeof magicMcpServerBackingService.getMagicMcpServerBackingById>
>;

type EndpointBacking = Awaited<
  ReturnType<typeof magicMcpEndpointBackingService.getMagicMcpEndpointBackingById>
>;

type IdentityActorRef = { oid: bigint; id: string; type: string } | null;

// Endpoint backings used to stamp their consumer's identity onto every member server, so
// shared servers carry whichever consumer touched them last. Only consumer identities are
// rewritten here; person and agent identities are set deliberately and are left alone.
export let isConsumerOwnedIdentity = (d: {
  actors: IdentityActorRef[];
  identity: { actorOid: bigint } | null;
}) => {
  let actors = d.actors.filter(actor => !!actor);
  if (actors.some(actor => actor.type !== 'consumer' && actor.type !== 'organization_member'))
    return false;
  if (!d.identity) return true;

  return actors.some(actor => actor.oid === d.identity!.actorOid);
};

let getCurrentOwner = (d: { backing: ServerBacking; usesOwnIntegrationInstance: boolean }) => {
  if (d.usesOwnIntegrationInstance) {
    return {
      identityActorId: d.backing.actor?.id ?? null,
      identityId: null,
      actors: [d.backing.actor],
      identity: null
    };
  }

  return {
    identityActorId: d.backing.integrationInstance.identityActor?.id ?? null,
    identityId: d.backing.integrationInstance.identity?.id ?? null,
    actors: [d.backing.integrationInstance.identityActor, d.backing.actor],
    identity: d.backing.integrationInstance.identity
  };
};

export let magicMcpServerOwnerIdentityReconcileCron = createCron(
  {
    name: 'magic/server/ownerIdentity/reconcile/cron',
    cron: '15 * * * *'
  },
  async () => {
    await reconcileMagicMcpServerOwnerIdentitiesManyQueue.add(
      {},
      { id: 'magic-server-owner-identity-reconcile' }
    );

    await reconcileMagicMcpEndpointOwnerIdentitiesManyQueue.add(
      {},
      { id: 'magic-endpoint-owner-identity-reconcile' }
    );
  }
);

export let reconcileMagicMcpServerOwnerIdentitiesManyQueue = createQueue<{ cursor?: string }>({
  name: 'magic/server/ownerIdentity/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileMagicMcpServerOwnerIdentitiesManyQueueProcessor =
  reconcileMagicMcpServerOwnerIdentitiesManyQueue.process(async data => {
    let servers = await db.magicMcpServer.findMany({
      where: {
        ...reconcilableServerWhere,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_IDENTITY_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!servers.length) return;

    await reconcileMagicMcpServerOwnerIdentityQueue.addManyWithOps(
      servers.map(server => ({
        data: { magicMcpServerId: server.id },
        opts: { id: server.id }
      }))
    );

    if (servers.length === OWNER_IDENTITY_RECONCILE_BATCH_SIZE) {
      await reconcileMagicMcpServerOwnerIdentitiesManyQueue.add(
        { cursor: servers[servers.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileMagicMcpServerOwnerIdentityQueue = createQueue<{
  magicMcpServerId: string;
}>({
  name: 'magic/server/ownerIdentity/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let getExpectedOwnerActorId = (d: {
  expectedIdentityActorId: string | null;
  backing: ServerBacking;
  usesOwnIntegrationInstance: boolean;
}) => {
  if (d.expectedIdentityActorId) return d.expectedIdentityActorId;
  if (!d.usesOwnIntegrationInstance) return null;

  return d.backing.integrationInstance.identityActor?.id ?? null;
};

export let reconcileMagicMcpServerOwnerIdentity = async (d: { magicMcpServerId: string }) => {
  let server = await db.magicMcpServer.findFirst({
    where: { id: d.magicMcpServerId, ...reconcilableServerWhere },
    include: { instance: true, ownerActor: { select: { type: true } } }
  });
  if (!server) return;

  let [consumerProfileOid, backing] = await Promise.all([
    getConsumerOwnerProfileOidForServer({ instance: server.instance, server }),
    magicMcpServerBackingService
      .getMagicMcpServerBackingById({
        instance: server.instance,
        magicMcpServerBackingId: server.id
      })
      .catch(error => {
        if (isServiceError(error) && error.data.code === 'not_found') return null;
        throw error;
      })
  ]);
  if (!backing) return;

  // Consumer-deployed servers whose consumer links were never materialized still carry their
  // real owner, so a missing link is no evidence of a stamp.
  if (!consumerProfileOid && server.source === 'consumer_provider_template') return;

  let expectedOwner = await getConsumerOwnerForProfile({
    instance: server.instance,
    consumerProfileOid
  });

  let expectedIdentityActorId = expectedOwner.identityActorId ?? null;
  let expectedIdentityId = expectedOwner.identityId ?? null;

  let usesOwnIntegrationInstance = !!server.subspaceIntegrationInstanceId;
  let current = getCurrentOwner({ backing, usesOwnIntegrationInstance });

  let isActorCorrect = current.identityActorId === expectedIdentityActorId;
  let isIdentityCorrect =
    usesOwnIntegrationInstance || current.identityId === expectedIdentityId;

  let hasCurrentIdentity = current.actors.some(actor => !!actor) || !!current.identity;

  if (
    !(isActorCorrect && isIdentityCorrect) &&
    hasCurrentIdentity &&
    isConsumerOwnedIdentity(current)
  ) {
    await ensureMagicMcpServerBacking({
      instance: server.instance,
      server,
      owner: {
        identityActorId: expectedIdentityActorId,
        identityId: expectedIdentityId
      }
    });
  }

  // Null owners are filled by the owner actor backfill; only consumer owners can be stamps.
  if (
    server.ownerActor?.type !== 'consumer' &&
    server.ownerActor?.type !== 'organization_member'
  )
    return;

  let expectedOwnerActorOid = await resolveOwnerActorOid({
    identityActorId: getExpectedOwnerActorId({
      expectedIdentityActorId,
      backing,
      usesOwnIntegrationInstance
    })
  });
  if (server.ownerActorOid === expectedOwnerActorOid) return;

  await db.magicMcpServer.updateMany({
    where: { oid: server.oid, ownerActorOid: server.ownerActorOid },
    data: { ownerActorOid: expectedOwnerActorOid }
  });
};

export let reconcileMagicMcpServerOwnerIdentityQueueProcessor =
  reconcileMagicMcpServerOwnerIdentityQueue.process(
    async data => await reconcileMagicMcpServerOwnerIdentity(data)
  );

export let reconcileMagicMcpEndpointOwnerIdentitiesManyQueue = createQueue<{
  cursor?: string;
}>({
  name: 'magic/endpoint/ownerIdentity/reconcile/many',
  workerOpts: { concurrency: 1 }
});

export let reconcileMagicMcpEndpointOwnerIdentitiesManyQueueProcessor =
  reconcileMagicMcpEndpointOwnerIdentitiesManyQueue.process(async data => {
    let endpoints = await db.magicMcpEndpoint.findMany({
      where: {
        ...reconcilableEndpointWhere,
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: OWNER_IDENTITY_RECONCILE_BATCH_SIZE,
      select: { id: true }
    });
    if (!endpoints.length) return;

    await reconcileMagicMcpEndpointOwnerIdentityQueue.addManyWithOps(
      endpoints.map(endpoint => ({
        data: { magicMcpEndpointId: endpoint.id },
        opts: { id: endpoint.id }
      }))
    );

    if (endpoints.length === OWNER_IDENTITY_RECONCILE_BATCH_SIZE) {
      await reconcileMagicMcpEndpointOwnerIdentitiesManyQueue.add(
        { cursor: endpoints[endpoints.length - 1]!.id },
        dailyPacedDelay()
      );
    }
  });

export let reconcileMagicMcpEndpointOwnerIdentityQueue = createQueue<{
  magicMcpEndpointId: string;
}>({
  name: 'magic/endpoint/ownerIdentity/reconcile/single',
  workerOpts: { concurrency: 5, limiter: { max: 10, duration: 1000 } }
});

let isIdentityCarriedByMember = (d: { backing: EndpointBacking }) => {
  let group = d.backing.integrationGroup;

  return d.backing.servers.some(server => {
    let integrationInstance = server.magicMcpServerBacking.integrationInstance;

    return (
      (integrationInstance.identityActor?.id ?? null) === (group.identityActor?.id ?? null) &&
      (integrationInstance.identity?.id ?? null) === (group.identity?.id ?? null)
    );
  });
};

let hasMemberWithIdentity = (d: { backing: EndpointBacking }) =>
  d.backing.servers.some(server => {
    let integrationInstance = server.magicMcpServerBacking.integrationInstance;

    return !!integrationInstance.identityActor || !!integrationInstance.identity;
  });

// Endpoints without a consumer profile copy their group identity from a member instance and
// keep it once no member carries one anymore, so a consumer identity stamped onto a member
// stays on every org endpoint containing that member until it is cleared explicitly.
export let reconcileMagicMcpEndpointOwnerIdentity = async (d: {
  magicMcpEndpointId: string;
}) => {
  let endpoint = await db.magicMcpEndpoint.findFirst({
    where: { id: d.magicMcpEndpointId, ...reconcilableEndpointWhere },
    include: { instance: true }
  });
  if (!endpoint) return;

  let backing = await magicMcpEndpointBackingService
    .getMagicMcpEndpointBackingById({
      instance: endpoint.instance,
      magicMcpEndpointBackingId: endpoint.id
    })
    .catch(error => {
      if (isServiceError(error) && error.data.code === 'not_found') return null;
      throw error;
    });
  if (!backing) return;

  let group = backing.integrationGroup;
  if (!group.identityActor && !group.identity) return;

  if (!isConsumerOwnedIdentity({ actors: [group.identityActor], identity: group.identity })) {
    return;
  }
  if (isIdentityCarriedByMember({ backing })) return;

  // Without an owner the backing picks the identity up from a member again, which keeps the
  // endpoint's session actor unset exactly as before.
  await ensureMagicMcpEndpointBacking({
    instance: endpoint.instance,
    endpoint,
    owner: hasMemberWithIdentity({ backing })
      ? undefined
      : { identityActorId: null, identityId: null }
  });
};

export let reconcileMagicMcpEndpointOwnerIdentityQueueProcessor =
  reconcileMagicMcpEndpointOwnerIdentityQueue.process(
    async data => await reconcileMagicMcpEndpointOwnerIdentity(data)
  );

export let magicOwnerIdentityQueueProcessor = combineQueueProcessors([
  magicMcpServerOwnerIdentityReconcileCron,
  reconcileMagicMcpServerOwnerIdentitiesManyQueueProcessor,
  reconcileMagicMcpServerOwnerIdentityQueueProcessor,
  reconcileMagicMcpEndpointOwnerIdentitiesManyQueueProcessor,
  reconcileMagicMcpEndpointOwnerIdentityQueueProcessor
]);
