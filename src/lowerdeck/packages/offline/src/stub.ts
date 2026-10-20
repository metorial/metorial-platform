let valueCounter = 0;

// Stands in for any value returned by a stubbed client: property access, calls and string
// coercion all keep working, and `then` is absent so awaiting it doesn't recurse. Known
// fields (e.g. the data passed to a create) are returned as-is.
export let createOfflineValue = (path: string, known: Record<string, any> = {}): any =>
  new Proxy(function () {}, {
    get: (_, prop) => {
      if (typeof prop == 'string' && Object.hasOwn(known, prop)) return known[prop];
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf')
        return () => `offline_${path}`;
      if (prop === 'toJSON') return () => `offline_${path}`;
      if (prop === Symbol.iterator) return function* () {};
      if (typeof prop === 'symbol') return undefined;
      return createOfflineValue(`${path}.${prop}`);
    },
    has: (_, prop) => typeof prop == 'string' && Object.hasOwn(known, prop),
    apply: () => createOfflineValue(`${path}()`),
    construct: () => createOfflineValue(path)
  });

export let createOfflineRecord = (name: string, known: Record<string, any> = {}) =>
  createOfflineValue(`${name}#${valueCounter++}`, known);

let stubbedCalls = new Map<string, number>();

export let recordStubbedCall = (kind: string) =>
  stubbedCalls.set(kind, (stubbedCalls.get(kind) ?? 0) + 1);

export let getStubbedCalls = () => Object.fromEntries(stubbedCalls);
