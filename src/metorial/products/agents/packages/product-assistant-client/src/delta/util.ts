import type {
  JsonValue,
  Path,
  WireBatch,
  WireDelta,
  WireMessage,
  WireOperation
} from './types';

export let cloneJson = <T extends JsonValue>(value: T): T => {
  if (typeof structuredClone == 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

export let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value == 'object' && !Array.isArray(value);

export let isJsonObjectLike = (value: unknown): value is JsonValue =>
  value === null ||
  typeof value == 'string' ||
  typeof value == 'number' ||
  typeof value == 'boolean' ||
  Array.isArray(value) ||
  isRecord(value);

export let normalizeBatch = <T extends JsonValue>(
  message: WireMessage<T>
): WireBatch | null => {
  if (message[0] == 's') return null;
  if (message[0] == 'd') {
    let [, index, ...operations] = message;
    return [index, ...operations];
  }

  return message as WireBatch;
};

export let batchOperations = (batch: WireBatch): WireOperation[] =>
  batch.slice(1) as WireOperation[];

export let toDeltaMessage = (batch: WireBatch): WireDelta => [
  'd',
  batch[0],
  ...batchOperations(batch)
];

export let cloneOperation = (operation: WireOperation): WireOperation => {
  switch (operation[0]) {
    case 0: {
      let [code, path, value] = operation;
      return [code, [...path], cloneJson(value)];
    }
    case 1: {
      let [code, path] = operation;
      return [code, [...path]];
    }
    case 2: {
      let [code, path, at, values] = operation;
      return [code, [...path], at, cloneJson(values)];
    }
    case 3: {
      let [code, path, at, count] = operation;
      return [code, [...path], at, count];
    }
    case 4: {
      let [code, path, at, value] = operation;
      return [code, [...path], at, cloneJson(value)];
    }
    case 5: {
      let [code, path, suffix] = operation;
      return [code, [...path], suffix];
    }
  }

  throw new Error(`Unsupported operation code: ${(operation as unknown as [number])[0]}`);
};

export let cloneBatch = (batch: WireBatch): WireBatch => [
  batch[0],
  ...batchOperations(batch).map(cloneOperation)
];

export let getAtPath = (state: JsonValue, path: Path) => {
  let value: unknown = state;

  for (let part of path) {
    if (value == null) throw new Error(`Path does not exist: ${path.join('.')}`);
    value = (value as Record<string | number, unknown>)[part];
  }

  return value;
};

export let getParentAtPath = (state: JsonValue, path: Path) => {
  if (path.length == 0) return { parent: null, key: null };

  let parentPath = path.slice(0, -1);
  return {
    parent: getAtPath(state, parentPath),
    key: path[path.length - 1]
  };
};
