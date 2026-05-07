import { JsonValue, OpCode, Path, WireBatch, WireOperation } from './types';
import { batchOperations, cloneJson, getAtPath, getParentAtPath } from './util';

let pathLabel = (path: Path) => (path.length ? path.join('.') : '<root>');

let assertArray = (value: unknown, path: Path): JsonValue[] => {
  if (!Array.isArray(value)) throw new Error(`Expected array at ${pathLabel(path)}`);
  return value;
};

let assertObjectParent = (value: unknown, path: Path): Record<string | number, JsonValue> => {
  if (!value || typeof value != 'object') {
    throw new Error(`Expected object parent for ${pathLabel(path)}`);
  }

  return value as Record<string | number, JsonValue>;
};

let assertString = (value: unknown, path: Path): string => {
  if (typeof value != 'string') throw new Error(`Expected string at ${pathLabel(path)}`);
  return value;
};

let applyOperation = (state: JsonValue, operation: WireOperation): JsonValue => {
  switch (operation[0]) {
    case OpCode.Set: {
      let [, path, value] = operation;
      if (path.length == 0) return cloneJson(operation[2]);

      let { parent, key } = getParentAtPath(state, path);
      assertObjectParent(parent, path)[key!] = cloneJson(value);
      return state;
    }

    case OpCode.Delete: {
      let [, path] = operation;
      if (path.length == 0) throw new Error('Cannot delete root state');

      let { parent, key } = getParentAtPath(state, path);
      if (Array.isArray(parent) && typeof key == 'number') {
        parent.splice(key, 1);
      } else {
        delete assertObjectParent(parent, path)[key!];
      }
      return state;
    }

    case OpCode.ArrayInsert: {
      let [, path, at, values] = operation;
      let array = assertArray(getAtPath(state, path), path);
      array.splice(at, 0, ...cloneJson(values));
      return state;
    }

    case OpCode.ArrayRemove: {
      let [, path, at, count] = operation;
      let array = assertArray(getAtPath(state, path), path);
      array.splice(at, count);
      return state;
    }

    case OpCode.ArraySet: {
      let [, path, at, value] = operation;
      let array = assertArray(getAtPath(state, path), path);
      if (at < 0 || at >= array.length) {
        throw new Error(`Array index out of bounds at ${pathLabel(path)}.${at}`);
      }

      array[at] = cloneJson(value);
      return state;
    }

    case OpCode.StringAppend: {
      let [, path, suffix] = operation;
      if (path.length == 0) return `${assertString(state, path)}${suffix}`;

      let { parent, key } = getParentAtPath(state, path);
      let object = assertObjectParent(parent, path);
      object[key!] = `${assertString(object[key!], path)}${suffix}`;
      return state;
    }
  }
};

export let applyBatch = <T extends JsonValue>(state: T, batch: WireBatch): T => {
  if (batch.length <= 1) throw new Error('Delta batch must include at least one operation');

  let next: JsonValue = cloneJson(state);

  for (let operation of batchOperations(batch)) {
    next = applyOperation(next, operation);
  }

  return next as T;
};
