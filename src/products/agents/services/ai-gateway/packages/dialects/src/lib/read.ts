import { invalidParam, unsupportedParam } from './errors';

export type JsonObject = Record<string, unknown>;

export let at = (path: string, key: string) => (path ? `${path}.${key}` : key);

export let index = (path: string, position: number) => `${path}[${position}]`;

export let isObject = (value: unknown): value is JsonObject =>
  typeof value == 'object' && value !== null && !Array.isArray(value);

let describe = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'an array' : `a ${typeof value}`;

let isMissing = (value: unknown) => value === undefined || value === null;

export let readObject = (value: unknown, path: string): JsonObject => {
  if (!isObject(value))
    throw invalidParam(path, `"${path}" must be an object, got ${describe(value)}.`);
  return value;
};

export let readArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value))
    throw invalidParam(path, `"${path}" must be an array, got ${describe(value)}.`);
  return value;
};

export let readString = (value: unknown, path: string): string => {
  if (typeof value != 'string')
    throw invalidParam(path, `"${path}" must be a string, got ${describe(value)}.`);
  return value;
};

export let readModel = (value: unknown): string => {
  if (value === undefined || value === null) {
    throw invalidParam('model', 'The "model" field is required.');
  }

  let model = readString(value, 'model').trim();
  if (!model) throw invalidParam('model', '"model" must not be empty.');

  return model;
};

export let readBoolean = (value: unknown, path: string): boolean => {
  if (typeof value != 'boolean') {
    throw invalidParam(path, `"${path}" must be a boolean, got ${describe(value)}.`);
  }
  return value;
};

export let readNumber = (
  value: unknown,
  path: string,
  d: { integer?: boolean; min?: number; max?: number } = {}
): number => {
  if (typeof value != 'number' || !Number.isFinite(value)) {
    throw invalidParam(path, `"${path}" must be a number, got ${describe(value)}.`);
  }
  if (d.integer && !Number.isInteger(value)) {
    throw invalidParam(path, `"${path}" must be an integer.`);
  }
  if (d.min !== undefined && value < d.min) {
    throw invalidParam(path, `"${path}" must be at least ${d.min}.`);
  }
  if (d.max !== undefined && value > d.max) {
    throw invalidParam(path, `"${path}" must be at most ${d.max}.`);
  }

  return value;
};

export let readEnum = <const T extends string>(
  value: unknown,
  path: string,
  options: readonly T[]
): T => {
  if (typeof value != 'string' || !options.includes(value as T)) {
    throw invalidParam(
      path,
      `"${path}" must be one of ${options.map(option => `"${option}"`).join(', ')}.`
    );
  }
  return value as T;
};

export let optional = <T>(value: unknown, read: (value: unknown) => T): T | undefined =>
  isMissing(value) ? undefined : read(value);

export let rejectPresent = (
  body: JsonObject,
  keys: string[],
  reason: (key: string) => string
) => {
  for (let key of keys) {
    let value = body[key];
    if (isMissing(value) || value === false) continue;
    if (Array.isArray(value) && !value.length) continue;
    if (isObject(value) && !Object.keys(value).length) continue;

    throw unsupportedParam(key, reason(key));
  }
};

export let parseJsonArguments = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
