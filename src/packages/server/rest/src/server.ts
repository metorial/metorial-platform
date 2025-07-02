import { Context } from '@metorial/context';
import {
  badRequestError,
  internalServerError,
  isServiceError,
  notFoundError
} from '@metorial/error';
import { createExecutionContext, provideExecutionContext } from '@metorial/execution-context';
import { generateId } from '@metorial/id';
import { PresenterContext } from '@metorial/presenter';
import { getSentry } from '@metorial/sentry';
import opentelemetry, { context, propagation, Span } from '@opentelemetry/api';
import { Hono } from 'hono';
import qs from 'qs';
import { EndpointDescriptor, Group, Handler, IController, ServiceRequest } from './controller';
import { introspectApi } from './introspect';
import { parseBody } from './parseBody';
import { RateLimiter } from './ratelimit';
import { Authenticator, RequestFlags } from './types';

let Sentry = getSentry();

export let json = (data: any, status: number = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });

interface CustomHandler<AuthInfo, ApiVersion extends string> {
  handler: (i: {
    req: Request;
    auth: AuthInfo;
    context: Context;
    version: ApiVersion;
    url: URL;
    corsHeaders: Record<string, string>;
    server: any;
    requestId: string;
  }) => Promise<Response | undefined>;
  path: RegExp;
}

export class RestServerBuilder<AuthInfo, ApiVersion extends string> {
  #authenticate?: Authenticator<AuthInfo>;
  #checkCors?: (i: { origin: string; auth: AuthInfo }) => boolean;
  #rateLimiter?: RateLimiter<AuthInfo>;
  #customHandlers: CustomHandler<AuthInfo, ApiVersion>[] = [];
  #getPresenterContext?: (auth: AuthInfo & { apiVersion: ApiVersion }) => PresenterContext;

  constructor() {}

  authenticate(authenticate: Authenticator<AuthInfo>) {
    this.#authenticate = authenticate;
    return this;
  }

  checkCors(checkCors: (i: { origin: string; auth: AuthInfo }) => boolean) {
    this.#checkCors = checkCors;
    return this;
  }

  rateLimiter(rateLimiter: RateLimiter<AuthInfo>) {
    this.#rateLimiter = rateLimiter;
    return this;
  }

  addCustomHandler(handler: CustomHandler<AuthInfo, ApiVersion>) {
    this.#customHandlers.push(handler);
    return this;
  }

  providePresenterContext(
    getPresenterContext: (auth: AuthInfo & { apiVersion: ApiVersion }) => PresenterContext
  ) {
    this.#getPresenterContext = getPresenterContext;
    return this;
  }

