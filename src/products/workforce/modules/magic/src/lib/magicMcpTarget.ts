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

type MagicMcpTargetCandidate = { type: 'server' | 'endpoint'; oid: bigint };

let toMagicMcpTarget = (server: { oid: bigint } | null, endpoint: { oid: bigint } | null) => {
  if (server && endpoint) {
    throw new ServiceError(
      conflictError({
        message: 'Magic MCP target identifier is ambiguous'
      })
    );
  }
  if (server) return { type: 'server' as const, oid: server.oid };
  if (endpoint) return { type: 'endpoint' as const, oid: endpoint.oid };

  return null;
};

let loadMagicMcpTarget = async (target: MagicMcpTargetCandidate | null) => {
  if (!target) return null;

  if (target.type === 'server') {
    let server = await db.magicMcpServer.findFirst({
      where: { oid: target.oid, status: 'active', isSystemOwned: false },
      include: magicMcpTargetServerInclude,
      relationLoadStrategy: 'query'
    });

    return server ? { type: 'server' as const, target: server } : null;
  }

  let endpoint = await db.magicMcpEndpoint.findFirst({
    where: { oid: target.oid, status: 'active', isSystemOwned: false },
    include: magicMcpTargetEndpointInclude,
    relationLoadStrategy: 'query'
  });

  return endpoint ? { type: 'endpoint' as const, target: endpoint } : null;
};

export let resolveMagicMcpTargetByIdOrAliasSafe = async (magicMcpTargetIdOrAlias: string) => {
  let exactMatches = await db.$queryRaw<MagicMcpTargetCandidate[]>`
    SELECT 'server' AS type, "oid"
    FROM "MagicMcpServer"
    WHERE "id" = ${magicMcpTargetIdOrAlias} AND "status" = 'active' AND NOT "isSystemOwned"
    UNION ALL
    SELECT 'endpoint' AS type, "oid"
    FROM "MagicMcpEndpoint"
    WHERE "id" = ${magicMcpTargetIdOrAlias} AND "status" = 'active' AND NOT "isSystemOwned"
  `;

  let targetById = toMagicMcpTarget(
    exactMatches.find(match => match.type === 'server') ?? null,
    exactMatches.find(match => match.type === 'endpoint') ?? null
  );
  if (targetById) return await loadMagicMcpTarget(targetById);

  let [serverAlias, endpointBySlug] = await Promise.all([
    db.magicMcpServerAlias.findUnique({
      where: {
        slug: magicMcpTargetIdOrAlias,
        server: { status: 'active', isSystemOwned: false }
      },
      select: { serverOid: true }
    }),
    db.magicMcpEndpoint.findUnique({
      where: { slug: magicMcpTargetIdOrAlias, status: 'active', isSystemOwned: false },
      select: { oid: true }
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
