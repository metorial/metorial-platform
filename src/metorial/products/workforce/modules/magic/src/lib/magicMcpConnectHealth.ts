import {
  badRequestError,
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { db, type Instance } from '@metorial/db';
import { magicMcpServerProviderService } from '@metorial-subspace/module-integration';
import { MagicMcpResolvedTarget } from './magicMcpTarget';

let getInactiveLinkedResourceMessage = (resource: 'server' | 'endpoint' | 'group') => {
  if (resource === 'server') {
    return 'The magic MCP server is no longer active';
  }
  if (resource === 'endpoint') {
    return 'The magic MCP endpoint is no longer active';
  }
  return 'The magic MCP group is no longer active';
};

export let assertMagicMcpTargetLinkedResourcesActive = async (
  target: MagicMcpResolvedTarget
) => {
  if (target.type === 'server') {
    if (target.target.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: getInactiveLinkedResourceMessage('server')
        })
      );
    }
    return;
  }

  if (target.target.status !== 'active') {
    throw new ServiceError(
      preconditionFailedError({
        message: getInactiveLinkedResourceMessage('endpoint')
      })
    );
  }

  if (target.target.servers?.length) {
    let hasInactiveServer = target.target.servers.some(
      server => server.magicMcpServer.status !== 'active'
    );

    if (hasInactiveServer) {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'The magic MCP endpoint is linked to one or more magic MCP servers that are no longer active'
        })
      );
    }

    return;
  }

  let inactiveEndpointServerCount = await db.magicMcpEndpointServer.count({
    where: {
      magicMcpEndpointOid: target.target.oid,
      magicMcpServer: {
        status: {
          not: 'active'
        }
      }
    }
  });

  if (inactiveEndpointServerCount > 0) {
    throw new ServiceError(
      preconditionFailedError({
        message:
          'The magic MCP endpoint is linked to one or more magic MCP servers that are no longer active'
      })
    );
  }
};

export let assertMagicMcpServerBackingProvidersActive = async (d: {
  instance: Instance;
  magicMcpServerBackingId: string;
}) => {
  let paginator = await magicMcpServerProviderService.listMagicMcpServerProviders({
    instance: d.instance,
    magicMcpServerBackingIds: [d.magicMcpServerBackingId],
    status: ['active']
  });
  let result = await paginator.run({ limit: 1 });

  if (!result.items.length) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Magic MCP server has no active providers and cannot accept connections.',
        code: 'magic_mcp_backing_providers_unavailable'
      })
    );
  }
};

export let assertMagicMcpEndpointBackingProvidersActive = async (d: {
  instance: Instance;
  endpointOid: bigint;
}) => {
  let endpointServers = await db.magicMcpEndpointServer.findMany({
    where: {
      magicMcpEndpointOid: d.endpointOid,
      magicMcpServer: {
        status: 'active'
      }
    },
    select: {
      magicMcpServer: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  if (!endpointServers.length) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Magic MCP endpoint has no active servers and cannot accept connections.',
        code: 'magic_mcp_endpoint_servers_unavailable'
      })
    );
  }

  for (let endpointServer of endpointServers) {
    await assertMagicMcpServerBackingProvidersActive({
      instance: d.instance,
      magicMcpServerBackingId: endpointServer.magicMcpServer.id
    });
  }
};

export let assertMagicMcpTargetReadyForConnect = async (target: MagicMcpResolvedTarget) => {
  await assertMagicMcpTargetLinkedResourcesActive(target);

  if (target.type === 'server') {
    await assertMagicMcpServerBackingProvidersActive({
      instance: target.target.instance as Instance,
      magicMcpServerBackingId: target.target.id
    });
    return;
  }

  await assertMagicMcpEndpointBackingProvidersActive({
    instance: target.target.instance as Instance,
    endpointOid: target.target.oid
  });
};

export let getMagicMcpConnectUnauthorizedMessage = (message: string) =>
  new ServiceError(unauthorizedError({ message }));

export let getMagicMcpConnectBadRequestMessage = (message: string) =>
  new ServiceError(badRequestError({ message }));
