import {
  internalServerError,
  notAcceptableError,
  notFoundError,
  validationError
} from '@lowerdeck/error';
import { createExecutionContext, provideExecutionContext } from '@lowerdeck/execution-context';
import { generateCustomId } from '@lowerdeck/id';
import { memo } from '@lowerdeck/memo';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import {
  isTelemetryEnabled,
  otelContext,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace
} from '@lowerdeck/telemetry';
import { v } from '@lowerdeck/validation';
import * as Cookie from 'cookie';
import { ServiceRequest } from './controller';
import { parseForwardedFor } from './extractIp';

let verbose = process.env.NODE_ENV !== 'production';

let Sentry = getSentry();
let tracer = trace.getTracer('lowerdeck.rpc-server');

let validation = v.object({
  calls: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      payload: v.any()
    })
  )
});

let summarizeRpcTarget = (url: URL, body: any) => {
  let pathParts = url.pathname.split('/').filter(Boolean);
  let lastPart = pathParts[pathParts.length - 1] ?? '';

  if (lastPart.startsWith('$') && lastPart.length > 1) {
    return lastPart.slice(1);
  }

  let callNames: string[] = [];
  if (body && typeof body == 'object' && Array.isArray(body.calls)) {
    callNames = body.calls
      .map((call: { name?: unknown }) =>
        typeof call?.name == 'string' ? call.name.trim() : ''
      )
      .filter(Boolean);
  }

  if (callNames.length == 1) return callNames[0];

  if (callNames.length > 1) {
    let preview = callNames.slice(0, 3).join(', ');
    if (callNames.length > 3) return `${preview}, +${callNames.length - 3} more`;
    return preview;
  }

  return url.pathname;
};

export let rpcMux = (
  opts: {
    path: string;
    allowRootSpan?: boolean;
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
            'access-control-allow-headers': `Content-Type, Authorization, Baggage, Sentry-Trace, traceparent, tracestate${
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

      let contentType = req.headers.get('content-type') ?? '';
      if (
        !contentType.includes('application/rpc+json') &&
        !contentType.includes('application/json')
      ) {
        return new Response(
          JSON.stringify(
            notAcceptableError({
              message: 'Content-Type must be application/rpc+json'
            }).toResponse()
          ),
          { status: 406, headers: corsHeaders }
        );
      }

      let body: any = null;

      try {
        body = serialize.decode(await req.text());
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
        req.headers.get('lowerdeck-connecting-ip') ??
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

      let extractedTraceContext = propagation.extract(otelContext.active(), req.headers, {
        get: (carrier, key) => carrier.get(key) ?? undefined,
        keys: carrier => Array.from(carrier.keys())
      });

      let incomingParent = trace.getSpanContext(extractedTraceContext);
      let canTrace = isTelemetryEnabled() && (!!incomingParent || !!opts.allowRootSpan);
      let requestSpanTarget = summarizeRpcTarget(url, body);
      let requestSpanName = `rpc request: ${requestSpanTarget}`;
      let requestSpanOp = 'rpc.server.request';

      let executeRequest = async () =>
        await Sentry.withIsolationScope(
          async () =>
            await Sentry.continueTrace(
              { sentryTrace, baggage },
              async () =>
                await Sentry.startSpan(
                  {
                    name: requestSpanName,
                    op: requestSpanOp,
                    attributes: {
                      'sentry.op': requestSpanOp,
                      'rpc.request.target': requestSpanTarget,
                      'rpc.description': requestSpanName,
                      'sentry.description': requestSpanName,
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

                      return provideExecutionContext(
                        createExecutionContext({
                          type: 'request',
                          contextId: id,
                          ip: ip ?? '0.0.0.0',
                          userAgent: req.headers.get('user-agent') ?? ''
                        }),
                        async () => {
                          let callsByRpc = new Map<
                            number,
                            { id: string; name: string; payload: any }[]
                          >();

                          let resRef = {
                            body: {
                              __typename: 'rpc.response',
                              calls: [] as any[]
                            },
                            status: 200
                          };

                          let pathParts = url.pathname.split('/').filter(Boolean);
                          let lastPart = pathParts[pathParts.length - 1];

                          let isSingle = lastPart[0] == '$';

                          if (isSingle) {
                            let id = lastPart.slice(1);
                            let rpcIndex = handlerNameToRpcMap.get(id);
                            if (rpcIndex == undefined) {
                              return new Response(
                                JSON.stringify(
                                  notFoundError({ entity: 'handler' }).toResponse()
                                ),
                                { status: 404, headers }
                              );
                            }

                            let calls = callsByRpc.get(rpcIndex) ?? [];
                            calls.push({
                              id: generateCustomId('call_'),
                              name: id,
                              payload: body
                            });
                            callsByRpc.set(rpcIndex, calls);
                          } else {
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

                            for (let call of valRes.value.calls) {
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
                              calls.push(call as any);
                              callsByRpc.set(rpcIndex, calls);
                            }
                          }

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
                          headers.append('x-powered-by', 'lowerdeck RPC');

                          await Promise.all(beforeSends.map(s => s()));

                          return new Response(
                            serialize.encode(
                              isSingle ? resRef.body.calls[0].result : resRef.body
                            ),
                            {
                              status: resRef.status,
                              headers
                            }
                          );
                        }
                      );
                    } catch (e) {
                      if (verbose) console.error(e);

                      Sentry.captureException(e, {
                        extra: { url: req.url, method: req.method, ip, body }
                      });

                      return new Response(
                        JSON.stringify(
                          internalServerError({
                            inner: verbose
                              ? e instanceof Error
                                ? { message: e.message, stack: e.stack }
                                : { error: e }
                              : undefined
                          }).toResponse()
                        ),
                        {
                          status: 500,
                          headers
                        }
                      );
                    }
                  }
                )
            )
        );

      return await otelContext.with(extractedTraceContext, async () => {
        if (!canTrace) {
          return await executeRequest();
        }

        return await tracer.startActiveSpan(
          requestSpanName,
          {
            kind: SpanKind.SERVER,
            attributes: {
              'sentry.op': requestSpanOp,
              'rpc.system': 'lowerdeck',
              'rpc.request.target': requestSpanTarget,
              'rpc.description': requestSpanName,
              'sentry.description': requestSpanName,
              'http.request.method': req.method,
              'url.path': url.pathname,
              ip: ip ?? '',
              transport: 'http',
              ua: req.headers.get('user-agent') ?? '',
              origin: req.headers.get('origin') ?? ''
            }
          },
          async span => {
            try {
              let response = await executeRequest();

              span.setAttribute('http.response.status_code', response.status);
              if (response.status >= 500) {
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: `RPC request failed with status ${response.status}`
                });
              }

              return response;
            } catch (error) {
              span.recordException(error as Error);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error)
              });
              throw error;
            } finally {
              span.end();
            }
          }
        );
      });
    }
  };
};
