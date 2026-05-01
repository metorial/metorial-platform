import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, ID, Instance, MagicMcpEndpoint, MagicMcpServer, Prisma } from '@metorial/db';
import { ensureMagicMcpEndpointBacking } from '../services/magicMcpEndpoint';
import { ensureMagicMcpServerBacking } from '../services/magicMcpServer';
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
    if (!d.target.subspaceSessionTemplateId) {
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
      sessionTemplateId: d.target.subspaceSessionTemplateId,
      name: d.target.name ?? d.target.id,
      description: d.target.description ?? undefined
    };
  }

  let magicMcpEndpoint = d.target as MagicMcpEndpointForSession;
  if (!magicMcpEndpoint.subspaceSessionTemplateId) {
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
    sessionTemplateId: magicMcpEndpoint.subspaceSessionTemplateId,
    name: magicMcpEndpoint.name ?? magicMcpEndpoint.id,
    description: magicMcpEndpoint.description ?? undefined
  };
};

let getExistingMapping = async (d: Awaited<ReturnType<typeof getMagicMcpTargetInfo>>) => {
  if (d.targetType === 'server') {
    return await db.magicMcpSession.findUnique({
      where: {
        magicMcpServerOid: d.mappingWhere.magicMcpServerOid,
        isActive: true
      }
    });
  }

  return await db.magicMcpSession.findUnique({
    where: {
      magicMcpEndpointOid: d.mappingWhere.magicMcpEndpointOid,
      isActive: true
    }
  });
};

let getWinnerMapping = async (d: Awaited<ReturnType<typeof getMagicMcpTargetInfo>>) => {
  return await getExistingMapping(d);
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

let deleteSubspaceSessionSafe = async (d: {
  instance: Instance;
  subspaceSessionId: string;
}) => {
  void d;
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

  try {
    if (mapping) {
      let updated = await db.magicMcpSession.updateMany({
        where: {
          oid: mapping.oid,
          subspaceSessionId: mapping.subspaceSessionId
        },
        data: {
          subspaceSessionId,
          subspaceSessionTemplateId: target.sessionTemplateId,
          expiresAt,
          isActive: true,
          isConsumerReconciled: true
        }
      });
      let winner = await getWinnerMapping(target);
      if (!winner) {
        throw new ServiceError(
          badRequestError({
            message: 'Failed to persist magic MCP session mapping'
          })
        );
      }
      if (updated.count === 0 && winner.subspaceSessionId !== subspaceSessionId) {
        void deleteSubspaceSessionSafe({
          instance: target.instance,
          subspaceSessionId
        });
      }
      if (updated.count > 0 && mapping.subspaceSessionId !== winner.subspaceSessionId) {
        void deleteSubspaceSessionSafe({
          instance: target.instance,
          subspaceSessionId: mapping.subspaceSessionId
        });
      }

      return winner;
    }

    return await db.magicMcpSession.create({
      data: {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      let winner = await getWinnerMapping(target);
      if (winner) {
        if (winner.subspaceSessionId !== subspaceSessionId) {
          void deleteSubspaceSessionSafe({
            instance: target.instance,
            subspaceSessionId
          });
        }
        return winner;
      }
    }

    throw error;
  }
};

export type MagicMcpSubspaceMapping = Awaited<ReturnType<typeof syncMagicMcpSubspaceSession>>;
