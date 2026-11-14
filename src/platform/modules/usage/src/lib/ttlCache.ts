export let createTtlCache = <V>(opts: {
  ttlMs: number;
  emptyTtlMs: number;
  maxSize: number;
}) => {
  let entries = new Map<string, { value: V; expiresAt: number }>();

  return {
    get: (key: string) => {
      let entry = entries.get(key);
      if (!entry) return undefined;

      if (entry.expiresAt < Date.now()) {
        entries.delete(key);
        return undefined;
      }

      return entry;
    },

    set: (key: string, value: V, isEmpty: boolean) => {
      if (entries.size >= opts.maxSize) {
        let oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }

      entries.set(key, {
        value,
        expiresAt: Date.now() + (isEmpty ? opts.emptyTtlMs : opts.ttlMs)
      });
    }
  };
};
