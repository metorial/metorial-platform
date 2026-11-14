export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PatchOperation =
  | { op: 'set'; path: string[]; value: JsonValue }
  | { op: 'unset'; path: string[] }
  | { op: 'add'; path: string[]; value: JsonValue }
  | { op: 'remove'; path: string[]; value: JsonValue };

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchError';
  }
}

let forbiddenSegments = ['__proto__', 'constructor', 'prototype'];

let isObject = (value: unknown): value is { [key: string]: JsonValue } =>
  typeof value == 'object' && value !== null && !Array.isArray(value);

let hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export let jsonEquals = (a: JsonValue | undefined, b: JsonValue | undefined): boolean => {
  if (a === b) return true;
  if (typeof a != 'object' || typeof b != 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length != b.length) return false;

    return a.every((item, index) => jsonEquals(item, b[index]));
  }

  let keys = Object.keys(a);
  if (keys.length != Object.keys(b).length) return false;

  return keys.every(key => hasOwn(b, key) && jsonEquals(a[key], b[key]));
};

let assertPath = (path: string[]) => {
  for (let segment of path) {
    if (typeof segment != 'string' || forbiddenSegments.includes(segment)) {
      throw new PatchError(`Invalid path segment "${String(segment)}"`);
    }
  }
};

let updateAt = (
  current: JsonValue | undefined,
  path: string[],
  index: number,
  create: boolean,
  apply: (current: JsonValue | undefined) => JsonValue | undefined
): JsonValue | undefined => {
  if (index == path.length) return apply(current);

  if (current === undefined) {
    if (!create) return undefined;

    current = {};
  }

  if (!isObject(current)) {
    throw new PatchError(`Cannot traverse "${path.slice(0, index + 1).join('.')}"`);
  }

  let key = path[index]!;
  let child = hasOwn(current, key) ? current[key] : undefined;
  let next = updateAt(child, path, index + 1, create, apply);

  if (next === child) return current;

  let copy = { ...current };

  if (next === undefined) delete copy[key];
  else copy[key] = next;

  return copy;
};

let applyOperation = (value: JsonValue, operation: PatchOperation): JsonValue => {
  assertPath(operation.path);

  if (operation.op != 'unset' && operation.value === undefined) {
    throw new PatchError(`Operation "${operation.op}" requires a value`);
  }

  if (operation.op == 'unset' && operation.path.length == 0) {
    throw new PatchError('Cannot unset the root value');
  }

  let result: JsonValue | undefined;

  if (operation.op == 'set') {
    result = updateAt(value, operation.path, 0, true, () => operation.value);
  } else if (operation.op == 'unset') {
    result = updateAt(value, operation.path, 0, false, () => undefined);
  } else if (operation.op == 'add') {
    result = updateAt(value, operation.path, 0, true, current => {
      if (current === undefined) return [operation.value];
      if (!Array.isArray(current)) throw new PatchError('Cannot add to a non-array value');
      if (current.some(item => jsonEquals(item, operation.value))) return current;

      return [...current, operation.value];
    });
  } else {
    result = updateAt(value, operation.path, 0, false, current => {
      if (current === undefined) return undefined;
      if (!Array.isArray(current))
        throw new PatchError('Cannot remove from a non-array value');

      let remaining = current.filter(item => !jsonEquals(item, operation.value));

      return remaining.length == current.length ? current : remaining;
    });
  }

  return result as JsonValue;
};

export let applyPatch = <T extends JsonValue>(value: T, operations: PatchOperation[]): T => {
  let result: JsonValue = value;

  for (let operation of operations) {
    result = applyOperation(result, operation);
  }

  return result as T;
};

export let prefixPatch = (operations: PatchOperation[], prefix: string[]): PatchOperation[] =>
  operations.map(operation => ({ ...operation, path: [...prefix, ...operation.path] }));

export let getAtPath = (value: JsonValue, path: string[]): JsonValue | undefined => {
  let current: JsonValue | undefined = value;

  for (let segment of path) {
    if (!isObject(current) || !hasOwn(current, segment)) return undefined;

    current = current[segment];
  }

  return current;
};
