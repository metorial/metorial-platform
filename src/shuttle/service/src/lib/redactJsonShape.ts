export let redactJsonShape = (value: unknown): unknown => {
  if (value === null) return 'Redacted[null]';
  if (Array.isArray(value)) return value.map(redactJsonShape);

  switch (typeof value) {
    case 'object': {
      let out: Record<string, unknown> = {};
      for (let [key, nested] of Object.entries(value as Record<string, unknown>)) {
        out[key] = redactJsonShape(nested);
      }
      return out;
    }
    case 'string':
      return 'Redacted[string]';
    case 'number':
      return 'Redacted[number]';
    case 'boolean':
      return 'Redacted[boolean]';
    default:
      return 'Redacted[unknown]';
  }
};
