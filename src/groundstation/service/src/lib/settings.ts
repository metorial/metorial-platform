export let mergeSettings = <T extends object>(
  current: T | undefined,
  changes: T | undefined
): T => {
  let merged = { ...current } as Record<string, unknown>;

  for (let [key, value] of Object.entries(changes ?? {})) {
    if (value !== undefined) merged[key] = value;
  }

  return merged as T;
};
