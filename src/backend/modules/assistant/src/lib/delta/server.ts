import {
  CreateServerStateOptions,
  JsonValue,
  OpCode,
  Path,
  ServerStateHandle,
  WireBatch,
  WireMessage,
  WireOperation
} from './types';
import { cloneBatch, cloneJson, toDeltaMessage } from './util';

let isObject = (value: unknown): value is Record<string | number | symbol, unknown> =>
  !!value && typeof value == 'object';

let toArrayIndex = (property: string | symbol) => {
  if (typeof property != 'string') return null;
  if (!/^(0|[1-9]\d*)$/.test(property)) return null;

  let index = Number(property);
  return Number.isSafeInteger(index) ? index : null;
};

let unwrapValue = (value: unknown, proxyTargets: WeakMap<object, object>) => {
  if (isObject(value)) return (proxyTargets.get(value) ?? value) as JsonValue;
  return value as JsonValue;
};

class ServerState<T extends JsonValue> implements ServerStateHandle<T> {
  private rawState: T;
  private targetProxies = new WeakMap<object, object>();
  private proxyTargets = new WeakMap<object, object>();
  private listeners = new Set<(msg: WireMessage<T>) => void>();
  private pending: WireOperation[] = [];
  private transactionDepth = 0;
  private versionValue = 0;

  readonly state: T;

  constructor(private readonly options: CreateServerStateOptions<T>) {
    this.rawState = cloneJson(options.initial);
    this.state = this.createProxy(this.rawState, []) as T;
  }

  get version() {
    return this.versionValue;
  }

  getSnapshot = (): ['s', number, T] => ['s', this.versionValue, cloneJson(this.rawState)];

