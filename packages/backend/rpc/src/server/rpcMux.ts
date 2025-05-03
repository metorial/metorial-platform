import {
  internalServerError,
  notAcceptableError,
  notFoundError,
  validationError
} from '@metorial/error';
import { createExecutionContext, provideExecutionContext } from '@metorial/execution-context';
import { generateCustomId } from '@metorial/id';
import { memo } from '@metorial/memo';
import { getSentry } from '@metorial/sentry';
import { serialize } from '@metorial/serialize';
import { v } from '@metorial/validation';
import * as Cookie from 'cookie';
import { parseForwardedFor } from '../client/lib/extractIp';
import { ServiceRequest } from './controller';

let Sentry = getSentry();

let validation = v.object({
  calls: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      payload: v.any()
    })
  )
});

export let rpcMux = (
  opts: {
    path: string;
    cors?: {
      headers?: string[];
    } & ({ domains: string[] } | { check: (origin: string) => boolean });
  },
  rpcs: {
    handlerNames: string[];
    runMany: (
      req: ServiceRequest,
      body: {
        requestId: string;
        calls: {
          id: string;
          name: string;
          payload: any;
        }[];
      }
    ) => Promise<{
      status: number;
      body: {
        calls: any[];
      };
    }>;
  }[]
) => {
  let handlerNameToRpcMap = new Map<string, number>(
    rpcs.flatMap((rpc, i) => rpc.handlerNames.map(name => [name, i]))
  );

  return {
    path: opts.path,

    fetch: async (req: any): Promise<any> => {
      let origin = req.headers.get('origin') ?? '';
      let corsOk = false;

      if (opts.cors && 'domains' in opts.cors) {
        try {
          let url = new URL(origin);
          let rootDomain = url.hostname.split('.').slice(-2).join('.');
          corsOk = opts.cors.domains.includes(rootDomain);
        } catch (e) {
          // Ignore -> no cors
        }
      } else if (opts.cors && 'check' in opts.cors) {
        corsOk = opts.cors.check(origin);
      }

      let url = new URL(req.url);

      let additionalCorsHeaders = opts.cors?.headers?.join(', ');
      if (additionalCorsHeaders) additionalCorsHeaders = `, ${additionalCorsHeaders}`.trim();

      let corsHeaders: Record<string, string> = corsOk
        ? {
            'access-control-allow-origin': origin,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': `Content-Type, Authorization, Baggage, Sentry-Trace${
              additionalCorsHeaders ?? ''
            }`,
            'access-control-max-age': '604800',
            'access-control-allow-credentials': 'true'
          }
        : {};

      if (req.method == 'OPTIONS') {
        if (corsOk) {
          return new Response(null, {
            status: 204,
            headers: corsHeaders
          });
        }

        return new Response(null, { status: 403 });
      }

      let body: any = null;

      try {
        body = await req.json();
      } catch (e) {
        return new Response(
          JSON.stringify(notAcceptableError({ message: 'Invalid JSON' }).toResponse()),
          { status: 406 }
        );
      }

      let sentryTraceHeaders = req.headers.get('sentry-trace');
      let sentryTrace =
        (Array.isArray(sentryTraceHeaders)
          ? sentryTraceHeaders.join(',')
          : sentryTraceHeaders) ?? undefined;
      let baggage = req.headers.get('baggage');

      let ip = parseForwardedFor(
        req.headers.get('metorial-connecting-ip') ??
          req.headers.get('cf-connecting-ip') ??
          req.headers.get('x-forwarded-for') ??
          req.headers.get('x-real-ip')
      );

      let headers = new Headers();

      if (corsOk) {
        for (let [key, value] of Object.entries(corsHeaders)) {
          headers.append(key, value);
        }
      }

      return await Sentry.withIsolationScope(
        async () =>
          await Sentry.continueTrace(
            { sentryTrace, baggage },
            async () =>
              await Sentry.startSpan(
                {
                  name: 'rpc request',
                  op: 'rpc.server',
                  attributes: {
                    ip,
                    transport: 'http',
                    ua: req.headers.get('user-agent') ?? '',
                    origin: req.headers.get('origin') ?? ''
                  }
                },
                async () => {
                  try {
                    let beforeSends: Array<() => Promise<any>> = [];
                    let id = generateCustomId('req_');

                    let parseCookies = memo(() =>
                      Cookie.parse(req.headers.get('cookie') ?? '')
                    );

                    let request: ServiceRequest = {
                      url: req.url,
                      headers: req.headers,
                      query: url.searchParams,
                      body,
                      rawBody: body,
                      ip,
                      requestId: id,

                      getCookies: () => parseCookies(),
                      getCookie: (name: string) => parseCookies()[name],
                      setCookie: (name: string, value: string, opts?: any) => {
                        let cookie = Cookie.serialize(name, value, opts);
                        // @ts-ignore
                        headers.append('Set-Cookie', cookie);
                      },

                      beforeSend: (handler: () => Promise<any>) => {
                        beforeSends.push(handler);
                      },

                      sharedMiddlewareMemo: new Map<string, Promise<any>>(),

                      appendHeaders: (newHeaders: Record<string, string | string[]>) => {
                        for (let [key, value] of Object.entries(newHeaders)) {
                          if (Array.isArray(value)) {
                            for (let v of value) headers.append(key, v);
                          } else {
                            headers.append(key, value);
                          }
                        }
                      }
                    };

                    Sentry.getCurrentScope().setContext('rpc.request', {
                      url: req.url,
                      query: Object.fromEntries(url.searchParams.entries())
                    });

                    Sentry.getCurrentScope().addAttachment({
                      filename: 'rpc.request.body.json',
                      data: body,
                      contentType: 'application/json'
                    });

                    let valRes = validation.validate(body);
                    if (!valRes.success) {
                      return new Response(
                        JSON.stringify(
                          validationError({
                            errors: valRes.errors,
                            entity: 'request_data'
                          }).toResponse()
                        ),
                        { status: 406, headers }
                      );
                    }

                    return provideExecutionContext(
                      createExecutionContext({
                        type: 'request.dash',
                        contextId: id,
                        ip: ip ?? '127.0.0.1',
                        userAgent: req.headers.get('user-agent') ?? ''
                      }),
                      async () => {
                        let callsByRpc = new Map<
                          number,
                          { id: string; name: string; payload: any }[]
                        >();

                        for (let call of body.calls) {
                          let rpcIndex = handlerNameToRpcMap.get(call.name);
                          if (rpcIndex == undefined) {
                            return new Response(
                              JSON.stringify(
                                notFoundError({ entity: 'handler' }).toResponse()
                              ),
                              { status: 404, headers }
                            );
                          }

                          let calls = callsByRpc.get(rpcIndex) ?? [];
                          calls.push(call);
                          callsByRpc.set(rpcIndex, calls);
                        }

                        // let res = await runMany(request);

                        let resRef = {
                          body: {
                            __typename: 'rpc.response',
                            calls: [] as any[]
                          },
                          status: 200
                        };

                        await Promise.all(
                          Array.from(callsByRpc.entries()).map(async ([rpcIndex, calls]) => {
                            let rpc = rpcs[rpcIndex];
                            let res = await rpc.runMany(request, {
                              requestId: id,
                              calls
                            });

                            resRef.status = Math.max(resRef.status, res.status);
                            resRef.body.calls.push(...res.body.calls);
                          })
                        );

                        headers.append('x-req-id', id);
                        headers.append('content-type', 'application/rpc+json');
                        headers.append('x-powered-by', 'Metorial Gateway RPC');

                        await Promise.all(beforeSends.map(s => s()));

                        return new Response(serialize.encode(resRef.body), {
                          status: resRef.status,
                          headers
                        });
                      }
                    );
                  } catch (e) {
                    console.error(e);

                    Sentry.captureException(e);

                    return new Response(JSON.stringify(internalServerError().toResponse()), {
                      status: 500,
                      headers
                    });
                  }
                }
              )
          )
      );
    }
  };
};
