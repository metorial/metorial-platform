export type CounterIncrement = { key: string; by: number; expiresAt: number };

export type BucketUpdate = {
  op: 'increment' | 'setIfAbsent' | 'set';
  field: string;
  value: number;
};

// Buckets are hashes listed in a sorted index (scored by bucket start) so a drainer can find
// every closed bucket without scanning keys. A bucket and its index must share a Redis Cluster
// hash slot because they are updated by one script.
export type LimitStore = {
  read: (keys: string[]) => Promise<number[]>;
  increment: (increments: CounterIncrement[]) => Promise<number[]>;

  updateBucket: (d: {
    index: string;
    key: string;
    score: number;
    updates: BucketUpdate[];
    expiresAt: number;
    pruneBefore: number;
  }) => Promise<void>;
  listBuckets: (d: { index: string; before: number }) => Promise<number[]>;
  readBucket: (key: string) => Promise<Record<string, number>>;
  deleteBuckets: (d: {
    index: string;
    buckets: { key: string; score: number }[];
  }) => Promise<void>;
};

export let createMemoryLimitStore = (opts: { now?: () => number } = {}): LimitStore => {
  let now = opts.now ?? Date.now;

  let counters = new Map<string, { value: number; expiresAt: number }>();
  let buckets = new Map<string, { fields: Map<string, number>; expiresAt: number }>();
  let indexes = new Map<string, Map<number, number>>();

  let counter = (key: string) => {
    let entry = counters.get(key);
    if (entry && entry.expiresAt <= now()) {
      counters.delete(key);
      return undefined;
    }

    return entry;
  };

  let bucket = (key: string) => {
    let entry = buckets.get(key);
    if (entry && entry.expiresAt <= now()) {
      buckets.delete(key);
      return undefined;
    }

    return entry;
  };

  let index = (key: string) => {
    let entry = indexes.get(key) ?? new Map<number, number>();
    indexes.set(key, entry);

    for (let [score, expiresAt] of entry) {
      if (expiresAt <= now()) entry.delete(score);
    }

    return entry;
  };

  return {
    read: async keys => keys.map(key => counter(key)?.value ?? 0),

    increment: async increments =>
      increments.map(({ key, by, expiresAt }) => {
        let entry = counter(key) ?? { value: 0, expiresAt };
        entry.value += by;
        entry.expiresAt = expiresAt;
        counters.set(key, entry);

        return entry.value;
      }),

    updateBucket: async d => {
      let entry = bucket(d.key) ?? {
        fields: new Map<string, number>(),
        expiresAt: d.expiresAt
      };

      for (let update of d.updates) {
        let current = entry.fields.get(update.field);

        if (update.op == 'increment')
          entry.fields.set(update.field, (current ?? 0) + update.value);
        else if (update.op == 'set' || current === undefined) {
          entry.fields.set(update.field, update.value);
        }
      }

      entry.expiresAt = d.expiresAt;
      buckets.set(d.key, entry);

      let scores = index(d.index);
      scores.set(d.score, d.expiresAt);
      for (let score of scores.keys()) {
        if (score < d.pruneBefore) scores.delete(score);
      }
    },

    listBuckets: async d =>
      [...index(d.index).keys()].filter(score => score < d.before).sort((a, b) => a - b),

    readBucket: async key => Object.fromEntries(bucket(key)?.fields ?? []),

    deleteBuckets: async d => {
      let scores = index(d.index);

      for (let entry of d.buckets) {
        buckets.delete(entry.key);
        scores.delete(entry.score);
      }
    }
  };
};
