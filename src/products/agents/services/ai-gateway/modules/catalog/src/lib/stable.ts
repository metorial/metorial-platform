// Postgres jsonb does not keep key order, so rows read back from the database only compare equal
// to freshly projected ones once keys are sorted.
export let stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, inner) => {
    if (!inner || typeof inner != 'object' || Array.isArray(inner) || inner instanceof Date) {
      return inner;
    }

    return Object.fromEntries(
      Object.keys(inner)
        .sort()
        .map(key => [key, inner[key]])
    );
  });
