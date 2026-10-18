import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import { magicMcpEndpointInclude } from '../services/magicMcpEndpoint';

export let magicMcpTargetServerInclude = {
  aliases: true,
  instance: true,
  subspaceSession: true
} as const;

let magicMcpTargetEndpointInclude = {
  ...magicMcpEndpointInclude,
  instance: true
} as const;

let toMagicMcpTarget = <S, E>(server: S | null, endpoint: E | null) => {
  if (server && endpoint) {
    throw new ServiceError(
      conflictError({
        message: 'Magic MCP target identifier is ambiguous'
      })
    );
  }
  if (server) return { type: 'server' as const, target: server };
  if (endpoint) return { type: 'endpoint' as const, target: endpoint };

  return null;
};

// Ids are tried before aliases/slugs so the common case is two unique-index lookups
// instead of one OR over the id and an aliases EXISTS subquery.
export let resolveMagicMcpTargetByIdOrAliasSafe = async (magicMcpTargetIdOrAlias: string) => {
  let [serverById, endpointById] = await Promise.all([
    db.magicMcpServer.findFirst({
      where: { id: magicMcpTargetIdOrAlias, status: 'active' },
      include: magicMcpTargetServerInclude
    }),
    db.magicMcpEndpoint.findFirst({
      where: { id: magicMcpTargetIdOrAlias, status: 'active' },
      include: magicMcpTargetEndpointInclude
    })
  ]);

  let targetById = toMagicMcpTarget(serverById, endpointById);
  if (targetById) return targetById;

  let [serverAlias, endpointBySlug] = await Promise.all([
    db.magicMcpServerAlias.findUnique({
      where: { slug: magicMcpTargetIdOrAlias },
      include: { server: { include: magicMcpTargetServerInclude } }
    }),
    db.magicMcpEndpoint.findFirst({
      where: { slug: magicMcpTargetIdOrAlias, status: 'active' },
      include: magicMcpTargetEndpointInclude
    })
  ]);

  let serverByAlias = serverAlias?.server.status == 'active' ? serverAlias.server : null;

  return toMagicMcpTarget(serverByAlias, endpointBySlug);
};

export let resolveMagicMcpTargetByIdOrAlias = async (magicMcpTargetIdOrAlias: string) => {
  let target = await resolveMagicMcpTargetByIdOrAliasSafe(magicMcpTargetIdOrAlias);
  if (target) return target;

  throw new ServiceError(notFoundError('magic_mcp.target'));
};

export type MagicMcpResolvedTarget = Awaited<
  ReturnType<typeof resolveMagicMcpTargetByIdOrAlias>
>;
