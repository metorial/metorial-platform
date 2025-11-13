import { ServiceError, validationError } from '@metorial/error';
import { ValidationType } from '@metorial/validation';
import * as Cookie from 'cookie';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ServiceRequest {
  query: URLSearchParams;
  headers: Headers;
  url: string;
  ip?: string;
  body: any;
  rawBody: any;
  requestId: string;

  getCookies: () => Record<string, string | undefined>;
  getCookie: (name: string) => string | undefined;
  setCookie: (name: string, value: string, opts?: Cookie.SerializeOptions) => void;

  sharedMiddlewareMemo: Map<string, Promise<any>>;
  beforeSend: (handler: () => Promise<any>) => void;
  appendHeaders: (headers: Record<string, string | string[]>) => void;
}

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
export type ExtendContext<C extends object, E> = E extends object ? Simplify<C & E> : C;

export class Group<Context extends { [key: string]: any } = {}> {
  constructor(
    private _middleware: Array<(ctx: Context & ServiceRequest) => Promise<any>> = []
  ) {}

  use<T extends { [key: string]: any } | undefined | void>(
    handler: (ctx: Context & ServiceRequest) => Promise<T>,
    opts?: {
      getSharedMemoKey?: (ctx: Context & ServiceRequest) => string;
    }
  ) {
    let middleware = async (ctx: Parameters<typeof handler>[0]): Promise<T> => {
      let key = opts?.getSharedMemoKey?.(ctx);
      if (key && ctx.sharedMiddlewareMemo.has(key)) {
        return await ctx.sharedMiddlewareMemo.get(key)!;
      }

      let res = handler(ctx);
      if (key) ctx.sharedMiddlewareMemo.set(key, res);

      return await res;
    };

    return new Group<Simplify<Context & T>>([...this._middleware, middleware]);
  }

  createMiddleware<T extends { [key: string]: any }, P = void>(
    handler: (ctx: Context & ServiceRequest, input: P) => Promise<T>,
    opts?: {
      getSharedMemoKey?: (ctx: Context & ServiceRequest, input: P) => string;
    }
  ) {
    return (input: P) =>
      async (ctx: Context & ServiceRequest): Promise<T> => {
        let key = opts?.getSharedMemoKey?.(ctx, input);
        if (key && ctx.sharedMiddlewareMemo.has(key)) {
          return await ctx.sharedMiddlewareMemo.get(key)!;
        }

        let res = handler(ctx, input);
        if (key) ctx.sharedMiddlewareMemo.set(key, res);

        return await res;
      };
  }

  handler() {
    return new Handler([...this._middleware]);
  }

  controller<
    HandlersAndSubControllers extends {
      [key: string]: Handler<any, any, any> | Controller<any>;
    }
  >(handlers: HandlersAndSubControllers): Controller<HandlersAndSubControllers> {
    return handlers;
  }
}

export type Controller<
  HandlersAndSubControllers extends { [key: string]: Handler<any, any, any> | Controller<any> }
> = HandlersAndSubControllers;

export type InferControllerType<T> = T extends Controller<infer U> ? U : never;

export type InferClient<
  HandlersAndSubControllers extends { [key: string]: Handler<any, any, any> | Controller<any> }
> = {
  [K in keyof HandlersAndSubControllers]: HandlersAndSubControllers[K] extends Handler<
    infer I,
    infer O,
    infer C
  >
    ? ((
        input: I,
        opts?: { headers?: Record<string, string>; query?: Record<string, string> }
      ) => Promise<O>) & {
        getFull: (
          input: I,
          opts?: { headers?: Record<string, string>; query?: Record<string, string> }
        ) => Promise<{
          data: O;
          status: number;
          headers: Record<string, string>;
        }>;
      }
    : HandlersAndSubControllers[K] extends Controller<infer U>
      ? InferClient<U>
      : never;
};

export class Handler<Input, Output, Context extends { [key: string]: any } = {}> {
  private _handler!: (
    ctx: Context & Omit<ServiceRequest, 'body'> & { input: Input }
  ) => Promise<Output>;
  private _validation: ValidationType<Input> | undefined;

  constructor(
    private _middleware: Array<(ctx: Context & ServiceRequest) => Promise<any>> = []
  ) {}

  do<HandlerOutput>(
    handler: (
      ctx: Context & Omit<ServiceRequest, 'body'> & { input: Input }
    ) => Promise<HandlerOutput>
  ) {
    if (this._handler != undefined) throw new Error('Handler already defined');

    // @ts-ignore
    this._handler = handler;

    return this as any as Handler<Input, HandlerOutput, Context>;
  }

  use<T extends { [key: string]: any } = {}>(
    handler: (ctx: Context & ServiceRequest) => Promise<T | undefined | void>
  ) {
    this._middleware.push(handler);
    return this as any as Handler<Input, Output, ExtendContext<Context, T>>;
  }

  input<HandlerInput>(validation: ValidationType<HandlerInput>) {
    if (this._validation != undefined) throw new Error('Input validation already defined');

    // @ts-ignore
    this._validation = validation;

    return this as any as Handler<HandlerInput, Output, Context>;
  }

  async run(
    req: ServiceRequest,
    initialContext: any
  ): Promise<{
    response: Output;
  }> {
    if (!this._handler) throw new Error('Handler not defined');

    let input = req.body as Input;

    if (this._validation) {
      let valRes = this._validation.validate(req.body);

      if (!valRes.success) {
        throw new ServiceError(
          validationError({ errors: valRes.errors, entity: 'call_data' })
        );
      }

      input = valRes.value;
    }

    let ctx = {
      ...initialContext,
      ...req,

      // Always use the sanitized input
      body: input
    };

    for (let mw of this._middleware) {
      let res = await mw(ctx);
      if (res) ctx = { ...ctx, ...res };
    }

    let res = await this._handler({
      ...ctx,
      input,
      body: undefined
    });

    return {
      response: res
    };
  }
}
