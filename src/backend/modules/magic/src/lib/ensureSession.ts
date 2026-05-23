import { badRequestError, ServiceError } from '@mtsrc/error';
import { ID, Instance, withTransaction } from '@metorial/db';
import {
  ensureMagicMcpEndpointBacking,
  ensureMagicMcpServerBacking,
  waitForMagicMcpEndpointBackingReady,
  waitForMagicMcpServerBackingReady
} from './backing';
import {
  assertMagicMcpTargetLinkedResourcesActive,
  assertMagicMcpTargetReadyForConnect
} from './magicMcpConnectHealth';
import { MagicMcpResolvedTarget } from './magicMcpTarget';

let ensureServerBackingSession = async (
  target: MagicMcpResolvedTarget & { type: 'server' }
) => {
  let targetServer = target.target;
  if (
    !targetServer.hasSubspaceBacking ||
    !targetServer.subspaceEphemeralManagedSessionId ||
    targetServer.isSubspaceBackingReconciling
  ) {
    let latest = await waitForMagicMcpServerBackingReady({
      instance: target.target.instance as Instance,
      server: target.target
    });
    if (latest) targetServer = { ...targetServer, ...latest };
  }

  if (
    targetServer.hasSubspaceBacking &&
    targetServer.subspaceEphemeralManagedSessionId &&
    !targetServer.isSubspaceBackingReconciling
  ) {
    await assertMagicMcpTargetLinkedResourcesActive(target);
    return targetServer.subspaceEphemeralManagedSessionId;
  }

  let server = {
    ...targetServer,
    ...(await ensureMagicMcpServerBacking({
      instance: target.target.instance as Instance,
      server: targetServer,
      isReconciliation: true,
      deferReconcile: false
    }))
  };

  if (!server.subspaceEphemeralManagedSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP server backing session could not be resolved.',
        code: 'magic_mcp_backing_session_missing'
      })
    );
  }

  await assertMagicMcpTargetReadyForConnect(target);

  return server.subspaceEphemeralManagedSessionId;
};

let ensureEndpointBackingSession = async (
  target: MagicMcpResolvedTarget & { type: 'endpoint' }
) => {
  let targetEndpoint = target.target;
  if (
    !targetEndpoint.hasSubspaceBacking ||
    !targetEndpoint.subspaceEphemeralManagedSessionId ||
    targetEndpoint.isSubspaceBackingReconciling
  ) {
    let latest = await waitForMagicMcpEndpointBackingReady({
      instance: target.target.instance as Instance,
      endpoint: target.target
    });
    if (latest) {
      targetEndpoint = {
        ...targetEndpoint,
        hasSubspaceBacking: latest.hasSubspaceBacking,
        subspaceEphemeralManagedSessionId: latest.subspaceEphemeralManagedSessionId,
        isSubspaceBackingReconciling: latest.isSubspaceBackingReconciling
      };
    }
  }

  if (
    targetEndpoint.hasSubspaceBacking &&
    targetEndpoint.subspaceEphemeralManagedSessionId &&
    !targetEndpoint.isSubspaceBackingReconciling
  ) {
    await assertMagicMcpTargetLinkedResourcesActive(target);
    return targetEndpoint.subspaceEphemeralManagedSessionId;
  }

  let endpoint = await ensureMagicMcpEndpointBacking({
    instance: target.target.instance as Instance,
    endpoint: targetEndpoint,
    isReconciliation: true,
    deferReconcile: false
  });

  if (!endpoint.subspaceEphemeralManagedSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP endpoint backing session could not be resolved.',
        code: 'magic_mcp_backing_session_missing'
      })
    );
  }

  await assertMagicMcpTargetReadyForConnect(target);

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
  subspaceSessionId: string,
  backingSessionId: string
) => {
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
