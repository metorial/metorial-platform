import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';

export let magicMcpTargetServerInclude = {
  aliases: true,
  instance: true,
  subspaceSession: true
} as const;

let magicMcpTargetEndpointInclude = {
  consumerProfile: true,
  instance: true,
  servers: { include: { magicMcpServer: true } },
  subspaceSession: true
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

let loadMagicMcpTarget = async (
  target: { type: 'server' | 'endpoint'; target: { oid: bigint } } | null
) => {
  if (!target) return null;

  if (target.type === 'server') {
    let server = await db.magicMcpServer.findFirst({
      where: { oid: target.target.oid, status: 'active' },
      include: magicMcpTargetServerInclude,
      relationLoadStrategy: 'query'
    });

    return server ? { type: 'server' as const, target: server } : null;
  }

  let endpoint = await db.magicMcpEndpoint.findFirst({
    where: { oid: target.target.oid, status: 'active' },
    include: magicMcpTargetEndpointInclude,
    relationLoadStrategy: 'query'
  });

  return endpoint ? { type: 'endpoint' as const, target: endpoint } : null;
};

export let resolveMagicMcpTargetByIdOrAliasSafe = async (magicMcpTargetIdOrAlias: string) => {
  let [serverById, endpointById] = await Promise.all([
    db.magicMcpServer.findFirst({
      where: { id: magicMcpTargetIdOrAlias, status: 'active' }
    }),
    db.magicMcpEndpoint.findFirst({
      where: { id: magicMcpTargetIdOrAlias, status: 'active' }
    })
  ]);

  let targetById = toMagicMcpTarget(serverById, endpointById);
  if (targetById) return await loadMagicMcpTarget(targetById);

  let [serverAlias, endpointBySlug] = await Promise.all([
    db.magicMcpServerAlias.findUnique({
      where: { slug: magicMcpTargetIdOrAlias, server: { status: 'active' } }
    }),
    db.magicMcpEndpoint.findFirst({
      where: { slug: magicMcpTargetIdOrAlias, status: 'active' }
    })
  ]);

  let serverByAlias = serverAlias ? { oid: serverAlias.serverOid } : null;

  return await loadMagicMcpTarget(toMagicMcpTarget(serverByAlias, endpointBySlug));
};

export let resolveMagicMcpTargetByIdOrAlias = async (magicMcpTargetIdOrAlias: string) => {
  let target = await resolveMagicMcpTargetByIdOrAliasSafe(magicMcpTargetIdOrAlias);
  if (target) return target;

  throw new ServiceError(notFoundError('magic_mcp.target'));
};

export type MagicMcpResolvedTarget = Awaited<
  ReturnType<typeof resolveMagicMcpTargetByIdOrAlias>
>;
