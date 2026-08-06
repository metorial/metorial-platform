import { canonicalize } from '@lowerdeck/canonicalize';
import {
  internalServerError,
  isServiceError,
  ServiceError,
  timeoutError
} from '@lowerdeck/error';
import { createRpcSignatureHeader, rpcSignatureHeader } from '@lowerdeck/rpc-signature';
import { serialize } from '@lowerdeck/serialize';
import { generateRequestId } from './shared/requester';
import type { Call, Requester } from './shared/requester';

// @ts-ignore
let isServer = typeof (globalThis as any).window === 'undefined';

let verbose =
  typeof (globalThis as any).window != 'undefined' ||
  (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production');

let log = (...args: any[]) => {
  if (!isServer) console.log(...args);
};

let calls: {
  [key: string]: {
    calls: {
      call: Call;
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }[];
    to: any;
  };
} = {};

let decodeResponseBody = (body: string) => {
  let parsed = JSON.parse(body);

  if (
    parsed &&
    typeof parsed == 'object' &&
    Object.keys(parsed).length == 1 &&
    typeof parsed.$$TYPES$$ == 'object' &&
    parsed.$$TYPES$$?.__mode == 'object'
  ) {
    return null;
  }

  return serialize.decode(parsed);
};

class InvalidRpcResponseError extends Error {
  constructor(cause: unknown) {
    super('Invalid RPC response', { cause });
    this.name = 'InvalidRpcResponseError';
  }
}

let decodeRpcResponse = (body: string) => {
  try {
    return decodeResponseBody(body);
  } catch (error) {
    throw new InvalidRpcResponseError(error);
  }
};

let toRequestError = (call: Call, error: unknown) => {
  if (
    (error instanceof Error && error.name === 'AbortError') ||
    (call.signal && call.signal.aborted)
  ) {
    return new ServiceError(
      timeoutError({ message: `Request timed out: ${call.name} on ${call.endpoint}` })
    );
  }

  let message =
    error instanceof InvalidRpcResponseError
      ? `Invalid response from server ${call.endpoint} for ${call.name}`
      : `Unable to reach server ${call.endpoint} for ${call.name}`;

  return new ServiceError(
    internalServerError({
      message,
      inner:
        verbose && error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : undefined
    })
  );
};

let createBatchUrl = (call: Call) => {
  let url = new URL(call.endpoint);
  url.search = new URLSearchParams(call.query).toString();
  return url;
};

let createSingleUrl = (call: Call) => {
  let url = createBatchUrl(call);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.pathname += call.name.replace(/:/g, '.');
  return url;
};

let createBatchBody = (
  c: {
    call: Call;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }[]
) =>
  serialize.encode({
    calls: c
      .map(x => ({
        id: x.call.id,
        name: x.call.name,
        payload: x.call.payload
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  });

let runCalls = async (
  call: Call,
  c: {
    call: Call;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }[]
) => {
  let isSingle = c.length == 1 && c[0]!.call.useDirectMethodRoute;
  let url = isSingle ? createSingleUrl(c[0]!.call) : createBatchUrl(call);
  let body = isSingle ? serialize.encode(c[0]!.call.payload) : createBatchBody(c);

  let headers: Record<string, string> = {
    'Content-Type': 'application/rpc+json',
    ...c[0]!.call.headers
  };

  if (call.signature) {
    headers[rpcSignatureHeader] = await createRpcSignatureHeader({
      token: typeof call.signature == 'string' ? call.signature : call.signature.secret,
      timestamp: Date.now(),
      method: 'POST',
      url,
      body
    });
  }

  fetch(url.toString(), {
    method: 'POST',
    headers,
    body,
    credentials: 'include',
    referrerPolicy: c[0]!.call.referrerPolicy,
    signal: c[0]!.call.signal,

    // @ts-ignore
    keepalive: false
  })
    .then(async res => ({
      res: decodeRpcResponse(await res.text()),
      headers: res.headers,
      status: res.status
    }))
    .then(({ res, headers, status }) => {
      if (isSingle) {
        if (status >= 200 && status < 300) {
          c[0]!.resolve({
            data: res,
            status,
            headers
          });
          return;
        }

        c[0]!.reject(ServiceError.fromResponse(res));
        return;
      }

      if (res.__typename == 'error') {
        let err = ServiceError.fromResponse(res);
        c.forEach(x => x.reject(err));
        return;
      }

      for (let call of c) {
        let callRes = res.calls.find((x: any) => x.id == call.call.id);
        if (!callRes) {
          let err = new ServiceError(internalServerError({ message: 'Call not returned' }));
          call.reject(err);
          return;
        }

        if (callRes.status >= 200 && callRes.status < 300) {
          call.resolve({
            data: callRes.result,
            status: callRes.status,
            headers
          });
          continue;
        }

        let err = ServiceError.fromResponse(callRes.result);
        call.reject(err);
      }
    })
    .catch(e => {
      if (verbose) {
        console.error(e);
      }

      c.forEach(x => x.reject(toRequestError(x.call, e)));
    });
};

let performRequest = (call: Call) => {
  if (call.disableBatching || call.signal) {
    return new Promise((resolve, reject) => {
      runCalls(call, [{ call, resolve, reject }]).catch(reject);
    });
  }

  if (isServer) {
    return new Promise((resolve, reject) => {
      runCalls(call, [{ call, resolve, reject }]).catch(reject);
    });
  }

  let key = `${canonicalize(call.headers)}${canonicalize(call.query)}${call.endpoint}${canonicalize(call.referrerPolicy ?? null)}`;

  if (!calls[key]) calls[key] = { calls: [], to: null };
  let current = calls[key]!;

  let promise = new Promise((resolve, reject) => {
    current.calls.push({ call, resolve, reject });
  });

  if (current.to) clearTimeout(current.to);

  current.to = setTimeout(() => {
    let c = calls[key]!.calls;
    calls[key]!.calls = [];
    calls[key]!.to = null;

    runCalls(call, c).catch(e => c.forEach(x => x.reject(e)));
  }, 10);

  return promise;
};

let abortedError = (call: { name: string; endpoint: string }) =>
  new ServiceError(
    timeoutError({
      message:
        typeof (globalThis as any).window != 'undefined'
          ? `Request timed out: ${call.name}`
          : `Request timed out: ${call.name} on ${call.endpoint}`
    })
  );

let abortableDelay = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    if (signal.aborted) return resolve();

    let onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    let timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });

let createDeadlineSignal = (call: { timeoutMs?: number; signal?: AbortSignal }) => {
  if (call.timeoutMs == null && !call.signal) return { signal: undefined, release: () => {} };

  let controller = new AbortController();
  let onExternalAbort = () => controller.abort();
  let timer =
    call.timeoutMs == null ? null : setTimeout(() => controller.abort(), call.timeoutMs);

  if (call.signal) {
    if (call.signal.aborted) controller.abort();
    else call.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    release: () => {
      if (timer) clearTimeout(timer);
      call.signal?.removeEventListener('abort', onExternalAbort);
    }
  };
};

let requesterInternal: Requester = async call => {
  let id = generateRequestId();
  log(`[call:${call.name.replace(':', '-')}:${id}] Queued`, call);

  let tries = 0;
  let error: Error | null = null;

  for (let header in call.headers) {
    if (call.headers[header] === undefined) delete call.headers[header];
  }

  if (call.query) {
    for (let query in call.query) {
      if (call.query[query] === undefined) delete call.query[query];
    }
  }

  let maxTries = typeof (globalThis as any).window === 'undefined' ? 6 : 3;
  let retryDelay = typeof (globalThis as any).window === 'undefined' ? 20 : 1000;

  let deadline = createDeadlineSignal(call);

  try {
    while (tries < maxTries) {
      if (deadline.signal?.aborted) throw error ?? abortedError(call);

      try {
        return (await performRequest({
          ...(call as any),
          id,
          signal: deadline.signal
        }).then(
          res => {
            if (!isServer) {
              log(`[call:${call.name.replace(':', '-')}:${id}] Success`, res);
            }

            return res;
          },
          err => {
            if (isServer) {
              log(`[call:${call.name.replace(':', '-')}:${id}] Queued`, call);
            }

            log(`[call:${call.name.replace(':', '-')}:${id}] Error`, err);

            throw err;
          }
        )) as any;
      } catch (e: any) {
        error = e;

        if (deadline.signal?.aborted) throw abortedError(call);

        if (isServiceError(e)) {
          // 400 errors are not retried
          if (e.data.status < 500) throw e;
        }
      }

      tries += 1;
      if (deadline.signal) {
        await abortableDelay(tries * retryDelay, deadline.signal);
        if (deadline.signal.aborted) throw abortedError(call);
      } else {
        await new Promise(r => setTimeout(r, tries * retryDelay));
      }
    }
  } finally {
    deadline.release();
  }

  if (error) throw error;

  throw new ServiceError(
    internalServerError({
      message:
        typeof (globalThis as any).window != 'undefined'
          ? 'Unable to reach server'
          : `Unable to reach server ${call.endpoint}`
    })
  );
};

export let request: Requester = async call => {
  // try {
  return await requesterInternal(call);
  // } catch (e: any) {
  //   Sentry.captureException(e);
  //   throw e;
  // }
};
