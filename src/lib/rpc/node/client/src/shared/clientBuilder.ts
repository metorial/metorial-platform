import { isServiceError } from '@lowerdeck/error';
import { proxy } from '@lowerdeck/proxy';
import { getSentry } from '@lowerdeck/sentry';
import type { Ed25519SignatureCredentials } from '@lowerdeck/rpc-signature';
import { context as otelContext, propagation, trace } from '@opentelemetry/api';
import type { Requester } from './requester';

export type SignatureTokenResult =
  | string
  | {
      secret: string;
      headers?: Record<string, string>;
    };

// Returning true from onUnauthorized (or from getHeaders.onUnauthorized, which
// projectedTokenHeaders provides) retries a call that failed with 401 once, with fresh headers.
export type HeadersProvider = (() =>
  Promise<Record<string, string>> | Record<string, string>) & {
  onUnauthorized?: () => Promise<boolean> | boolean;
};

export interface ClientOpts {
  endpoint: string;
  referrerPolicy?: RequestInit['referrerPolicy'];
  disableBatching?: boolean;
  useDirectMethodRoute?: boolean;
  timeoutMs?: number;
  captureErrors?: boolean;
  logResponses?: boolean;
  retry?: boolean;
  nonIdempotentMethods?: readonly string[];
  headers?: Record<string, string | undefined>;
  getHeaders?: HeadersProvider;
  onUnauthorized?: () => Promise<boolean> | boolean;
  getSignatureToken?: () => Promise<SignatureTokenResult> | SignatureTokenResult;
  getSignatureCredentials?: () =>
    Promise<Ed25519SignatureCredentials> | Ed25519SignatureCredentials;
  onRequest?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
  }) => any;
}

export interface ClientRequestOpts {
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  disableBatching?: boolean;
  timeoutMs?: number;
  captureErrors?: boolean;
  logResponses?: boolean;
  retry?: boolean;
  signal?: AbortSignal;
}

let noopWithContext = (cb: (ctx: any) => any) => cb({});

let isTelemetryEnabled = () =>
  typeof process !== 'undefined' && process.env?.['OTEL_ENABLED'] === 'true';

let hasActiveSpan = () => !!trace.getSpan(otelContext.active());

let injectTraceHeaders = (headers: Record<string, string | undefined>) => {
  let carrier: Record<string, string> = { ...getSentry().getTraceData?.() };

  try {
    if (isTelemetryEnabled() && hasActiveSpan())
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
    (() => {
      if (clientOpts.getSignatureToken && clientOpts.getSignatureCredentials)
        throw new Error('Choose one RPC signature provider');
      return proxy<T>(
        async (path, data, requestOpts?: ClientRequestOpts) =>
          await withContext(async context => {
            let disableBatching = requestOpts?.disableBatching ?? clientOpts.disableBatching;
            let useDirectMethodRoute = clientOpts.useDirectMethodRoute ?? false;
            let timeoutMs = requestOpts?.timeoutMs ?? clientOpts.timeoutMs;
            let captureErrors = requestOpts?.captureErrors ?? clientOpts.captureErrors;
            let logResponses = requestOpts?.logResponses ?? clientOpts.logResponses;
            let isFull = path[path.length - 1] == 'getFull';
            let name = (isFull ? path.slice(0, -1) : path).join(':');
            let retry = clientOpts.nonIdempotentMethods?.includes(name)
              ? false
              : (requestOpts?.retry ?? clientOpts.retry);
            let signal = requestOpts?.signal;
            let onUnauthorized =
              clientOpts.onUnauthorized ?? clientOpts.getHeaders?.onUnauthorized;

            let send = async () => {
              let signature = clientOpts.getSignatureCredentials
                ? await clientOpts.getSignatureCredentials()
                : await clientOpts.getSignatureToken?.();

              let headers = {
                ...clientOpts.headers,
                ...(await clientOpts.getHeaders?.()),
                ...(typeof signature == 'object' && 'headers' in signature
                  ? signature.headers
                  : undefined),
                ...requestOpts?.headers
              };

              headers = injectTraceHeaders(headers);

              clientOpts.onRequest?.({
                endpoint: clientOpts.endpoint,
                name,
                payload: data,
                headers,
                query: requestOpts?.query
              });

              return await request({
                endpoint: clientOpts.endpoint,
                payload: data,
                name,
                headers,
                signature:
                  typeof signature == 'string'
                    ? signature
                    : signature && { ...signature, headers: undefined },
                query: requestOpts?.query,
                referrerPolicy: clientOpts.referrerPolicy,
                disableBatching,
                useDirectMethodRoute,
                timeoutMs,
                captureErrors,
                logResponses,
                retry,
                signal,
                context
              });
            };

            let sendOnce = async () => {
              try {
                return await send();
              } catch (error) {
                let unauthorized = isServiceError(error) && error.data.status == 401;
                if (!unauthorized || !onUnauthorized || !(await onUnauthorized())) throw error;
                return await send();
              }
            };

            let response = await sendOnce();
            return isFull ? response : response.data;
          })
      );
    })();
