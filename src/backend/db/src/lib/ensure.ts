import { LRUCache } from 'lru-cache';

export let createEnsureRecord = <
  UniqueKey extends {},
  UpsertCreate,
  Result,
  StaticCreate extends Partial<UpsertCreate> = {}
>(
  type: {
    upsert: (d: { create: UpsertCreate; where: UniqueKey; update: any }) => Promise<Result>;
  },
  getWhere: (value: UpsertCreate) => UniqueKey,
  getStatic?: () => Promise<StaticCreate> | StaticCreate,
  opts?: {
    cacheTtl?: number;
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
    opts?: {
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

    if (opts?.ignoreForUpdate) {
      for (let key of opts.ignoreForUpdate) {
        delete update[key];
      }
    }

    let res = await type.upsert({
      where,
      create: value,
      update
    });

    if (cache) cache.set(cacheKey!, res);

    return res;
  };
};