  onWireMessage = (listener: (msg: WireMessage<T>) => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  transact = (fn: () => void) => {
    this.transactionDepth++;

    try {
      fn();
    } finally {
      this.transactionDepth--;
      if (this.transactionDepth == 0) this.flush();
    }
  };

  private createProxy(value: JsonValue, path: Path): JsonValue {
    if (!isObject(value)) return value;

    let existing = this.targetProxies.get(value);
    if (existing) return existing as JsonValue;

    let proxy = new Proxy(value as object, {
      get: (target, property, receiver) => {
        if (Array.isArray(target)) {
          let method = this.getArrayMethod(target as JsonValue[], path, property);
          if (method) return method;
        }

        let child = Reflect.get(target, property, receiver);
        if (!isObject(child)) return child;

        return this.createProxy(child as JsonValue, [...path, property as string]);
      },

      set: (target, property, value, receiver) => {
        let unwrapped = unwrapValue(value, this.proxyTargets);

        if (Array.isArray(target)) {
          this.recordArraySet(target as JsonValue[], path, property, unwrapped);
        } else {
          let oldValue = Reflect.get(target, property, receiver);
          if (Object.is(oldValue, unwrapped)) return true;

          let operation: WireOperation =
            typeof oldValue == 'string' &&
            typeof unwrapped == 'string' &&
            unwrapped.startsWith(oldValue)
              ? [OpCode.StringAppend, [...path, property as string], unwrapped.slice(oldValue.length)]
              : [OpCode.Set, [...path, property as string], cloneJson(unwrapped)];

          Reflect.set(target, property, unwrapped, receiver);
          this.record(operation);
        }

        return true;
      },

      deleteProperty: (target, property) => {
        if (!Reflect.has(target, property)) return true;

        Reflect.deleteProperty(target, property);
        this.record([OpCode.Delete, [...path, property as string]]);
        return true;
      }
    });

    this.targetProxies.set(value, proxy);
    this.proxyTargets.set(proxy, value as object);

    return proxy as JsonValue;
  }

  private getArrayMethod(target: JsonValue[], path: Path, property: string | symbol) {
    switch (property) {
      case 'push':
        return (...values: JsonValue[]) => {
          let at = target.length;
          let rawValues = values.map(value => cloneJson(unwrapValue(value, this.proxyTargets)));
          let result = target.push(...rawValues);
          this.record([OpCode.ArrayInsert, [...path], at, rawValues]);
          return result;
        };

      case 'pop':
        return () => {
          if (target.length == 0) return undefined;
          let result = target.pop();
          this.record([OpCode.ArrayRemove, [...path], target.length, 1]);
          return result;
        };

      case 'unshift':
        return (...values: JsonValue[]) => {
          let rawValues = values.map(value => cloneJson(unwrapValue(value, this.proxyTargets)));
          let result = target.unshift(...rawValues);
          this.record([OpCode.ArrayInsert, [...path], 0, rawValues]);
          return result;
        };

      case 'shift':
        return () => {
          if (target.length == 0) return undefined;
          let result = target.shift();
          this.record([OpCode.ArrayRemove, [...path], 0, 1]);
          return result;
        };

      case 'splice':
        return (start: number, deleteCount?: number, ...values: JsonValue[]) => {
          return this.withoutIntermediateFlush(() => {
            let normalizedStart =
              start < 0 ? Math.max(target.length + start, 0) : Math.min(start, target.length);
            let removeCount =
              deleteCount === undefined && values.length == 0
                ? target.length - normalizedStart
                : Math.min(Math.max(deleteCount ?? 0, 0), target.length - normalizedStart);
            let rawValues = values.map(value => cloneJson(unwrapValue(value, this.proxyTargets)));
            let result =
              deleteCount === undefined && values.length == 0
                ? target.splice(start)
                : target.splice(start, deleteCount ?? 0, ...rawValues);

            if (removeCount > 0) {
              this.record([OpCode.ArrayRemove, [...path], normalizedStart, removeCount]);
            }
            if (rawValues.length > 0) {
              this.record([OpCode.ArrayInsert, [...path], normalizedStart, rawValues]);
            }

            return result;
          });
        };
    }
  }

  private recordArraySet(
    target: JsonValue[],
    path: Path,
    property: string | symbol,
    value: JsonValue
  ) {
    if (property == 'length') {
      let oldLength = target.length;
      let newLength = Number(value);
      Reflect.set(target, property, value);

      if (newLength < oldLength) {
        this.record([OpCode.ArrayRemove, [...path], newLength, oldLength - newLength]);
      }
      return;
    }

    let index = toArrayIndex(property);
    if (index == null) {
      if (Object.is((target as unknown as Record<string | symbol, unknown>)[property], value)) {
        return;
      }

      Reflect.set(target, property, value);
      this.record([OpCode.Set, [...path, property as string], cloneJson(value)]);
      return;
    }

    if (index > target.length) throw new Error(`Cannot create sparse array at ${path.join('.')}`);

    if (index == target.length) {
      target.push(cloneJson(value));
      this.record([OpCode.ArrayInsert, [...path], index, [cloneJson(value)]]);
      return;
    }

    if (Object.is(target[index], value)) return;

    target[index] = cloneJson(value);
    this.record([OpCode.ArraySet, [...path], index, cloneJson(value)]);
  }

  private record(operation: WireOperation) {
    this.pending.push(operation);
    if (this.transactionDepth == 0) this.flush();
  }

  private withoutIntermediateFlush<TValue>(fn: () => TValue) {
    this.transactionDepth++;

    try {
      return fn();
    } finally {
      this.transactionDepth--;
      if (this.transactionDepth == 0) this.flush();
    }
  }

  private flush() {
    if (this.pending.length == 0) return;

    let batch: WireBatch = [++this.versionValue, ...this.pending];
    this.pending = [];

    let message: WireMessage<T> =
      this.options.deltaFormat == 'message' ? toDeltaMessage(batch) : cloneBatch(batch);

    for (let listener of this.listeners) listener(message);
    void this.options.emit?.send(message);
  }
}

export let createServerState = <T extends JsonValue>(
  options: CreateServerStateOptions<T>
): ServerStateHandle<T> => new ServerState(options);
