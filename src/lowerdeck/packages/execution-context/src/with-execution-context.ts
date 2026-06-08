import { context as otelContext, propagation } from '@opentelemetry/api';
import { getSentry } from '@lowerdeck/sentry';
import { AsyncLocalStorage } from 'async_hooks';
import { ExecutionContext } from './execution-context';

let Sentry = getSentry();

let getTraceCarrier = (executionContext: ExecutionContext): Record<string, string> => {
  let current: ExecutionContext | undefined = executionContext;

  while (current) {
    let carrier: Record<string, string> = {};

    if (current.trace?.traceparent) {
      carrier.traceparent = current.trace.traceparent;
    }
    if (current.trace?.tracestate) {
      carrier.tracestate = current.trace.tracestate;
    }
    if (current.trace?.baggage) {
      carrier.baggage = current.trace.baggage;
    }

    if (Object.keys(carrier).length) {
      return carrier;
    }

    current = current.parent;
  }

  return {};
};

export let withExecutionTraceContext = async <T>(
  executionContext: ExecutionContext,
  cb: () => Promise<T>
): Promise<T> => {
  let carrier = getTraceCarrier(executionContext);

  if (!Object.keys(carrier).length) {
    return await cb();
  }

  let extractedContext = propagation.extract(otelContext.active(), carrier);

  return await otelContext.with(extractedContext, cb);
};

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

  let res = await withExecutionTraceContext(
    ctx,
    async () =>
      await ctxStorage.run(
        {
          context: ctx,
          afterHooks
        },
        async () => await cb()
      )
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

export let updateExecutionContext = (ctx: Partial<ExecutionContext>) => {
  let currentCtx = getExecutionContext();

  Object.assign(currentCtx, ctx);

  return currentCtx;
};

export let getExecutionContext = () => {
  let ctx = ctxStorage.getStore();
  if (!ctx) {
    throw new Error('No execution context found');
  }
  return ctx.context;
};
