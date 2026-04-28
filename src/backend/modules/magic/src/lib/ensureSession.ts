import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, ID, Instance, MagicMcpEndpoint, MagicMcpServer, Prisma } from '@metorial/db';
import {
  subspaceSessionService,
  subspaceSessionTemplateProviderService,
  subspaceSessionTemplateService
} from '@metorial/module-subspace';
import { createHash } from 'crypto';
import { magicMcpEndpointInclude } from '../services';
import { MagicMcpResolvedTarget } from './magicMcpTarget';

type MagicMcpServerForSession = MagicMcpServer & {
  instance: Instance;
};

type MagicMcpEndpointForSession = MagicMcpEndpoint &
  Prisma.MagicMcpEndpointGetPayload<{
    include: typeof magicMcpEndpointInclude & {
      instance: true;
    };
  }>;

type SessionTemplateProvider = Awaited<
  ReturnType<typeof subspaceSessionTemplateProviderService.getMany>
>[number];

type EffectiveTemplateProvider = {
  templateProvider: SessionTemplateProvider;
  toolFilters?: unknown[];
};

type TemplateTarget = {
  sessionTemplateId: string;
  toolFilters: unknown[];
};

let normalizeToolFilters = (toolFilters: unknown) => {
  if (toolFilters == null) return [] as unknown[];

  return Array.isArray(toolFilters) ? toolFilters : [toolFilters];
};

let getTemplateProviderToolFilters = (templateProvider: SessionTemplateProvider) => {
  return templateProvider.toolFilter?.type === 'v1.filter'
    ? templateProvider.toolFilter.filters
    : [];
};

let getEffectiveTemplateProvider = (d: {
  templateProvider: SessionTemplateProvider;
  toolFilters: unknown[];
}): EffectiveTemplateProvider => {
  let mergedToolFilters = [
    ...getTemplateProviderToolFilters(d.templateProvider),
    ...d.toolFilters
  ];

  return {
    templateProvider: d.templateProvider,
    toolFilters: mergedToolFilters.length ? mergedToolFilters : undefined
  };
};

let toTemplateProviderDescriptor = (templateProvider: EffectiveTemplateProvider) => ({
  sessionTemplateId: templateProvider.templateProvider.sessionTemplateId,
  providerId: templateProvider.templateProvider.providerId,
  providerDeploymentId: templateProvider.templateProvider.deployment?.id ?? null,
  providerConfigId: templateProvider.templateProvider.config?.id ?? null,
  providerAuthConfigId: templateProvider.templateProvider.authConfig?.id ?? null,
  toolFilters: templateProvider.toolFilters ?? null
});

let getConfigurationHash = (templateProviders: EffectiveTemplateProvider[]) => {
  let descriptors = templateProviders
    .map(toTemplateProviderDescriptor)
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

  return createHash('sha256').update(JSON.stringify(descriptors)).digest('hex');
};

let getMagicMcpSessionName = (name: string, now: Date) => {
  return `Magic MCP ${name} - ${now.toISOString().slice(0, 10)}`;
};

let getMagicMcpSessionExpiresAt = async (instance: Instance, now: Date) => {
  let project = await db.project.findUniqueOrThrow({
    where: { oid: instance.projectOid },
    select: { magicMcpSessionDurationMinutes: true }
  });
  let durationMinutes = project?.magicMcpSessionDurationMinutes;

  return new Date(now.getTime() + durationMinutes * 60 * 1000);
};

