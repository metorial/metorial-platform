import { context as otelContext, propagation, trace } from '@opentelemetry/api';
import { proxy } from '@lowerdeck/proxy';
import { Requester } from './requester';

export interface ClientOpts {
  endpoint: string;
  headers?: Record<string, string | undefined>;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  onRequest?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
  }) => any;
}

let noopWithContext = (cb: (ctx: any) => any) => cb({});

let isTelemetryEnabled = () =>
  typeof process !== 'undefined' && process.env?.['OTEL_ENABLED'] === 'true';

let hasActiveSpan = () => !!trace.getSpan(otelContext.active());

let injectTraceHeaders = (headers: Record<string, string | undefined>) => {
  if (!isTelemetryEnabled()) return headers;
  if (!hasActiveSpan()) return headers;

  let carrier: Record<string, string> = {};

  try {
    propagation.inject(otelContext.active(), carrier);
  } catch {
    return headers;
  }

  if (!Object.keys(carrier).length) return headers;

  let existingHeaderNames = new Set(Object.keys(headers).map(h => h.toLowerCase()));

  for (let [name, value] of Object.entries(carrier)) {
    if (!existingHeaderNames.has(name.toLowerCase())) {
      headers[name] = value;
    }
  }

  return headers;
};

export let clientBuilder =
  (request: Requester, withContext: (cb: (ctx: any) => any) => any = noopWithContext) =>
  <T extends object>(clientOpts: ClientOpts) =>
    proxy<T>(
      async (
        path,
        data,
        requestOpts?: {
          headers?: Record<string, string | undefined>;
          query?: Record<string, string | undefined>;
        }
      ) =>
        await withContext(async context => {
          let headers = {
            ...clientOpts.headers,
            ...(await clientOpts.getHeaders?.()),
            ...requestOpts?.headers
          };

          headers = injectTraceHeaders(headers);

          clientOpts.onRequest?.({
            endpoint: clientOpts.endpoint,
            name: path.join(':'),
            payload: data,
            headers,
            query: requestOpts?.query
          });

          if (path[path.length - 1] == 'getFull') {
            return await request({
              endpoint: clientOpts.endpoint,
              payload: data,
              name: path.slice(0, -1).join(':'),
              headers,
              query: requestOpts?.query,
              context
            });
          }

          return (
            await request({
              endpoint: clientOpts.endpoint,
              payload: data,
              name: path.join(':'),
              headers,
              query: requestOpts?.query,
              context
            })
          ).data;
        })
    );
