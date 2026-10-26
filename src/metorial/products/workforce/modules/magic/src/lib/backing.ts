import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { db, Instance, MagicMcpEndpoint, MagicMcpServer, Prisma } from '@metorial/db';
import {
  integrationInstanceService,
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
import { isIntegrationInstanceUnavailableError } from './integrationInstanceUnavailable';
import { magicMcpBackingProvidersUnavailableError } from './magicMcpConnectHealth';
import { resolveOwnerActorOid } from './ownerActor';

let magicMcpEndpointBackingInclude = {
  consumerProfile: true,
  servers: {
    include: {
      magicMcpServer: true
    }
  }
} satisfies Prisma.MagicMcpEndpointInclude;

type MagicMcpEndpointWithBackingRelations = Prisma.MagicMcpEndpointGetPayload<{
  include: typeof magicMcpEndpointBackingInclude;
}>;

export type ConsumerOwner = {
  identityActorId?: string | null;
  identityId?: string | null;
};

export type MagicMcpBackingProviderInput = {
  providerDeploymentId: string;
  providerConfigId?: string | null;
  providerAuthConfigId?: string | null;
  toolFilters?: PrismaJson.ToolFilter | null;
};

type MagicMcpServerBackingSpec = Pick<
  MagicMcpServer,
  | 'id'
  | 'name'
  | 'description'
  | 'metadata'
  | 'providerTemplateId'
  | 'subspaceIntegrationInstanceId'
  | 'legacySubspaceSessionTemplateId'
> &
  Partial<Pick<MagicMcpServer, 'ownerActorOid' | 'isOwnerLocked' | 'isOwnerOnlyVisible'>>;

let getOwnerActorId = async (ownerActorOid: bigint | null | undefined) => {
  if (!ownerActorOid) return null;

  let actor = await db.identityActor.findUnique({
    where: { oid: ownerActorOid },
    select: { id: true }
  });

  return actor?.id ?? null;
};

let resolveBackingOwner = async (d: {
  ownerActorOid?: bigint | null;
  isOwnerLocked?: boolean;
  isOwnerOnlyVisible?: boolean;
  owner: ConsumerOwner;
}) => ({
  ownerActorId: (await getOwnerActorId(d.ownerActorOid)) ?? d.owner.identityActorId ?? null,
  isOwnerLocked: !!d.isOwnerLocked,
  isOwnerOnlyVisible: !!d.isOwnerOnlyVisible
});

let getMagicMcpSessionDuration = async (instance: Instance) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });

  return project.magicMcpSessionDurationMinutes;
};

export let getConsumerOwnerForProfile = async (d: {
  instance: Instance;
  consumerProfileOid?: bigint | null;
}): Promise<ConsumerOwner> => {
  if (!d.consumerProfileOid) return {};

  let actor = await db.consumerActor.findFirst({
    where: {
      instanceOid: d.instance.oid,
      consumerProfileOid: d.consumerProfileOid,
      isDefault: true
    },
    select: {
      id: true,
      defaultIdentityId: true
    }
  });

  return {
    identityActorId: actor?.id ?? null,
    identityId: actor?.defaultIdentityId ?? null
  };
};

