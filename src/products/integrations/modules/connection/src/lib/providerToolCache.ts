import { db, type ProviderTool } from '@metorial-subspace/db';
import { LRUCache } from 'lru-cache';
import { getProviderActionAdapterWhere, type SessionAdapterScope } from './internalSession';

let SPECIFICATION_TOOLS_CACHE_MAX = 100;
let TOOL_BY_ID_CACHE_MAX = 2_000;
let TOOL_CACHE_TTL_MS = 10 * 60 * 1000;

// A specification's tools are inserted in the same transaction that creates the
// specification and are never modified afterwards, so cached rows cannot go stale.
let specificationToolsCache = new LRUCache<string, Promise<ProviderTool[]>>({
  max: SPECIFICATION_TOOLS_CACHE_MAX,
  ttl: TOOL_CACHE_TTL_MS
});

let toolByIdCache = new LRUCache<string, Promise<ProviderTool | null>>({
  max: TOOL_BY_ID_CACHE_MAX,
  ttl: TOOL_CACHE_TTL_MS
});

let getAdapterScopeKey = (session: SessionAdapterScope) =>
  session.isInternal ? `a${session.adapterGlobalOid}` : 'p';

let getOrLoad = <T>(
  cache: LRUCache<string, Promise<T>>,
  key: string,
  load: () => Promise<T>
) => {
  let cached = cache.get(key);
  if (cached) return cached;

  let promise = load();
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));

  return promise;
};

export let listSpecificationTools = (d: {
  specificationOid: bigint;
  session: SessionAdapterScope;
}) =>
  getOrLoad(
    specificationToolsCache,
    `${d.specificationOid}:${getAdapterScopeKey(d.session)}`,
    () =>
      db.providerTool.findMany({
        where: {
          specificationOid: d.specificationOid,
          ...getProviderActionAdapterWhere(d.session)
        }
      })
  );

export let getProviderToolById = async (d: {
  toolId: string;
  session: SessionAdapterScope;
}) => {
  let key = `${d.toolId}:${getAdapterScopeKey(d.session)}`;

  let tool = await getOrLoad(toolByIdCache, key, () =>
    db.providerTool.findFirst({
      where: { id: d.toolId, ...getProviderActionAdapterWhere(d.session) }
    })
  );
  if (!tool) toolByIdCache.delete(key);

  return tool;
};
