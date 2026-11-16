let isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

  let prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

let isEqualIgnoringDates = (previous: unknown, current: unknown): boolean => {
  if (previous instanceof Date || current instanceof Date) return true;
  if (Object.is(previous, current)) return true;

  if (Array.isArray(previous) || Array.isArray(current)) {
    if (!Array.isArray(previous) || !Array.isArray(current)) return false;
    if (previous.length !== current.length) return false;

    return previous.every((value, index) => isEqualIgnoringDates(value, current[index]));
  }

  if (isPlainObject(previous) || isPlainObject(current)) {
    if (!isPlainObject(previous) || !isPlainObject(current)) return false;

    let keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
    for (let key of keys) {
      if (!(key in previous) || !(key in current)) return false;
      if (!isEqualIgnoringDates(previous[key], current[key])) return false;
    }

    return true;
  }

  return false;
};

export let getPreviousAttributes = (
  previous: unknown,
  current: unknown
): unknown | undefined => {
  if (previous instanceof Date || current instanceof Date) return undefined;
  if (isEqualIgnoringDates(previous, current)) return undefined;

  if (Array.isArray(previous) || Array.isArray(current)) {
    return previous;
  }

  if (isPlainObject(previous) && isPlainObject(current)) {
    let attributes: Record<string, unknown> = {};

    for (let key of Object.keys(previous)) {
      let difference = getPreviousAttributes(previous[key], current[key]);
      if (difference !== undefined) {
        attributes[key] = difference;
      }
    }

    return Object.keys(attributes).length > 0 ? attributes : undefined;
  }

  return previous;
};