  build() {
    if (!this.#authenticate) throw new Error('authenticate is required');
    if (!this.#rateLimiter) throw new Error('rateLimiter is required');

    return RestServer.$$create$$_internal(
      this.#authenticate,
      this.#checkCors ?? (() => false),
      this.#rateLimiter,
      this.#customHandlers,
      this.#getPresenterContext
    );
  }
}

export class RestServer<AuthInfo, ApiVersion extends string> {
  private constructor(
    private authenticate: Authenticator<AuthInfo>,
    private checkCors: (i: { origin: string; auth: AuthInfo }) => boolean,
    private rateLimiter: RateLimiter<AuthInfo>,
    private customHandlers: CustomHandler<AuthInfo, ApiVersion>[],
    private getPresenterContext?: (
      auth: AuthInfo & { apiVersion: ApiVersion }
    ) => PresenterContext
  ) {}

  static $$create$$_internal<AuthInfo, ApiVersion extends string>(
    authenticate: Authenticator<AuthInfo>,
    checkCors: (i: { origin: string; auth: AuthInfo }) => boolean,
    rateLimiter: RateLimiter<AuthInfo>,
    customHandlers: CustomHandler<AuthInfo, ApiVersion>[],
    getPresenterContext?: (auth: AuthInfo & { apiVersion: ApiVersion }) => PresenterContext
  ) {
    return new RestServer(
      authenticate,
      checkCors,
      rateLimiter,
      customHandlers,
      getPresenterContext
    );
  }

  static create<AuthInfo, ApiVersion extends string>() {
    return new RestServerBuilder<AuthInfo, ApiVersion>();
  }

  get controller() {
    return Group.create<AuthInfo, {}>();
  }

  launch({
    versions,
    currentVersion
  }: {
    versions: {
      [version: string]: {
        apiVersion: ApiVersion;
        displayVersion: string;
        alternativeIdentifiers: string[];
        controller: {
          handlers: IController<AuthInfo>;
          descriptor: EndpointDescriptor;
        };
      };
    };
    currentVersion: string;
  }) {
    // let ingestQueue = new PQueue({ concurrency: 25 });

    let versionApps = new Map(
      Object.entries(versions).flatMap(
        ([_, { apiVersion, controller, alternativeIdentifiers, displayVersion }]) => {
          let app = new Hono<{
            Bindings: {
              origin: string;
              auth: AuthInfo;
              context: Context;
              requestId: string;
              url: URL;
              flags: RequestFlags;
              span: Span;
            };
          }>();

          let getHandlers = (controller: IController<AuthInfo>) => {
            let handlers: Handler<AuthInfo, any, any, any>[] = [];

            for (let controllerOrHandler of Object.values(controller)) {
              if (controllerOrHandler instanceof Handler) {
                handlers.push(controllerOrHandler);
              } else {
                handlers.push(...getHandlers(controllerOrHandler.handlers));
              }
            }

            return handlers;
          };

          let handlers = getHandlers(controller.handlers);

          for (let handler of handlers) {
            for (let { path } of handler.paths) {
              app[handler.method](path, c =>
                Sentry.withIsolationScope(() =>
                  Sentry.startSpan(
                    {
                      op: `public.http.${handler.method}`,
                      name: `${handler.method} ${path}`,
                      attributes: {
                        'http.method': handler.method,
                        'http.path': path,
                        requestId: c.env.requestId
                      }
                    },
                    async span => {
                      let response: { status: number; body: any } = {
                        status: 200,
                        body: null
                      };
                      // let startedAt = new Date();

                      let body = await parseBody(c);

                      let query = qs.parse(c.env.url.search, {
                        ignoreQueryPrefix: true
                      }) as any;

                      Sentry.getCurrentScope().setContext('rpc.request', {
                        url: c.req.url,
                        query,
                        apiVersion,
                        body: body,
                        auth: c.env.auth,
                        context: c.env.context
                      });

                      c.env.span.setAttributes({
                        'metorial.api.version': apiVersion,
                        'metorial.request.id': c.env.requestId,
                        'metorial.request.url': c.req.url,
                        'metorial.request.method': handler.method,
                        'metorial.request.context.ip': c.env.context.ip,
                        'metorial.request.context.ua': c.env.context.ua ?? 'unknown'
                      });

                      // let objects: RequestObject[] = [];

                      let request: ServiceRequest<AuthInfo> = {
                        query,
                        apiVersion,
                        url: c.req.url,
                        body: body?.data,
                        headers: c.req.header(),
                        params: c.req.param() as any,

                        auth: c.env.auth,
                        context: c.env.context,
                        requestId: c.env.requestId,

                        sharedMiddlewareMemo: new Map<string, Promise<any>>()
                      };

                      // let clientString = c.req.header('metorial-client');
                      // let [clientName, clientVersion] = clientString?.split('@') ?? [];
                      // let client = { name: clientName, version: clientVersion };

                      try {
                        let handlerRes = await provideExecutionContext(
                          createExecutionContext({
                            type: 'request',
                            ip: request.context.ip,
                            contextId: c.env.requestId,
                            userAgent: request.context.ua ?? 'unknown'
                          }),
                          async () => await handler.run(request, {})
                        );

                        if (typeof handlerRes.response == 'function') {
                          handlerRes.response = await handlerRes
                            .response(
                              this.getPresenterContext!({
                                ...request.auth,
                                apiVersion
                              })
                            )
                            .run({});
                        }

                        // @ts-ignore
                        for (let [key, value] of handlerRes.headers.entries()) {
                          c.res.headers.set(key, value);
                        }

                        response = {
                          status: 200,
                          body: handlerRes.response
                        };
                        // objects = handlerRes.objects;
                      } catch (e) {
                        if (isServiceError(e)) {
                          response = {
                            status: e.data.status,
                            body: e.toResponse()
                          };
                        } else {
                          Sentry.captureException(e);
                          console.error('Error in handler', e);

                          response = {
                            status: 500,
                            body: internalServerError().toResponse()
                          };
                        }
                      }

                      let jsonBody = JSON.stringify(response.body);

                      return new Response(jsonBody, {
                        status: response.status,
                        headers: {
                          'content-type': 'application/json'
                        }
                      });
                    }
                  )
                )
              );
            }
          }

          app.notFound(async c => {
            return c.json(notFoundError('endpoint', undefined).toResponse(), 404);
          });

          app.onError(async (err, c) => {
            if (isServiceError(err)) return c.json(err.toResponse(), err.data.status);
            return c.json(internalServerError().toResponse(), 500);
          });

          return [apiVersion, ...alternativeIdentifiers].map(identifier => [
            identifier,
            {
              app,
              displayVersion,
              version: apiVersion,
              rootController: controller
            }
          ]);
        }
      )
    );

    let knowVersions = new Set(Object.keys(versions));

    let apiServerTracer = opentelemetry.trace.getTracer('@metorial/rest/server', '1.0.0');

    return {
      fetch: async (req: Request, server: any): Promise<any> => {
        let requestId = generateId('req_');

        return apiServerTracer.startActiveSpan('restApi.fetch', span =>
          context.with(
            propagation.setBaggage(context.active(), propagation.createBaggage({})),
            () =>
              provideExecutionContext(
                {
                  type: 'request',
                  contextId: requestId,
                  ip: 'x',
                  userAgent: 'x'
                },
                async () => {
                  let origin = req.headers.get('origin') ?? '';

                  span.addEvent('request.start');

                  let corsHeaders: Record<string, string> = {
                    'access-control-allow-origin': origin,
                    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                    'access-control-allow-headers':
                      'Content-Type, Authorization, Cookies, metorial-version, metorial-instance-id, metorial-organization-id, baggage, sentry-trace, metorial-client',
                    'access-control-max-age': '604800',
                    'access-control-allow-credentials': 'true',
                    'x-powered-by': 'Metorial'
                  };

                  try {
                    let url = new URL(req.url);
                    if (url.pathname == '/ping') return new Response('OK');
                    if (url.pathname == '/')
                      return Response.redirect('https://metorial.com/api', 301);
                    if (url.pathname == '/metorial/introspect/versions') {
                      return json({
                        versions: Object.entries(versions).map(
                          ([_, { apiVersion, displayVersion }]) => ({
                            version: apiVersion,
                            displayVersion,
                            isCurrent: apiVersion == currentVersion
                          })
                        )
                      });
                    }
                    if (url.pathname == '/metorial/introspect/endpoints') {
                      let version = url.searchParams.get('version');
                      if (!version) {
                        return json(
                          badRequestError({
                            message: 'Version is required'
                          }).toResponse(),
                          400,
                          corsHeaders
                        );
                      }

                      let selectedVersion = versionApps.get(version);
                      if (!selectedVersion) {
                        return json(
                          badRequestError({
                            message: `Invalid API version: ${version}`
                          }).toResponse(),
                          406,
                          corsHeaders
                        );
                      }

                      return json(
                        introspectApi({
                          version: selectedVersion.version as any,
                          rootController: selectedVersion.rootController,
                          displayVersion: selectedVersion.displayVersion,
                          isCurrent: selectedVersion.version == currentVersion
                        })
                      );
                    }

                    if (req.method == 'OPTIONS') {
                      return new Response(null, {
                        status: 204,
                        headers: corsHeaders
                      });
                    }

                    let auth = await this.authenticate(req, url as URL);

                    let corsOk = this.checkCors({
                      origin,
                      auth: auth.auth
                    });
                    if (!corsOk) corsHeaders = {};

                    let rateLimit = await this.rateLimiter.check({
                      auth: auth.auth,
                      context: auth.context
                    });
                    if (!rateLimit.allowed) return rateLimit.response;

                    // await updateExecutionContext({
                    //   apiKeyId: 'apiKey' in auth.token ? auth.token.apiKey.id : undefined,
                    //   ip: auth.context.ip,
                    //   userAgent: auth.context.ua ?? 'unknown'
                    // });

                    let version =
                      req.headers.get('metorial-version') ??
                      url.searchParams.get('api-version');

                    if (version && !knowVersions.has(version)) version = null;
                    if (!version && auth.defaultVersion) version = auth.defaultVersion;
                    if (!version) version = currentVersion;

                    let selectedVersion = versionApps.get(version);

                    if (!selectedVersion) {
                      return json(
                        badRequestError({
                          message: `Invalid API version: ${version}`
                        }).toResponse(),
                        406,
                        corsHeaders
                      );
                    }

                    if (!auth.allowedVersions.includes(selectedVersion.version)) {
                      return json(
                        badRequestError({
                          message: `Invalid API version: ${version}`
                        }).toResponse(),
                        406,
                        corsHeaders
                      );
                    }

                    for (let custom of this.customHandlers) {
                      if (custom.path.test(url.pathname)) {
                        return custom.handler({
                          req,

                          // @ts-ignore
                          url,

                          server,
                          requestId,
                          corsHeaders,
                          auth: auth.auth,
                          context: auth.context,
                          version: selectedVersion.version
                        });
                      }
                    }

                    let res = await selectedVersion.app.fetch(req, {
                      requestId,
                      origin,
                      url,
                      span,
                      ...auth
                    });

                    res.headers.set('metorial-version', selectedVersion.displayVersion);
                    res.headers.set('metorial-req-id', requestId);
                    res.headers.set('x-powered-by', 'Metorial');
                    // res.headers.set('content-type', 'application/json');

                    for (let [key, value] of Object.entries(corsHeaders)) {
                      res.headers.set(key, value);
                    }

                    for (let [key, value] of Object.entries(rateLimit.headers)) {
                      res.headers.set(key, value);
                    }

                    return res;
                  } catch (e) {
                    if (isServiceError(e))
                      return json(e.toResponse(), e.data.status, corsHeaders);

                    Sentry.captureException(e);

                    console.error('Error in fetch handler', e);

                    return json(internalServerError().toResponse(), 500, corsHeaders);
                  } finally {
                    span.addEvent('request.end');
                    span.end();
                  }
                }
              )
          )
        );
      }
    };
  }
}
