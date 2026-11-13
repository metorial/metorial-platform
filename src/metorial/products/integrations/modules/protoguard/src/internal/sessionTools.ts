import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db } from '@metorial-subspace/db';

let SESSION_TOOLS_CACHE_TTL_SECONDS = 5 * 60;
let MAX_SESSION_TOOL_NAMES = 500;

export let getSessionToolNames = createLocallyCachedFunction({
  getHash: (d: { sessionOid: bigint }) => String(d.sessionOid),
  provider: async (d: { sessionOid: bigint }) => {
    let sessionProviders = await db.sessionProvider.findMany({
      where: { sessionOid: d.sessionOid },
      select: { providerOid: true }
    });
    if (!sessionProviders.length) return [];

    let tools = await db.providerTool.findMany({
      where: { providerOid: { in: sessionProviders.map(provider => provider.providerOid) } },
      select: { key: true, name: true },
      distinct: ['key'],
      take: MAX_SESSION_TOOL_NAMES
    });

    return [...new Set(tools.flatMap(tool => [tool.key, tool.name]))].sort();
  },
  ttlSeconds: SESSION_TOOLS_CACHE_TTL_SECONDS
});
