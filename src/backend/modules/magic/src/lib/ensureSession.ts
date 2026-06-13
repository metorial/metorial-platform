import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, ID, Instance, MagicMcpSession, Prisma } from '@metorial/db';
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

let getLoadedMagicMcpSession = (target: MagicMcpResolvedTarget) => {
  if (target.type === 'server') {
    return target.target.subspaceSession ?? null;
  }

  let subspaceSession = target.target.subspaceSession;
  if (Array.isArray(subspaceSession)) return subspaceSession[0] ?? null;

  return subspaceSession ?? null;
};

let isCurrentMagicMcpSession = (
  session: MagicMcpSession,
  d: {
    subspaceSessionId: string;
    backingSessionId: string;
  }
) =>
  session.subspaceSessionId === d.subspaceSessionId &&
  session.subspaceSessionTemplateId === d.backingSessionId &&
  session.isActive &&
  session.expiresAt == null;

let isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

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
    isActive: true
  };

  let uniqueWhere =
    target.type === 'server'
      ? { magicMcpServerOid: target.target.oid }
      : { magicMcpEndpointOid: target.target.oid };
  let loadedSession = getLoadedMagicMcpSession(target);

  if (
    loadedSession &&
    isCurrentMagicMcpSession(loadedSession, { subspaceSessionId, backingSessionId })
  ) {
    return loadedSession;
  }

  let existingSession =
    loadedSession ??
    (await db.magicMcpSession.findUnique({
      where: uniqueWhere
    }));

  if (
    existingSession &&
    isCurrentMagicMcpSession(existingSession, { subspaceSessionId, backingSessionId })
  ) {
    return existingSession;
  }

  if (existingSession) {
    return await db.magicMcpSession.update({
      where: { oid: existingSession.oid },
      data: {
        ...baseData,
        isConsumerReconciled: false
      }
    });
  }

  let createData =
    target.type === 'server'
      ? {
          magicMcpServerOid: target.target.oid
        }
      : {
          magicMcpEndpointOid: target.target.oid
        };

  try {
    return await db.magicMcpSession.create({
      data: {
        id: await ID.generateId('magicMcpServerSubspaceSession'),
        ...createData,
        ...baseData,
        isConsumerReconciled: false
      }
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    let current = await db.magicMcpSession.findUniqueOrThrow({
      where: uniqueWhere
    });

    if (isCurrentMagicMcpSession(current, { subspaceSessionId, backingSessionId })) {
      return current;
    }

    return await db.magicMcpSession.update({
      where: { oid: current.oid },
      data: {
        ...baseData,
        isConsumerReconciled: false
      }
    });
  }
};

export type MagicMcpSubspaceMapping = Awaited<
  ReturnType<typeof ensureMagicMcpSubspaceSession>
>;
