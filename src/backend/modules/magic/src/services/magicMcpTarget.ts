import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { magicMcpEndpointInclude } from './magicMcpEndpoint';

export let magicMcpTargetServerInclude = {
  aliases: true,
  instance: true,
  subspaceSession: true
} as const;

export let resolveMagicMcpTargetByIdOrAlias = async (magicMcpTargetIdOrAlias: string) => {
  let [serverById, endpointById] = await Promise.all([
    db.magicMcpServer.findFirst({
      where: {
        id: magicMcpTargetIdOrAlias,
        status: 'active'
      },
      include: magicMcpTargetServerInclude
    }),
    db.magicMcpEndpoint.findFirst({
      where: {
        id: magicMcpTargetIdOrAlias,
        status: 'active'
      },
      include: {
        ...magicMcpEndpointInclude,
        instance: true
      }
    })
  ]);

  if (serverById && endpointById) {
    throw new ServiceError(
      conflictError({
        message: 'Magic MCP target identifier is ambiguous'
      })
    );
  }
  if (serverById) return { type: 'server' as const, target: serverById };
  if (endpointById) return { type: 'endpoint' as const, target: endpointById };

  let [serverByAlias, endpointBySlug] = await Promise.all([
    db.magicMcpServer.findFirst({
      where: {
        status: 'active',
        aliases: {
          some: {
            slug: magicMcpTargetIdOrAlias
          }
        }
      },
      include: magicMcpTargetServerInclude
    }),
    db.magicMcpEndpoint.findFirst({
      where: {
        status: 'active',
        slug: magicMcpTargetIdOrAlias
      },
      include: {
        ...magicMcpEndpointInclude,
        instance: true
      }
    })
  ]);

  if (serverByAlias && endpointBySlug) {
    throw new ServiceError(
      conflictError({
        message: 'Magic MCP target identifier is ambiguous'
      })
    );
  }
  if (serverByAlias) return { type: 'server' as const, target: serverByAlias };
  if (endpointBySlug) return { type: 'endpoint' as const, target: endpointBySlug };

  throw new ServiceError(notFoundError('magic_mcp.target'));
};

export type MagicMcpResolvedTarget = Awaited<
  ReturnType<typeof resolveMagicMcpTargetByIdOrAlias>
>;
