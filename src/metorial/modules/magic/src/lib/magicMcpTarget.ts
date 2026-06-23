import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { magicMcpEndpointInclude } from '../services/magicMcpEndpoint';

export let magicMcpTargetServerInclude = {
  aliases: true,
  instance: true,
  subspaceSession: true
} as const;

export let resolveMagicMcpTargetByIdOrAliasSafe = async (magicMcpTargetIdOrAlias: string) => {
  let [serverById, endpointById] = await Promise.all([
    db.magicMcpServer.findFirst({
      where: {
        status: 'active',
        OR: [
          { id: magicMcpTargetIdOrAlias },
          {
            aliases: {
              some: {
                slug: magicMcpTargetIdOrAlias
              }
            }
          }
        ]
      },
      include: magicMcpTargetServerInclude
    }),
    db.magicMcpEndpoint.findFirst({
      where: {
        status: 'active',
        OR: [{ id: magicMcpTargetIdOrAlias }, { slug: magicMcpTargetIdOrAlias }]
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

  return null;
};

export let resolveMagicMcpTargetByIdOrAlias = async (magicMcpTargetIdOrAlias: string) => {
  let target = await resolveMagicMcpTargetByIdOrAliasSafe(magicMcpTargetIdOrAlias);
  if (target) return target;

  throw new ServiceError(notFoundError('magic_mcp.target'));
};

export type MagicMcpResolvedTarget = Awaited<
  ReturnType<typeof resolveMagicMcpTargetByIdOrAlias>
>;
