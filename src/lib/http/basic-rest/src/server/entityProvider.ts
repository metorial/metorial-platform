import {
  badRequestError,
  internalServerError,
  isServiceError,
  notFoundError,
  validationError
} from '@lowerdeck/error';
import { EntityRequest, IAction, BaseState, MethodType, IEntity } from '../types';
import { Entity } from './entity';

let jsonHeaders = () =>
  new Headers({
    'Content-Type': 'application/json'
  });

let toJsonResponse = (body: any, status: number, headers?: Headers) => {
  let resHeaders = headers ?? jsonHeaders();
  if (!resHeaders.has('Content-Type')) resHeaders.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body ?? null), {
    status,
    headers: resHeaders
  });
};

let isPlainObject = (value: any) =>
  !!value && typeof value == 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

let parseInputFromQuery = (query: Record<string, string>) => {
  let keys = Object.keys(query);
  if (keys.length == 1 && keys[0] == 'input') return query.input;
  return query;
};

let stripBasePath = (pathname: string, basePath: string) => {
  if (!basePath || basePath == '/') return pathname;
  if (pathname == basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || '/';

  return pathname;
};

export class EntityProvider<
  State extends BaseState,
  Request extends {} = {}
> {
  constructor(
    private reqToState: (req: EntityRequest) => State | Promise<State> = async () => ({} as State),
    private onError?: (d: { err: any; state?: State; req?: EntityRequest }) => void
  ) {}

  public entity<
    ID extends string,
    EntityType,
    Parent extends IEntity<any, any, any, any, any, any> | undefined = undefined
  >({
    id,
    name,
    parent,
    provider
  }: {
    id: ID;
    name: string;
    provider: any;
    parent?: Entity<Parent, string, any, Request, State, any>;
  }) {
    return () =>
      new Entity<Parent, ID, EntityType, Request, State>(this, parent, {
        id,
        name,
        provider,
        actions: {},
        fullEntity: {} as any,
        ids: {} as any,
        parent: undefined as any
      });
  }

  public service<Entities extends Entity<any, any, any, Request, State, any>[]>(
    entities: Entities,
    opts?: { path?: string }
  ) {
    let path = opts?.path ?? '/';
    if (!path.startsWith('/')) path = `/${path}`;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

    let call = async (request: globalThis.Request): Promise<Response> => {
      let url = new URL(request.url);
      let method = request.method.toLowerCase() as MethodType;
      let headers = new Headers(request.headers);
      let query = Object.fromEntries(url.searchParams.entries());
      let rawBody = '';
      let body: any = {};

      try {
        if (method != 'get' && method != 'delete') {
          rawBody = await request.text();

          if (rawBody.trim().length) {
            try {
              body = JSON.parse(rawBody);
            } catch {
              return toJsonResponse(
                badRequestError({ message: 'Invalid JSON body' }).toResponse(),
                400
              );
            }
          }
        }
      } catch (err) {
        this.onError?.({ err, req: undefined });
        return toJsonResponse(internalServerError().toResponse(), 500);
      }

      let req: EntityRequest = {
        request,
        url,
        path: stripBasePath(url.pathname, path).split('/').filter(Boolean),
        method,
        headers,
        query,
        rawBody,
        body,
        input: method == 'get' || method == 'delete' ? parseInputFromQuery(query) : body
      };

      let retrievedEntity: ReturnType<(typeof entities)[number]['retrieve']> | null = null;
      for (let entity of entities) {
        let res = entity.retrieve(req.path, method, {});

        if (res && res[res.length - 1].path.length == 0 && res[res.length - 1].action) {
          retrievedEntity = res as any;
          break;
        }
      }

      if (!retrievedEntity) {
        return toJsonResponse(notFoundError({ entity: 'endpoint' }).toResponse(), 404);
      }

      let lastEntity = retrievedEntity[retrievedEntity.length - 1];
      if (!lastEntity.action) {
        return toJsonResponse(notFoundError({ entity: 'endpoint' }).toResponse(), 404);
      }

      if (method != 'get' && method != 'delete') {
        if (isPlainObject(body) && 'input' in body) {
          req.input = (body as any).input;
        } else {
          req.input = body;
        }
      }

      let state: State;

      try {
        state = await this.reqToState(req);
      } catch (err) {
        if (isServiceError(err)) {
          return toJsonResponse(err.toResponse(), err.data.status);
        }

        this.onError?.({ err, req });
        return toJsonResponse(internalServerError().toResponse(), 500);
      }

      try {
        let rawIDs = retrievedEntity[retrievedEntity.length - 1].ids;
        let records: Record<string, any> = {};

        for (let item of retrievedEntity) {
          if (!item.needsProvider) continue;

          let currentEntity = await item.entity.provider(
            {
              ...rawIDs,
              ...records
            },
            {
              ...req,
              state
            } as any
          );

          records[item.entity.id] = currentEntity;
        }

        let validatedInput = lastEntity.action.input.validate(req.input);
        if (!validatedInput.success) {
          return toJsonResponse(
            validationError({ errors: validatedInput.errors, entity: 'body' }).toResponse(),
            400
          );
        }

        let result = await lastEntity.action.handler(records, {
          ...req,
          state,
          input: validatedInput.value
        } as any);

        let responseHeaders = new Headers();
        responseHeaders.set('Content-Type', 'application/json');
        responseHeaders.set('X-Lowerdeck-Entity', lastEntity.entity.id);
        responseHeaders.set('X-Lowerdeck-Action', lastEntity.action.name);
        responseHeaders.set('X-Lowerdeck-Method', lastEntity.action.type);

        let status = 200;
        if (lastEntity.action.type == 'create') status = 201;

        return toJsonResponse(result, status, responseHeaders);
      } catch (err) {
        if (isServiceError(err)) {
          return toJsonResponse(err.toResponse(), err.data.status);
        }

        this.onError?.({ err, state, req });
        return toJsonResponse(internalServerError().toResponse(), 500);
      }
    };

    return {
      path,
      fetch: async (request: globalThis.Request) => await call(request)
    };
  }
}
