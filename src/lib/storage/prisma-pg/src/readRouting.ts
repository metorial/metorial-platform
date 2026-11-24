import { AsyncLocalStorage } from 'node:async_hooks';

let REPLICA_CIRCUIT_OPEN_MS = 10_000;

let READ_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'groupBy',
  'aggregate',
  'count'
]);

type ReadScope = {
  preference: 'primary' | 'replica';
  wrote: boolean;
};

// One scope per process, shared by every database client, even when this package is loaded twice.
let scopeStorageKey = Symbol.for('@lowerdeck/prisma-pg/read-scope');
let scopeStorage: AsyncLocalStorage<ReadScope> = ((globalThis as any)[scopeStorageKey] ??=
  new AsyncLocalStorage<ReadScope>());

/**
 * Lets reads inside `cb` go to a reader instance. Only use this for reads that tolerate
 * replication lag: never for reads that decide a write, gate access, or follow a write the
 * caller expects to see. Writes inside the scope switch the rest of the scope to the primary.
 */
// Prisma queries are lazy thenables, so they have to be awaited inside the scope to run in it.
export let withReplicaReads = async <T>(cb: () => PromiseLike<T>): Promise<T> => {
  if (scopeStorage.getStore()) return await cb();
  return scopeStorage.run({ preference: 'replica', wrote: false }, async () => await cb());
};

export let withPrimaryReads = async <T>(cb: () => PromiseLike<T>): Promise<T> => {
  if (scopeStorage.getStore()?.preference === 'primary') return await cb();
  return scopeStorage.run({ preference: 'primary', wrote: false }, async () => await cb());
};

export let isReplicaReadScope = () => {
  let scope = scopeStorage.getStore();
  return scope?.preference === 'replica' && !scope.wrote;
};

let isQueryLevelError = (error: unknown) => {
  let code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' && code.startsWith('P2');
};

export let createReplicaCircuit = (opts: { openMs?: number; now?: () => number } = {}) => {
  let openMs = opts.openMs ?? REPLICA_CIRCUIT_OPEN_MS;
  let now = opts.now ?? Date.now;
  let openUntil = 0;

  return {
    isOpen: () => now() < openUntil,
    open: () => {
      openUntil = now() + openMs;
    }
  };
};

export type ReplicaCircuit = ReturnType<typeof createReplicaCircuit>;

let lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

/**
 * Must be the last extension applied to the primary client: Prisma runs the first-applied
 * extension outermost, so by the time this one runs, the domain extensions have already
 * shaped the arguments and the bare replica client can execute them as-is.
 */
export let createReadRouter = (opts: {
  name: string;
  replica: any;
  circuit?: ReplicaCircuit;
  onReplicaError?: (error: unknown) => void;
}) => {
  let circuit = opts.circuit ?? createReplicaCircuit();

  return {
    name: `${opts.name}-read-router`,
    query: {
      $allOperations: async ({ args, model, operation, query, __internalParams }: any) => {
        let scope = scopeStorage.getStore();

        if (!READ_OPERATIONS.has(operation)) {
          if (scope) scope.wrote = true;
          return query(args);
        }

        if (
          !model ||
          scope?.preference !== 'replica' ||
          scope.wrote ||
          __internalParams?.transaction ||
          circuit.isOpen()
        ) {
          return query(args);
        }

        let delegate = opts.replica[__internalParams?.jsModelName ?? lowerFirst(model)];

        try {
          return await delegate[operation](args);
        } catch (error) {
          if (!isQueryLevelError(error)) {
            circuit.open();
            opts.onReplicaError?.(error);
          }

          return query(args);
        }
      }
    }
  };
};
