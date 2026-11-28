let strictUtf8 = new TextDecoder('utf-8', { fatal: true });

export let isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value == 'object' && !Array.isArray(value);

export let parseJsonObject = (text: string): Record<string, unknown> | null => {
  try {
    let value: unknown = JSON.parse(text);

    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
};

export let parseJsonObjectBytes = (bytes: Uint8Array): Record<string, unknown> | null => {
  try {
    return parseJsonObject(strictUtf8.decode(bytes));
  } catch {
    return null;
  }
};