let findOldestConsumerIntegrationProfileOid = async (d: {
  instance: Instance;
  server: Pick<MagicMcpServer, 'oid'>;
  isManaged: boolean;
}) => {
  let link = await db.consumerIntegration.findFirst({
    where: {
      instanceOid: d.instance.oid,
      magicMcpServerOid: d.server.oid,
      isManaged: d.isManaged
    },
    select: {
      consumerProfileOid: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return link?.consumerProfileOid ?? null;
};

// Managed links are also materialized for every consumer that connects to a server, so they
// only identify the owner of servers a consumer deployed. Servers created for a consumer
// through the API get the unmanaged link from the consumer-owned access grant.
export let getConsumerOwnerProfileOidForServer = async (d: {
  instance: Instance;
  server: Pick<MagicMcpServer, 'oid' | 'source'>;
}) => {
  let grantedProfileOid = await findOldestConsumerIntegrationProfileOid({
    ...d,
    isManaged: false
  });
  if (grantedProfileOid) return grantedProfileOid;

  if (d.server.source !== 'consumer_provider_template') return null;

  return await findOldestConsumerIntegrationProfileOid({ ...d, isManaged: true });
};

export let getConsumerOwnerForServer = async (d: {
  instance: Instance;
  server: Pick<MagicMcpServer, 'oid' | 'source'>;
}): Promise<ConsumerOwner> =>
  await getConsumerOwnerForProfile({
    instance: d.instance,
    consumerProfileOid: await getConsumerOwnerProfileOidForServer(d)
  });

let toBackingToolFilter = (toolFilter: unknown): PrismaJson.ToolFilter | null => {
  if (!toolFilter) return null;

  return toolFilter as PrismaJson.ToolFilter;
};

export let applyMagicMcpServerBacking = async (d: {
  instance: Instance;
  server: MagicMcpServerBackingSpec;
  owner: ConsumerOwner;
  providers?: MagicMcpBackingProviderInput[];
  isReconciliation?: boolean;
  maxSessionDurationInMinutes?: number;
}) => {
  let maxSessionDurationInMinutes =
    d.maxSessionDurationInMinutes ?? (await getMagicMcpSessionDuration(d.instance));
  let providerTemplateBackingId = d.server.providerTemplateId ?? null;

  let ownerIntegrationId: string | null = null;
  if (d.server.subspaceIntegrationInstanceId && !providerTemplateBackingId) {
    let integrationInstance = await integrationInstanceService.getIntegrationInstanceById({
      instance: d.instance,
      integrationInstanceId: d.server.subspaceIntegrationInstanceId
    });
    ownerIntegrationId = integrationInstance.integration.id;
  }

  return await magicMcpServerBackingService.upsertMagicMcpServerBacking({
    instance: d.instance,
    input: {
      id: d.server.id,
      providerTemplateBackingId,
      ownerIntegrationId,
      ownerIntegrationInstanceId: d.server.subspaceIntegrationInstanceId,
      name: d.server.name,
      description: d.server.description,
      metadata: d.server.metadata as Record<string, any>,
      maxSessionDurationInMinutes,
      isReconciliation: d.isReconciliation,
      legacySessionTemplateId: d.server.legacySubspaceSessionTemplateId,
      ...d.owner,
      ...(await resolveBackingOwner({
        ownerActorOid: d.server.ownerActorOid,
        isOwnerLocked: d.server.isOwnerLocked,
        isOwnerOnlyVisible: d.server.isOwnerOnlyVisible,
        owner: d.owner
      })),
      ...(d.providers?.length ? { providers: d.providers } : {})
    }
  });
};

export let getMagicMcpServerBackingCoreFields = (
  backing: Awaited<ReturnType<typeof applyMagicMcpServerBacking>>
) => ({
  hasSubspaceBacking: true,
  isSubspaceBackingReconciling: false,
  ownerType: backing.ownerType,
  subspaceEphemeralManagedSessionId: backing.ephemeralManagedSession.id,
  ...(backing.isOwnerLocked ? { isOwnerLocked: true } : {}),
  ...((backing as { isOwnerOnlyVisible?: boolean }).isOwnerOnlyVisible
    ? { isOwnerOnlyVisible: true }
    : {})
});

export let ensureMagicMcpServerBacking = async (d: {
  instance: Instance;
  server: MagicMcpServer;
  owner?: ConsumerOwner;
  providers?: MagicMcpBackingProviderInput[];
  isReconciliation?: boolean;
  maxSessionDurationInMinutes?: number;
}) => {
  let owner =
    d.owner ?? (await getConsumerOwnerForServer({ instance: d.instance, server: d.server }));

  let ownerActorOid = d.server.ownerActorOid ?? (await resolveOwnerActorOid(owner));

  let backing = await applyMagicMcpServerBacking({
    instance: d.instance,
    server: { ...d.server, ownerActorOid },
    owner,
    providers: d.providers,
    isReconciliation: d.isReconciliation,
    maxSessionDurationInMinutes: d.maxSessionDurationInMinutes
  });

  return await db.magicMcpServer.update({
    where: { oid: d.server.oid },
    data: {
      ...getMagicMcpServerBackingCoreFields(backing),
      ...(ownerActorOid ? { ownerActorOid } : {})
    }
  });
};

let magicMcpServerNeedsReconnectError = () =>
  new ServiceError(
    preconditionFailedError({
      code: 'magic_mcp_server_needs_reconnect',
      message:
        'The account connected to this integration was removed. Reconnect the integration to keep using it.'
    })
  );

let rebuildOrNeedsReconnect = async <T>(cb: () => Promise<T>) => {
  try {
    return await cb();
  } catch (error) {
    if (isIntegrationInstanceUnavailableError(error)) {
      throw magicMcpServerNeedsReconnectError();
    }
    throw error;
  }
};

let isHealableServer = (server: MagicMcpServer) =>
  server.hasSubspaceBacking && !server.legacySubspaceSessionTemplateId;

export let healMagicMcpServerBacking = async (d: {
  instance: Instance;
  server: MagicMcpServer;
}) => {
  if (!isHealableServer(d.server)) return d.server;

  let statuses = await magicMcpServerBackingService.getMagicMcpServerBackingStatuses({
    instance: d.instance,
    magicMcpServerBackingIds: [d.server.id]
  });
  let status = statuses.get(d.server.id);

  if (status === 'needs_reconnect') throw magicMcpServerNeedsReconnectError();
  if (status === 'missing_providers') throw magicMcpBackingProvidersUnavailableError();
  if (status === 'healthy') return d.server;

  return await rebuildOrNeedsReconnect(() =>
    ensureMagicMcpServerBacking({
      instance: d.instance,
      server: d.server
    })
  );
};

export let healMagicMcpEndpointBacking = async (d: {
  instance: Instance;
  endpoint: MagicMcpEndpointWithBackingRelations;
}) => {
  if (!d.endpoint.hasSubspaceBacking) return d.endpoint;

  let servers = d.endpoint.servers
    .map(server => server.magicMcpServer)
    .filter(isHealableServer);

  let [serverStatuses, endpointStatus] = await Promise.all([
    magicMcpServerBackingService.getMagicMcpServerBackingStatuses({
      instance: d.instance,
      magicMcpServerBackingIds: servers.map(server => server.id)
    }),
    magicMcpEndpointBackingService.getMagicMcpEndpointBackingStatus({
      instance: d.instance,
      magicMcpEndpointBackingId: d.endpoint.id
    })
  ]);

  let memberStatuses = servers.map(server => serverStatuses.get(server.id));
  if (memberStatuses.includes('needs_reconnect')) throw magicMcpServerNeedsReconnectError();
  if (memberStatuses.includes('missing_providers')) {
    throw magicMcpBackingProvidersUnavailableError();
  }
  if (endpointStatus === 'healthy' && memberStatuses.every(status => status === 'healthy')) {
    return d.endpoint;
  }

  let staleServers = servers.filter(server => serverStatuses.get(server.id) !== 'healthy');

  return await rebuildOrNeedsReconnect(async () => {
    for (let server of staleServers) {
      await ensureMagicMcpServerBacking({ instance: d.instance, server });
    }

    return await ensureMagicMcpEndpointBacking({
      instance: d.instance,
      endpoint: d.endpoint
    });
  });
};

export let ensureMagicMcpEndpointBacking = async (d: {
  instance: Instance;
  endpoint: Pick<MagicMcpEndpoint, 'oid'>;
  owner?: ConsumerOwner;
  isReconciliation?: boolean;
}) => {
  let endpoint = await db.magicMcpEndpoint.findUniqueOrThrow({
    where: { oid: d.endpoint.oid },
    include: magicMcpEndpointBackingInclude
  });

  let [owner, maxSessionDurationInMinutes] = await Promise.all([
    d.owner ??
      getConsumerOwnerForProfile({
        instance: d.instance,
        consumerProfileOid: endpoint.consumerProfileOid
      }),
    getMagicMcpSessionDuration(d.instance)
  ]);

  // Member servers keep their own owner. A server can sit in endpoints of many consumers,
  // so the endpoint's consumer identity only goes onto the endpoint's own backing.
  // Servers are shared across endpoints and backed concurrently elsewhere, so they are backed
  // one at a time from a fresh read to avoid piling up on the same backing locks.
  for (let { magicMcpServer } of endpoint.servers) {
    if (magicMcpServer.hasSubspaceBacking) continue;

    let server = await db.magicMcpServer.findUniqueOrThrow({
      where: { oid: magicMcpServer.oid }
    });
    if (server.hasSubspaceBacking) continue;

    await ensureMagicMcpServerBacking({
      instance: d.instance,
      server,
      isReconciliation: d.isReconciliation,
      maxSessionDurationInMinutes
    });
  }

  let ownerActorOid =
    endpoint.ownerActorOid ??
    (await resolveOwnerActorOid(
      await getConsumerOwnerForProfile({
        instance: d.instance,
        consumerProfileOid: endpoint.consumerProfileOid
      })
    ));

  let backing = await magicMcpEndpointBackingService.upsertMagicMcpEndpointBacking({
    instance: d.instance,
    input: {
      id: endpoint.id,
      name: endpoint.name,
      description: endpoint.description,
      metadata: endpoint.metadata as Record<string, any>,
      maxSessionDurationInMinutes,
      isReconciliation: d.isReconciliation,
      ...owner,
      ownerActorId: await getOwnerActorId(ownerActorOid),
      isOwnerLocked: endpoint.isOwnerLocked,
      ...{ isOwnerOnlyVisible: endpoint.isOwnerOnlyVisible },
      servers: endpoint.servers.map(server => ({
        id: server.id,
        magicMcpServerBackingId: server.magicMcpServer.id,
        toolFilters: toBackingToolFilter(server.toolFilters)
      }))
    }
  });

  return await db.magicMcpEndpoint.update({
    where: { oid: endpoint.oid },
    data: {
      hasSubspaceBacking: true,
      subspaceEphemeralManagedSessionId: backing.ephemeralManagedSession.id,
      isSubspaceBackingReconciling: false,
      ...(ownerActorOid ? { ownerActorOid } : {}),
      ...(backing.isOwnerLocked ? { isOwnerLocked: true } : {}),
      ...((backing as { isOwnerOnlyVisible?: boolean }).isOwnerOnlyVisible
        ? { isOwnerOnlyVisible: true }
        : {})
    },
    include: magicMcpEndpointBackingInclude
  });
};

export let setMagicMcpEndpointBackingOwnerLock = async (d: {
  instance: Instance;
  endpoint: MagicMcpEndpoint;
  isOwnerLocked: boolean;
}) =>
  await magicMcpEndpointBackingService.setMagicMcpEndpointBackingOwnerLock({
    instance: d.instance,
    magicMcpEndpointBackingId: d.endpoint.id,
    isOwnerLocked: d.isOwnerLocked
  });
