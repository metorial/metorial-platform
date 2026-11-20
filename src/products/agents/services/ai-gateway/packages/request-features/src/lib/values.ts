export type JsonRecord = Record<string, unknown>;

export let asRecord = (value: unknown): JsonRecord | undefined =>
  value && typeof value == 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;

export let asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export let asString = (value: unknown) => (typeof value == 'string' ? value : undefined);

export let asNumber = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? value : undefined;

export let jsonLength = (value: unknown) => {
  if (value === undefined || value === null) return 0;
  if (typeof value == 'string') return value.length;

  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
};
