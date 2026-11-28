export let record = (value: unknown) =>
  typeof value == 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export let text = (value: unknown) => (typeof value == 'string' && value ? value : undefined);

export let positiveCount = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) && value > 0 ? value : 0;
