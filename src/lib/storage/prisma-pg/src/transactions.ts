import { AsyncLocalStorage } from 'node:async_hooks';
import {
  provideExecutionContext,
  withExecutionContextOptional
} from '@lowerdeck/execution-context';
import PQueue from 'p-queue';
import { withPrimaryReads } from './readRouting';

type Hook = () => unknown;

type TransactionStore = {
  tdb: any;
  open: boolean;
  afterHooks: Hook[];
  awaitedAfterHooks: Hook[];
};

export type TransactionCapableClient = {
  $transaction: (...args: any[]) => Promise<any>;
};

export type TransactionClientOf<Client extends TransactionCapableClient> = Parameters<
  Extract<Parameters<Client['$transaction']>[0], (...args: any[]) => any>
>[0];

export type WithTransactionOptions = {
  ifExists?: boolean;
  timeout?: number;
  maxWait?: number;
};

export type TransactionManagerOptions = {
  name: string;
  afterHookDelayMs?: number;
  warnOnAfterHookOutsideTransaction?: boolean;
};

export let createTransactionManager = <Client extends TransactionCapableClient>(
  client: Client,
  opts: TransactionManagerOptions
) => {
  let storage = new AsyncLocalStorage<TransactionStore>();
  let afterHookQueue = new PQueue({ concurrency: Infinity });

  let getOpenTransaction = () => {
    let store = storage.getStore();
    return store?.open ? store : undefined;
  };

  let bindTo = (value: unknown, target: object) =>
    typeof value === 'function' ? value.bind(target) : value;

  // `$transaction` always opens a separate transaction on the base client. Work that outlives
  // its transaction (detached promises) falls back to the base client instead of the closed one.
  let db = new Proxy(client, {
    get(target, property) {
      let transaction = getOpenTransaction();

      if (transaction && property !== '$transaction') {
        let value = Reflect.get(transaction.tdb, property);
        if (value !== undefined) return bindTo(value, transaction.tdb);
      }

      return bindTo(Reflect.get(target, property, target), target);
    }
  });

  let runOnPrimary = (hook: Hook) => withPrimaryReads(async () => await hook());

  // Nobody awaits these hooks, so a rejection would otherwise be unhandled and take the process down.
  let enqueueAfterHook = (hook: Hook) =>
    afterHookQueue
      .add(() => runOnPrimary(hook))
      .catch(error => console.error(`[${opts.name}] after-transaction hook failed`, error));

  let withHookContext = (hook: Hook): Promise<Hook> =>
    withExecutionContextOptional(async context =>
      context ? () => provideExecutionContext(context, async () => await hook()) : hook
    );

  let withTransaction = async <T>(
    cb: (tdb: TransactionClientOf<Client>) => Promise<T>,
    options: WithTransactionOptions = {}
  ): Promise<T> => {
    let active = getOpenTransaction();
    if (active) return cb(active.tdb);
    if (options.ifExists) return cb(db as any);

    let store: TransactionStore = {
      tdb: undefined,
      open: true,
      afterHooks: [],
      awaitedAfterHooks: []
    };

    let result: T;
    try {
      result = await client.$transaction(
        async (tdb: any) => {
          store.tdb = tdb;
          return storage.run(store, async () => await cb(tdb));
        },
        { timeout: options.timeout, maxWait: options.maxWait }
      );
    } finally {
      store.open = false;
    }

    if (store.afterHooks.length) {
      let hooks = store.afterHooks;
      void enqueueAfterHook(() => Promise.all(hooks.map(hook => hook())));
    }

    for (let hook of store.awaitedAfterHooks) {
      await runOnPrimary(hook);
    }

    return result;
  };

  let addAfterTransactionHook = async (hook: Hook) => {
    let run = await withHookContext(hook);

    let transaction = getOpenTransaction();
    if (transaction) {
      transaction.afterHooks.push(run);
      return;
    }

    if (opts.warnOnAfterHookOutsideTransaction) {
      console.warn(
        `[${opts.name}] addAfterTransactionHook called outside of a transaction`,
        new Error().stack
      );
    }

    if (opts.afterHookDelayMs) {
      setTimeout(() => void enqueueAfterHook(run), opts.afterHookDelayMs);
    } else {
      void enqueueAfterHook(run);
    }
  };

  /**
   * Runs the hook once the outermost transaction has committed, before that transaction's caller
   * continues, and surfaces its failures to them.
   *
   * Use this for work that has to observe the committed rows and that the caller should not be
   * able to proceed without, such as copying a written row into another database. Nested calls
   * register on the outermost transaction, so an operation composed of several services still
   * copies once, after everything it wrote is visible.
   */
  let addAwaitedAfterTransactionHook = async (hook: Hook) => {
    let run = await withHookContext(hook);

    let transaction = getOpenTransaction();
    if (transaction) {
      transaction.awaitedAfterHooks.push(run);
      return;
    }

    await runOnPrimary(run);
  };

  return {
    db,
    withTransaction,
    addAfterTransactionHook,
    addAwaitedAfterTransactionHook,
    isInTransaction: () => !!getOpenTransaction()
  };
};
