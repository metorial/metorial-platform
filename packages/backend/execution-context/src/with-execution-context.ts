import { getSentry } from '@metorial/sentry';
import { AsyncLocalStorage } from 'async_hooks';
import { ExecutionContext } from './execution-context';

let Sentry = getSentry();

export let ctxStorage = new AsyncLocalStorage<{
  context: ExecutionContext;
  afterHooks?: Array<() => Promise<void | any>>;
}>();

export let withExecutionContext = async <T>(
  cb: (ctx: ExecutionContext) => Promise<T>
): Promise<T> => {
  let ctx = ctxStorage.getStore();
  if (!ctx) {
    throw new Error('No execution context found');
  }

  return await cb(ctx.context);
};

export let withExecutionContextOptional = async <T>(
  cb: (ctx: ExecutionContext | null) => Promise<T>
): Promise<T> => {
  let ctx = ctxStorage.getStore();
  return await cb(ctx?.context ?? null);
};

export let addAfterHook = async (hook: () => Promise<void | any>) => {
  let ctx = ctxStorage.getStore();
  if (!ctx) {
    throw new Error('No execution context found');
  }

  if (!ctx.afterHooks) {
    throw new Error('After hooks not enabled for this execution context');
  }

  ctx.afterHooks.push(hook);
};

export let provideExecutionContext = async <T>(
  ctx: ExecutionContext,
  cb: () => Promise<T>
): Promise<T> => {
  let afterHooks: Array<() => Promise<void | any>> = [];

  Sentry.setContext('executionContext', ctx);

  let res = await ctxStorage.run(
    {
      context: ctx,
      afterHooks
    },
    async () => await cb()
  );

  for (let hook of afterHooks) {
    hook().catch(err => {
      Sentry.captureException(err);

      console.error('Error in after hook', {
        err,
        context: ctx
      });
    });
  }

  return res;
};

export let setExecutionContextSync = (ctx: ExecutionContext) => {
  ctxStorage.enterWith({
    context: ctx
  });
};

export let updateExecutionContext = (ctx: Partial<ExecutionContext>) =>
  withExecutionContext(async currentCtx => {
    Object.assign(currentCtx, ctx);
  });