let ensureMagicMcpEndpointTemplate = async (magicMcpEndpoint: MagicMcpEndpointForSession) => {
  let rawTemplateTargets = magicMcpEndpoint.servers
    .map(server => {
      let sessionTemplateId = server.magicMcpServer.subspaceSessionTemplateId;
      if (!sessionTemplateId) return null;

      return {
        sessionTemplateId,
        toolFilters: normalizeToolFilters(server.toolFilters)
      } satisfies TemplateTarget;
    })
    .filter((templateTarget): templateTarget is TemplateTarget => templateTarget != null);
  let templateTargets = Array.from(
    new Map(
      rawTemplateTargets.map(templateTarget => [
        JSON.stringify({
          sessionTemplateId: templateTarget.sessionTemplateId,
          toolFilters: templateTarget.toolFilters.length ? templateTarget.toolFilters : null
        }),
        templateTarget
      ])
    ).values()
  );
  let sessionTemplateIds = Array.from(
    new Set(templateTargets.map(templateTarget => templateTarget.sessionTemplateId))
  );

  let templateProviders = sessionTemplateIds.length
    ? await subspaceSessionTemplateProviderService.getMany({
        instance: magicMcpEndpoint.instance,
        sessionTemplateIds,
        allowDeleted: false
      })
    : [];
  let templateProvidersBySessionTemplateId = new Map<string, SessionTemplateProvider[]>();
  for (let templateProvider of templateProviders) {
    let existing =
      templateProvidersBySessionTemplateId.get(templateProvider.sessionTemplateId) ?? [];
    existing.push(templateProvider);
    templateProvidersBySessionTemplateId.set(templateProvider.sessionTemplateId, existing);
  }

  let effectiveTemplateProviders = templateTargets.flatMap(templateTarget => {
    return (
      templateProvidersBySessionTemplateId.get(templateTarget.sessionTemplateId) ?? []
    ).map(templateProvider =>
      getEffectiveTemplateProvider({
        templateProvider,
        toolFilters: templateTarget.toolFilters
      })
    );
  });
  let configurationHash = getConfigurationHash(effectiveTemplateProviders);
  let needsNewTemplate =
    !magicMcpEndpoint.subspaceSessionTemplateId ||
    magicMcpEndpoint.configurationHash !== configurationHash;

  if (!needsNewTemplate) {
    return {
      magicMcpEndpoint,
      sessionTemplateId: magicMcpEndpoint.subspaceSessionTemplateId!
    };
  }

  let sessionTemplate = await subspaceSessionTemplateService.create({
    instance: magicMcpEndpoint.instance,
    name: magicMcpEndpoint.name ?? `Magic MCP Endpoint ${magicMcpEndpoint.id}`,
    description: magicMcpEndpoint.description ?? undefined,
    isInternal: true,
    metadata: magicMcpEndpoint.metadata as Record<string, any>,
    providers: []
  });

  for (let templateProvider of effectiveTemplateProviders) {
    await subspaceSessionTemplateProviderService.create({
      instance: magicMcpEndpoint.instance,
      sessionTemplateId: sessionTemplate.id,
      providerDeploymentId: templateProvider.templateProvider.deployment?.id,
      providerConfigId: templateProvider.templateProvider.config?.id,
      providerAuthConfigId: templateProvider.templateProvider.authConfig?.id,
      toolFilters: templateProvider.toolFilters
    });
  }

  let nextMagicMcpEndpoint = await db.magicMcpEndpoint.update({
    where: {
      oid: magicMcpEndpoint.oid
    },
    data: {
      subspaceSessionTemplateId: sessionTemplate.id,
      configurationHash
    },
    include: {
      ...magicMcpEndpointInclude,
      instance: true
    }
  });

  return {
    magicMcpEndpoint: nextMagicMcpEndpoint,
    sessionTemplateId: sessionTemplate.id
  };
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

  let { magicMcpEndpoint, sessionTemplateId } = await ensureMagicMcpEndpointTemplate(
    d.target as MagicMcpEndpointForSession
  );

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
  now: Date
) => {
  if (!mapping) return false;
  if (mapping.subspaceSessionTemplateId !== target.sessionTemplateId) return false;
  if (!mapping.expiresAt) return false;
  if (mapping.expiresAt <= now) return false;

  return true;
};

let deleteSubspaceSessionSafe = async (d: {
  instance: Instance;
  subspaceSessionId: string;
}) => {
  // try {
  //   await subspaceSessionService.delete({
  //     instance: d.instance,
  //     sessionId: d.subspaceSessionId,
  //     _allowMagicMcpDelete: true
  //   });
  // } catch {}
};

let getSubspaceProviders = async (d: { instance: Instance; sessionTemplateId: string }) => {
  let templateProviders = await subspaceSessionTemplateProviderService.getMany({
    instance: d.instance,
    sessionTemplateIds: [d.sessionTemplateId],
    allowDeleted: false
  });

  return templateProviders.map(templateProvider => ({
    // sessionTemplateId: templateProvider.sessionTemplateId,
    providerDeployment: templateProvider.deployment?.id
      ? {
          type: 'reference' as const,
          providerDeploymentId: templateProvider.deployment.id
        }
      : undefined,
    providerConfig: templateProvider.config?.id
      ? {
          type: 'reference' as const,
          providerConfigId: templateProvider.config.id
        }
      : undefined,
    providerAuthConfig: templateProvider.authConfig?.id
      ? {
          type: 'reference' as const,
          providerAuthConfigId: templateProvider.authConfig.id
        }
      : undefined,
    toolFilters:
      templateProvider.toolFilter?.type === 'v1.filter'
        ? templateProvider.toolFilter.filters
        : undefined
  }));
};

export let ensureMagicMcpSubspaceSession = async (magicMcpTarget: MagicMcpResolvedTarget) => {
  let target = await getMagicMcpTargetInfo(magicMcpTarget);
  let mapping = await getExistingMapping(target);
  let now = new Date();

  if (false && isReusableMapping(mapping, target, now)) return mapping!;

  let providers = await getSubspaceProviders({
    instance: target.instance,
    sessionTemplateId: target.sessionTemplateId
  });
  let expiresAt = await getMagicMcpSessionExpiresAt(target.instance, now);

  let subspaceSession = await subspaceSessionService.create({
    instance: target.instance,
    name: getMagicMcpSessionName(target.name, now),
    description: target.description,
    providers
  });

  try {
    if (mapping) {
      let updated = await db.magicMcpSession.updateMany({
        where: {
          oid: mapping.oid,
          subspaceSessionId: mapping.subspaceSessionId
        },
        data: {
          subspaceSessionId: subspaceSession.id,
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
      if (updated.count === 0 && winner.subspaceSessionId !== subspaceSession.id) {
        void deleteSubspaceSessionSafe({
          instance: target.instance,
          subspaceSessionId: subspaceSession.id
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
        subspaceSessionId: subspaceSession.id,
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
        if (winner.subspaceSessionId !== subspaceSession.id) {
          void deleteSubspaceSessionSafe({
            instance: target.instance,
            subspaceSessionId: subspaceSession.id
          });
        }
        return winner;
      }
    }

    throw error;
  }
};

export type MagicMcpSubspaceMapping = Awaited<
  ReturnType<typeof ensureMagicMcpSubspaceSession>
>;
