import { LRUCache } from 'lru-cache';

export let createEnsureRecord = <
  UniqueKey extends {},
  UpsertCreate,
  Result,
  StaticCreate extends Partial<UpsertCreate> = {}
>(
  type: {
    upsert: (d: { create: UpsertCreate; where: UniqueKey; update: any }) => Promise<Result>;
    findUnique: (d: { where: UniqueKey }) => Promise<Result | null>;
  },
  getWhere: (value: UpsertCreate) => UniqueKey,
  getStatic?: () => Promise<StaticCreate> | StaticCreate,
  opts?: {
    cacheTtl?: number;
    checkMatch?: (current: UpsertCreate, compare: Result) => boolean;
  }
) => {
  let cache = opts?.cacheTtl
    ? new LRUCache<string, any>({
        max: 5000,
        ttl: 1000 * 60 * 5
      })
    : undefined;

  return async (
    getter: () =>
      | Omit<UpsertCreate, keyof StaticCreate>
      | Promise<Omit<UpsertCreate, keyof StaticCreate>>,
    opts2?: {
      ignoreForUpdate?: (keyof UpsertCreate)[];
    }
  ): Promise<Result> => {
    let coreValues = await getter();
    let staticValues = (await getStatic?.()) ?? {};

    let value = { ...staticValues, ...coreValues } as UpsertCreate;

    let where = getWhere(value);

    let cacheKey = cache ? JSON.stringify(where) : undefined;
    if (cache) {
      let cachedValue = cache.get(cacheKey!);
      if (cachedValue) return cachedValue;
    }

    let update = {
      ...value,
      id: undefined,
      oid: undefined
    };

    if (opts2?.ignoreForUpdate) {
      for (let key of opts2.ignoreForUpdate) {
        delete update[key];
      }
    }

    if (opts?.checkMatch) {
      let current = await type.findUnique({ where });
      if (current && opts.checkMatch(value, current)) {
        if (cache) cache.set(cacheKey!, current);
        return current;
      }
    }

    // try {
    let res = await type.upsert({
      where,
      create: value,
      update
    });

    if (cache) cache.set(cacheKey!, res);

    return res;
    // } catch (e) {
    //   console.error(
    //     `Error ensuring record for ${(Object.values((type as any).fields ?? {})?.[0] as any)?.modelName ?? 'unknown'}, ${JSON.stringify(where)}`,
    //     e
    //   );
    //   throw e;
    // }
  };
};
