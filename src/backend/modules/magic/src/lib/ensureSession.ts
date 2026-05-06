import { badRequestError, ServiceError } from '@lowerdeck/error';
import { ID, Instance, withTransaction } from '@metorial/db';
import { ensureMagicMcpEndpointBacking, ensureMagicMcpServerBacking } from './backing';
import { MagicMcpResolvedTarget } from './magicMcpTarget';

let ensureServerBackingSession = async (
  target: MagicMcpResolvedTarget & { type: 'server' }
) => {
  let server = target.target;
  if (!server.hasSubspaceBacking || !server.subspaceEphemeralManagedSessionId) {
    server = {
      ...server,
      ...(await ensureMagicMcpServerBacking({
        instance: server.instance as Instance,
        server,
        isReconciliation: true
      }))
    };
  }

  if (!server.subspaceEphemeralManagedSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP server backing session could not be resolved.',
        code: 'magic_mcp_backing_session_missing'
      })
    );
  }

  return server.subspaceEphemeralManagedSessionId;
};

let ensureEndpointBackingSession = async (
  target: MagicMcpResolvedTarget & { type: 'endpoint' }
) => {
  let endpoint = target.target;
  if (!endpoint.hasSubspaceBacking || !endpoint.subspaceEphemeralManagedSessionId) {
    let backingEndpoint = await ensureMagicMcpEndpointBacking({
      instance: endpoint.instance as Instance,
      endpoint,
      isReconciliation: true
    });
    endpoint = {
      ...endpoint,
      subspaceEphemeralManagedSessionId: backingEndpoint.subspaceEphemeralManagedSessionId,
      hasSubspaceBacking: backingEndpoint.hasSubspaceBacking
    };
  }

  if (!endpoint.subspaceEphemeralManagedSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP endpoint backing session could not be resolved.',
        code: 'magic_mcp_backing_session_missing'
      })
    );
  }

  return endpoint.subspaceEphemeralManagedSessionId;
};

export let ensureMagicMcpSubspaceSession = async (target: MagicMcpResolvedTarget) => {
  if (target.type === 'server') {
    return await ensureServerBackingSession(target);
  }

  return await ensureEndpointBackingSession(target);
};

export let syncMagicMcpSubspaceSession = async (
  target: MagicMcpResolvedTarget,
  subspaceSessionId: string
) => {
  let backingSessionId = await ensureMagicMcpSubspaceSession(target);
  let baseData = {
    instanceOid: target.target.instance.oid,
    subspaceSessionId,
    subspaceSessionTemplateId: backingSessionId,
    expiresAt: null,
    isActive: true,
    isConsumerReconciled: false
  };

  return await withTransaction(async db => {
    if (target.type === 'server') {
      return await db.magicMcpSession.upsert({
        where: {
          magicMcpServerOid: target.target.oid
        },
        create: {
          id: await ID.generateId('magicMcpServerSubspaceSession'),
          magicMcpServerOid: target.target.oid,
          ...baseData
        },
        update: baseData
      });
    }

    return await db.magicMcpSession.upsert({
      where: {
        magicMcpEndpointOid: target.target.oid
      },
      create: {
        id: await ID.generateId('magicMcpServerSubspaceSession'),
        magicMcpEndpointOid: target.target.oid,
        ...baseData
      },
      update: baseData
    });
  });
};

export type MagicMcpSubspaceMapping = Awaited<
  ReturnType<typeof ensureMagicMcpSubspaceSession>
>;
