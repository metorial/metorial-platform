import { Context } from '@metorial/context';
import { ServiceError, validationError } from '@metorial/error';
import { IntrospectedType, introspectType, v, ValidationType } from '@metorial/validation';

export interface ServiceRequest<AuthInfo> {
  body: any;
  url: string;
  auth: AuthInfo;
  context: Context;
  requestId: string;
  apiVersion: string;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
  sharedMiddlewareMemo: Map<string, Promise<any>>;
}

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type RequestObject = { type: string; id: string; isPrimary?: boolean };

export type EndpointDescriptor = {
  name: string;
  description: string;

  hideInDocs?: boolean;
};

export type GetHandlerContext<
  AuthInfo,
  Body,
  Query,
  Context extends { [key: string]: any } = {}
> = Context &
  Omit<ServiceRequest<AuthInfo>, 'body' | 'query'> & { body: Body; query: Query } & {
    appendHeaders: (headers: Record<string, string | string[]>) => void;
  };

export interface Path {
  path: string;
  sdkPath: string;
}

export let Path = (path: string, sdkPath: string): Path => ({ path, sdkPath });

export class Group<AuthInfo, Context extends { [key: string]: any } = {}> {
  private constructor(
    private _middleware: Array<
      (
        ctx: Context &
          ServiceRequest<AuthInfo> & {
            appendHeaders: (headers: Record<string, string | string[]>) => void;
          }
      ) => Promise<any>
    > = []
  ) {}

  static create<AuthInfo, Context extends { [key: string]: any } = {}>() {
    return new Group<AuthInfo, Context>();
  }

  use<T extends { [key: string]: any } | undefined | void>(
    handler: (
      ctx: Context &
        ServiceRequest<AuthInfo> & {
          appendHeaders: (headers: Record<string, string | string[]>) => void;
        }
    ) => Promise<T>,
    opts?: {
      getSharedMemoKey?: (ctx: Context & ServiceRequest<AuthInfo>) => string;
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

    return new Group<AuthInfo, Simplify<Context & T>>([...this._middleware, middleware]);
  }

  createMiddleware<T extends { [key: string]: any } | undefined | void, P = void>(
    handler: (ctx: Context & ServiceRequest<AuthInfo>, input: P) => Promise<T>,
    opts?: {
      getSharedMemoKey?: (ctx: Context & ServiceRequest<AuthInfo>, input: P) => string;
    }
  ) {
    return (input: P) =>
      async (ctx: Context & ServiceRequest<AuthInfo>): Promise<T> => {
        let key = opts?.getSharedMemoKey?.(ctx, input);
        if (key && ctx.sharedMiddlewareMemo.has(key)) {
          return await ctx.sharedMiddlewareMemo.get(key)!;
        }

        let res = handler(ctx, input);
        if (key) ctx.sharedMiddlewareMemo.set(key, res);
        return await res;
      };
  }

  get(path: Path | Path[], descriptor: EndpointDescriptor) {
    return new Handler<AuthInfo, any, any, any, Context>(
      this.normalizePath(path),
      'get',
      descriptor,
      [...this._middleware]
    );
  }

  post(path: Path | Path[], descriptor: EndpointDescriptor) {
    return new Handler<AuthInfo, any, any, any, Context>(
      this.normalizePath(path),
      'post',
      descriptor,
      [...this._middleware]
    );
  }

  put(path: Path | Path[], descriptor: EndpointDescriptor) {
    return new Handler<AuthInfo, any, any, any, Context>(
      this.normalizePath(path),
      'put',
      descriptor,
      [...this._middleware]
    );
  }

  patch(path: Path | Path[], descriptor: EndpointDescriptor) {
    return new Handler<AuthInfo, any, any, any, Context>(
      this.normalizePath(path),
      'patch',
      descriptor,
      [...this._middleware]
    );
  }

  delete(path: Path | Path[], descriptor: EndpointDescriptor) {
    return new Handler<AuthInfo, any, any, any, Context>(
      this.normalizePath(path),
      'delete',
      descriptor,
      [...this._middleware]
    );
  }

  private normalizePath(path: Path | Path[]) {
    if (Array.isArray(path)) return path;
    return [path];
  }

  // controller<
  //   HandlersAndSubControllers extends {
  //     [key: string]: Handler<any, any, any> | Controller<any>;
  //   }
  // >(handlers: HandlersAndSubControllers): Controller<HandlersAndSubControllers> {
  //   return handlers;
  // }
}

export type IController<AuthInfo> = {
  [key: string]:
    | Handler<AuthInfo, any, any, any>
    | { handlers: IController<AuthInfo>; descriptor: EndpointDescriptor };
};

export class Controller {
  static create<AuthInfo>(descriptor: EndpointDescriptor, handlers: IController<AuthInfo>) {
    return {
      descriptor,
      handlers
    };
  }

