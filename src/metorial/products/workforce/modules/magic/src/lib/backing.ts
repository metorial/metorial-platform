import { isServiceError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { db, Instance, MagicMcpEndpoint, MagicMcpServer, Prisma } from '@metorial/db';
import {
  integrationInstanceService,
  magicMcpEndpointBackingService,
  magicMcpServerBackingService
} from '@metorial-subspace/module-integration';
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
>;

let getMagicMcpSessionDuration = async (instance: Instance) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });

  return project.magicMcpSessionDurationMinutes;
};

let getConsumerOwnerForProfile = async (d: {
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

export let getConsumerOwnerForServer = async (d: {
  instance: Instance;
  server: Pick<MagicMcpServer, 'oid'>;
}): Promise<ConsumerOwner> => {
  let owner = await db.consumerIntegration.findFirst({
    where: {
      instanceOid: d.instance.oid,
      magicMcpServerOid: d.server.oid,
      isManaged: true
    },
    select: {
      consumerProfileOid: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return await getConsumerOwnerForProfile({
    instance: d.instance,
    consumerProfileOid: owner?.consumerProfileOid
  });
};

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
  subspaceEphemeralManagedSessionId: backing.ephemeralManagedSession.id
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

  let backing = await applyMagicMcpServerBacking({
    instance: d.instance,
    server: d.server,
    owner,
    providers: d.providers,
    isReconciliation: d.isReconciliation,
    maxSessionDurationInMinutes: d.maxSessionDurationInMinutes
  });

  let ownerActorOid = d.server.ownerActorOid ?? (await resolveOwnerActorOid(owner));

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

let isIntegrationInstanceUnavailableError = (error: unknown) =>
  isServiceError(error) &&
  (error.data.code === 'integration_instance_not_active' ||
    (error.data.code === 'not_found' && error.data.entity === 'integration.instance'));

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
  isReconciliation?: boolean;
}) => {
  let endpoint = await db.magicMcpEndpoint.findUniqueOrThrow({
    where: { oid: d.endpoint.oid },
    include: magicMcpEndpointBackingInclude
  });

  let [owner, maxSessionDurationInMinutes] = await Promise.all([
    getConsumerOwnerForProfile({
      instance: d.instance,
      consumerProfileOid: endpoint.consumerProfileOid
    }),
    getMagicMcpSessionDuration(d.instance)
  ]);

  await Promise.all(
    endpoint.servers.map(async server => {
      if (server.magicMcpServer.hasSubspaceBacking && !endpoint.consumerProfileOid) return;

      await ensureMagicMcpServerBacking({
        instance: d.instance,
        server: server.magicMcpServer,
        ...(endpoint.consumerProfileOid ? { owner } : {}),
        isReconciliation: d.isReconciliation,
        maxSessionDurationInMinutes
      });
    })
  );

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
      isSubspaceBackingReconciling: false
    },
    include: magicMcpEndpointBackingInclude
  });
};
