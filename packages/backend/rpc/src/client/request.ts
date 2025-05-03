import { canonicalize } from '@metorial/canonicalize';
import { internalServerError, isServiceError, ServiceError } from '@metorial/error';
import { getSentry } from '@metorial/sentry';
import { serialize } from '@metorial/serialize';
import { Call, generateRequestId, Requester } from './shared/requester';

let Sentry = getSentry();

// @ts-ignore
let isServer = typeof window === 'undefined';

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

let performRequest = (call: Call) => {
  let key = `${canonicalize(call.headers)}${canonicalize(call.query)}${call.endpoint}`;

  if (!calls[key]) calls[key] = { calls: [], to: null };
  let current = calls[key];

  let promise = new Promise((resolve, reject) => {
    current.calls.push({ call, resolve, reject });
  });

  if (current.to) clearTimeout(current.to);

  current.to = setTimeout(
    () => {
      let c = calls[key].calls;
      calls[key].calls = [];
      calls[key].to = null;

      let url = new URL(call.endpoint);
      url.search = new URLSearchParams(call.query).toString();

      fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...c[0].call.headers
        },
        body: JSON.stringify({
          calls: c
            .map(x => ({
              id: x.call.id,
              name: x.call.name,
              payload: x.call.payload
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        }),
        credentials: 'include'
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
              let err = new ServiceError(
                internalServerError({ message: 'Call not returned' })
              );
              call.reject(err);
              return;
            }

            if (callRes.status >= 200 && callRes.status < 300) {
              call.resolve({
                // data: O;
                // status: number;
                // headers: Record<string, string>;

                data: callRes.result,
                status: callRes.status,
                headers
              });
            }

            let err = ServiceError.fromResponse(callRes.result);
            call.reject(err);
          }
        })
        .catch(e => {
          c.forEach(x =>
            x.reject(
              new ServiceError(internalServerError({ message: 'Unable to reach server' }))
            )
          );
        });
    },
    isServer ? 0 : 10
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

  while (tries < 3) {
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
    await new Promise(r => setTimeout(r, tries * 1000));
  }

  if (error) throw error;

  throw new ServiceError(internalServerError({ message: 'Unable to reach server' }));
};

export let request: Requester = async call => {
  // try {
  return await requesterInternal(call);
  // } catch (e: any) {
  //   Sentry.captureException(e);
  //   throw e;
  // }
};
