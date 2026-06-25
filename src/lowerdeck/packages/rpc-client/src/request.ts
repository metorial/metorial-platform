import { canonicalize } from '@lowerdeck/canonicalize';
import { internalServerError, isServiceError, ServiceError } from '@lowerdeck/error';
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

let runCalls = (
  call: Call,
  c: {
    call: Call;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }[]
) => {
  let url = new URL(call.endpoint);
  url.search = new URLSearchParams(call.query).toString();

  fetch(url.toString(), {
    method: 'POST',

    headers: {
      'Content-Type': 'application/rpc+json',
      ...c[0]!.call.headers
    },
    body: serialize.encode({
      calls: c
        .map(x => ({
          id: x.call.id,
          name: x.call.name,
          payload: x.call.payload
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    }),
    credentials: 'include',

    // @ts-ignore
    keepalive: false
  })
    .then(async res => ({
      res: serialize.decode(
        (await res.json()) as {
          calls: {
            id: string;
            status: number;
            result: any;
          }[];
        }
      ),

      headers: res.headers
    }))
    .then(({ res, headers }) => {
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

      c.forEach(x =>
        x.reject(
          new ServiceError(
            internalServerError({
              message:
                typeof (globalThis as any).window != 'undefined'
                  ? 'Unable to reach server'
                  : `Unable to reach server ${call.endpoint}`,

              inner: verbose
                ? e instanceof Error
                  ? { message: e.message, stack: e.stack }
                  : { error: e }
                : undefined
            })
          )
        )
      );
    });
};

let performRequest = (call: Call) => {
  if (isServer) {
    return new Promise((resolve, reject) => {
      runCalls(call, [{ call, resolve, reject }]);
    });
  }

  let key = `${canonicalize(call.headers)}${canonicalize(call.query)}${call.endpoint}`;

  if (!calls[key]) calls[key] = { calls: [], to: null };
  let current = calls[key]!;

  let promise = new Promise((resolve, reject) => {
    current.calls.push({ call, resolve, reject });
  });

  if (current.to) clearTimeout(current.to);

  current.to = setTimeout(
    () => {
      let c = calls[key]!.calls;
      calls[key]!.calls = [];
      calls[key]!.to = null;

      runCalls(call, c);
    },
    10
  );

  return promise;
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

  while (tries < maxTries) {
    try {
      return (await performRequest({
        ...(call as any),
        id
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

      if (isServiceError(e)) {
        // 400 errors are not retried
        if (e.data.status < 500) throw e;
      }
    }

    tries += 1;
    await new Promise(r => setTimeout(r, tries * retryDelay));
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
