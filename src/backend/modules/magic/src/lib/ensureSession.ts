import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db, ID, Instance, MagicMcpServer, Prisma } from '@metorial/db';
import {
  subspaceSessionService,
  subspaceSessionTemplateProviderService
} from '@metorial/module-subspace';

export let ensureMagicMcpSubspaceSession = async (
  magicMcpServer: MagicMcpServer & { instance: Instance }
) => {
  if (!magicMcpServer.subspaceSessionTemplateId) {
    throw new ServiceError(
      badRequestError({
        message: 'Magic MCP server is missing subspace session template configuration'
      })
    );
  }

  let mapping = await db.magicMcpServerSubspaceSession.findUnique({
    where: {
      magicMcpServerOid: magicMcpServer.oid
    }
  });

  if (
    mapping &&
    mapping.subspaceSessionTemplateId !== magicMcpServer.subspaceSessionTemplateId
  ) {
    await db.magicMcpServerSubspaceSession
      .delete({
        where: {
          magicMcpServerOid: magicMcpServer.oid
        }
      })
      .catch(() => null);
    mapping = null;
  }

  if (mapping) return mapping;

  let templateProviders = await subspaceSessionTemplateProviderService.getMany({
    instance: magicMcpServer.instance,
    sessionTemplateIds: [magicMcpServer.subspaceSessionTemplateId],
    allowDeleted: false
  });

  let providers = templateProviders.map(templateProvider => ({
    sessionTemplateId: magicMcpServer.subspaceSessionTemplateId,
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

  let subspaceSession = await subspaceSessionService.create({
    instance: magicMcpServer.instance,
    name: magicMcpServer.name ?? `Magic MCP ${magicMcpServer.id}`,
    description: magicMcpServer.description ?? undefined,
    providers
  });

  try {
    return await db.magicMcpServerSubspaceSession.create({
      data: {
        id: await ID.generateId('magicMcpServerSubspaceSession'),
        magicMcpServerOid: magicMcpServer.oid,
        instanceOid: magicMcpServer.instanceOid,
        subspaceSessionId: subspaceSession.id,
        subspaceSessionTemplateId: magicMcpServer.subspaceSessionTemplateId
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      let winner = await db.magicMcpServerSubspaceSession.findUnique({
        where: {
          magicMcpServerOid: magicMcpServer.oid
        }
      });
      if (winner) return winner;
    }

    throw error;
  }
};

export type MagicMcpSubspaceMapping = Awaited<
  ReturnType<typeof ensureMagicMcpSubspaceSession>
>;
