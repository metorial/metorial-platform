import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, ID, Instance, MagicMcpEndpoint, MagicMcpServer, Prisma } from '@metorial/db';
import {
  ensureMagicMcpEndpointBacking,
  getMagicMcpEndpointSessionTemplateId
} from '../services/magicMcpEndpoint';
import {
  ensureMagicMcpServerBacking,
  getMagicMcpServerSessionTemplateId
} from '../services/magicMcpServer';
import { MagicMcpResolvedTarget } from './magicMcpTarget';

type MagicMcpServerForSession = MagicMcpServer & {
  instance: Instance;
};

type MagicMcpEndpointForSession = MagicMcpEndpoint &
  Prisma.MagicMcpEndpointGetPayload<{ include: { instance: true } }>;

let getMagicMcpSessionExpiresAt = async (instance: Instance, now: Date) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });
  let durationMinutes = project?.magicMcpSessionDurationMinutes;

  return new Date(now.getTime() + durationMinutes * 60 * 1000);
};

let getMagicMcpTargetInfo = async (d: MagicMcpResolvedTarget) => {
  if (d.type === 'server') {
    let sessionTemplateId = getMagicMcpServerSessionTemplateId(d.target);
    if (!sessionTemplateId) {
      throw new ServiceError(
        badRequestError({
          message: 'Magic MCP server is missing subspace session template configuration'
        })
      );
    }

    return {
      targetType: 'server' as const,
      target: d.target as MagicMcpServerForSession,
      instance: d.target.instance,
      mappingWhere: {
        magicMcpServerOid: d.target.oid
      },
      mappingData: {
        magicMcpServerOid: d.target.oid
      },
      sessionTemplateId,
      name: d.target.name ?? d.target.id,
      description: d.target.description ?? undefined
    };
  }

  let magicMcpEndpoint = d.target as MagicMcpEndpointForSession;
  let sessionTemplateId = getMagicMcpEndpointSessionTemplateId(magicMcpEndpoint);
  if (!sessionTemplateId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP endpoint is missing subspace session template configuration'
      })
    );
  }

  return {
    targetType: 'endpoint' as const,
    target: magicMcpEndpoint,
    instance: magicMcpEndpoint.instance,
    mappingWhere: {
      magicMcpEndpointOid: magicMcpEndpoint.oid
    },
    mappingData: {
      magicMcpEndpointOid: magicMcpEndpoint.oid
    },
    sessionTemplateId,
    name: magicMcpEndpoint.name ?? magicMcpEndpoint.id,
    description: magicMcpEndpoint.description ?? undefined
  };
};

let getExistingMapping = async (d: Awaited<ReturnType<typeof getMagicMcpTargetInfo>>) => {
  if (d.targetType === 'server') {
    return await db.magicMcpSession.findUnique({
      where: {
        magicMcpServerOid: d.mappingWhere.magicMcpServerOid
      }
    });
  }

  return await db.magicMcpSession.findUnique({
    where: {
      magicMcpEndpointOid: d.mappingWhere.magicMcpEndpointOid
    }
  });
};

let isReusableMapping = (
  mapping: Awaited<ReturnType<typeof getExistingMapping>>,
  target: Awaited<ReturnType<typeof getMagicMcpTargetInfo>>,
  subspaceSessionId: string,
  now: Date
) => {
  if (!mapping) return false;
  if (mapping.subspaceSessionId !== subspaceSessionId) return false;
  if (mapping.subspaceSessionTemplateId !== target.sessionTemplateId) return false;
  if (!mapping.expiresAt) return false;
  if (mapping.expiresAt <= now) return false;

  return true;
};

export let ensureMagicMcpSubspaceSession = async (magicMcpTarget: MagicMcpResolvedTarget) => {
  if (magicMcpTarget.type === 'server') {
    let server = await ensureMagicMcpServerBacking({
      instance: magicMcpTarget.target.instance,
      server: magicMcpTarget.target
    });
    Object.assign(magicMcpTarget.target, server);
  } else {
    let endpoint = await ensureMagicMcpEndpointBacking({
      instance: magicMcpTarget.target.instance,
      endpoint: magicMcpTarget.target
    });
    Object.assign(magicMcpTarget.target, endpoint);
  }

  let subspaceSessionId = magicMcpTarget.target.subspaceEphemeralManagedSessionId;
  if (!subspaceSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP backing session could not be resolved'
      })
    );
  }

  return subspaceSessionId;
};

export let syncMagicMcpSubspaceSession = async (
  magicMcpTarget: MagicMcpResolvedTarget,
  subspaceSessionId: string
) => {
  let target = await getMagicMcpTargetInfo(magicMcpTarget);
  let mapping = await getExistingMapping(target);
  let now = new Date();

  if (isReusableMapping(mapping, target, subspaceSessionId, now)) return mapping!;

  let expiresAt = await getMagicMcpSessionExpiresAt(target.instance, now);
  if (target.targetType === 'server') {
    return await db.magicMcpSession.upsert({
      where: {
        magicMcpServerOid: target.mappingWhere.magicMcpServerOid
      },
      update: {
        subspaceSessionId,
        subspaceSessionTemplateId: target.sessionTemplateId,
        expiresAt,
        isActive: true,
        isConsumerReconciled: true
      },
      create: {
        id: await ID.generateId('magicMcpServerSubspaceSession'),
        instanceOid: target.instance.oid,
        subspaceSessionId,
        subspaceSessionTemplateId: target.sessionTemplateId,
        expiresAt,
        isActive: true,
        isConsumerReconciled: true,
        ...target.mappingData
      }
    });
  }

  return await db.magicMcpSession.upsert({
    where: {
      magicMcpEndpointOid: target.mappingWhere.magicMcpEndpointOid
    },
    update: {
      subspaceSessionId,
      subspaceSessionTemplateId: target.sessionTemplateId,
      expiresAt,
      isActive: true,
      isConsumerReconciled: true
    },
    create: {
      id: await ID.generateId('magicMcpServerSubspaceSession'),
      instanceOid: target.instance.oid,
      subspaceSessionId,
      subspaceSessionTemplateId: target.sessionTemplateId,
      expiresAt,
      isActive: true,
      isConsumerReconciled: true,
      ...target.mappingData
    }
  });
};

export type MagicMcpSubspaceMapping = Awaited<ReturnType<typeof syncMagicMcpSubspaceSession>>;
