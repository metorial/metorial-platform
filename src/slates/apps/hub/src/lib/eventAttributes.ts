let MAX_KEYS = 8;
let MAX_VALUES_PER_KEY = 16;
let MAX_VALUE_LENGTH = 256;
let KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export type EventAttributes = Record<string, string[]>;

let isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  let prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

let normalizeValues = (raw: unknown) => {
  let candidates = Array.isArray(raw) ? raw : [raw];
  let values = new Set<string>();

  for (let candidate of candidates) {
    if (values.size >= MAX_VALUES_PER_KEY) break;
    if (typeof candidate !== 'string') continue;
    if (!candidate.length || candidate.length > MAX_VALUE_LENGTH) continue;

    values.add(candidate);
  }

  return [...values];
};

export let normalizeEventAttributes = (input: unknown): EventAttributes | null => {
  try {
    if (!isPlainObject(input)) return null;

    let attributes: EventAttributes = {};
    let keyCount = 0;

    for (let [key, raw] of Object.entries(input)) {
      if (keyCount >= MAX_KEYS) break;
      if (!KEY_PATTERN.test(key)) continue;

      let values = normalizeValues(raw);
      if (!values.length) continue;

      attributes[key] = values;
      keyCount++;
    }

    return keyCount ? attributes : null;
  } catch {
    // Integration output is untrusted; a hostile getter or proxy must not fail the event.
    return null;
  }
};