  private constructor() {}
}

export class Handler<
  AuthInfo,
  Body,
  Query,
  Output,
  Context extends { [key: string]: any } = {}
> {
  private _handler!: (
    ctx: GetHandlerContext<AuthInfo, Body, Query, Context>
  ) => Promise<Output>;
  private _validationBody: ValidationType<Body> | undefined;
  private _validationQuery: ValidationType<Query> | undefined;
  private _specificBodies = new Map<
    string,
    {
      validation: ValidationType<any>;
      mapper: (body: any) => Body;
    }
  >();
  private _specificQueries = new Map<
    string,
    {
      validation: ValidationType<any>;
      mapper: (query: any) => Query;
    }
  >();
  private _extractObjects: ((response: Output) => RequestObject[]) | undefined;
  private introspectResponse:
    | (({ apiVersion }: { apiVersion: string }) => {
        name: any;
        object: IntrospectedType;
      })
    | undefined;

  constructor(
    public readonly paths: Path[],
    public readonly method: Method,
    public readonly descriptor: EndpointDescriptor,
    private _middleware: Array<
      (
        ctx: Context &
          ServiceRequest<AuthInfo> & {
            appendHeaders: (headers: Record<string, string | string[]>) => void;
          }
      ) => Promise<any>
    > = []
  ) {}

  do<HandlerOutput>(
    handler: (ctx: GetHandlerContext<AuthInfo, Body, Query, Context>) => Promise<HandlerOutput>
  ): Handler<any, any, any, any, any> {
    if (this._handler != undefined) throw new Error('Handler already defined');

    if (!this.introspectResponse) throw new Error('Output type not defined');

    // @ts-ignore
    this._handler = handler;

    return this as any;
  }

  use<T extends { [key: string]: any } = {}>(
    handler: (
      ctx: Context &
        ServiceRequest<AuthInfo> & {
          appendHeaders: (headers: Record<string, string | string[]>) => void;
        }
    ) => Promise<T | undefined | void>
  ): Handler<AuthInfo, Body, Query, Output, Simplify<Context & T>> {
    this._middleware.push(handler);
    return this as any;
  }

  query<HandlerQuery>(
    version: 'default',
    validation: ValidationType<HandlerQuery>
  ): Handler<AuthInfo, Body, HandlerQuery, Output, Context>;
  query<HandlerQuery>(
    version: string,
    validation: ValidationType<HandlerQuery>,
    mapper: (query: HandlerQuery) => Query
  ): Handler<AuthInfo, Body, Query, Output, Context>;
  query(...[version, validation, mapper]: any[]) {
    if (this._validationQuery != undefined)
      throw new Error('Query validation already defined');

    if (version === 'default') {
      // @ts-ignore
      this._validationQuery = validation;
    } else {
      this._specificQueries.set(version, {
        validation,
        mapper
      });
    }

    return this as any;
  }

  body<HandlerInput>(
    version: 'default',
    validation: ValidationType<HandlerInput>
  ): Handler<AuthInfo, HandlerInput, Query, Output, Context>;
  body<HandlerInput>(
    version: string,
    validation: ValidationType<HandlerInput>,
    mapper: (body: HandlerInput) => Body
  ): Handler<AuthInfo, Body, Query, Output, Context>;
  body(...[version, validation, mapper]: any[]) {
    if (this._validationBody != undefined) throw new Error('Input validation already defined');

    if (version === 'default') {
      // @ts-ignore
      this._validationBody = validation;
    } else {
      this._specificBodies.set(version, {
        validation,
        mapper
      });
    }

    return this as any;
  }

  output(
    presenter: {
      introspect: ({ apiVersion }: { apiVersion: string }) => {
        name: any;
        object: IntrospectedType;
      };
    },
    mode: 'list' | 'get' = 'get'
  ) {
    this.introspectResponse = i => {
      let res = presenter.introspect(i);

      if (mode === 'list') {
        return {
          name: res.name,
          object: {
            type: 'object',
            optional: false,
            nullable: false,
            examples: [
              {
                items: res.object.examples,
                pagination: {
                  has_more_after: false,
                  has_more_before: false
                }
              }
            ],

            properties: {
              items: {
                type: 'array',
                examples: [
                  [res.object.examples[0], res.object.examples[1] ?? res.object.examples[0]]
                ],
                description: res.object.description,
                items: [res.object],
                optional: false,
                nullable: false
              },

              pagination: introspectType(
                v.object({
                  has_more_before: v.boolean(),
                  has_more_after: v.boolean()
                })
              )
            }
          }
        };
      }

      return res;
    };
    return this;
  }

  outputList(presenter: {
    introspect: ({ apiVersion }: { apiVersion: string }) => {
      name: any;
      object: IntrospectedType;
    };
  }) {
    return this.output(presenter, 'list');
  }

  extractObjects(cb: (response: Output) => RequestObject[]) {
    this._extractObjects = cb;
    return this;
  }

  introspect(i: { apiVersion: string }) {
    return {
      path: this.paths[0],
      allPaths: this.paths,
      method: this.method,
      name: this.descriptor.name,
      description: this.descriptor.description,
      hideInDocs: this.descriptor.hideInDocs,
      body: this._validationBody
        ? {
            name: 'Body',
            object: introspectType(this._validationBody)
          }
        : undefined,
      query: this._validationQuery
        ? {
            name: 'Query',
            object: introspectType(this._validationQuery)
          }
        : undefined,
      output: this.introspectResponse!(i)
    };
  }

  async run(
    req: ServiceRequest<AuthInfo>,
    initialContext: any
  ): Promise<{
    response: Output;
    headers: Headers;
    objects: RequestObject[];
  }> {
    if (!this._handler) throw new Error('Handler not defined');

    // if (this._forAuthType && !this._forAuthType.includes(req.auth.type)) {
    //   throw new ServiceError(
    //     unauthorizedError({
    //       message: 'Unauthorized to access this resource',
    //       description: `Tokens of type ${req.auth.type} are not allowed to access this resource`,
    //       hint: undefined
    //     })
    //   );
    // }

    let body = req.body as Body;
    let query = req.query as Query;

    if (this._validationBody) {
      if (this._specificBodies.has(req.apiVersion)) {
        let specific = this._specificBodies.get(req.apiVersion)!;

        let valRes = specific.validation.validate(req.body ?? {});
        if (!valRes.success) {
          throw new ServiceError(validationError({ errors: valRes.errors, entity: 'body' }));
        }

        body = specific.mapper(valRes.value);
      } else {
        let valRes = this._validationBody.validate(req.body ?? {});

        if (!valRes.success) {
          throw new ServiceError(validationError({ errors: valRes.errors, entity: 'body' }));
        }

        body = valRes.value;
      }
    }

    if (this._validationQuery) {
      if (this._specificQueries.has(req.apiVersion)) {
        let specific = this._specificQueries.get(req.apiVersion)!;

        let valRes = specific.validation.validate(req.query ?? {});
        if (!valRes.success) {
          throw new ServiceError(validationError({ errors: valRes.errors, entity: 'query' }));
        }

        query = specific.mapper(valRes.value);
      } else {
        let valRes = this._validationQuery.validate(req.query ?? {});

        if (!valRes.success) {
          throw new ServiceError(validationError({ errors: valRes.errors, entity: 'query' }));
        }

        query = valRes.value;
      }
    }

    let headers = new Headers();

    let ctx = {
      ...initialContext,
      ...req,
      appendHeaders: (newHeaders: Record<string, string | string[]>) => {
        // Object.assign(headers, newHeaders);

        for (let [key, value] of Object.entries(newHeaders)) {
          if (Array.isArray(value)) {
            for (let v of value) headers.append(key, v);
          } else {
            headers.append(key, value);
          }
        }
      },

      // Always use the sanitized input
      body,
      query
    };

    for (let mw of this._middleware) {
      let res = await mw(ctx);
      if (res) ctx = { ...ctx, ...res };
    }

    let res = await this._handler({
      ...ctx,
      query,
      body
    });

    let objects = this._extractObjects?.(res) ?? [];

    return {
      objects,
      response: res,
      headers: headers as any
    };
  }
}
