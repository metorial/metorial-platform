import { proxy } from '@lowerdeck/proxy';
import { Requester } from './requester';

export interface ClientOpts {
  endpoint: string;
  referrerPolicy?: RequestInit['referrerPolicy'];
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

export interface ClientRequestOpts {
  headers?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  disableBatching?: boolean;
}

let noopWithContext = (cb: (ctx: any) => any) => cb({});

export let clientBuilder =
  (request: Requester, withContext: (cb: (ctx: any) => any) => any = noopWithContext) =>
  <T extends object>(clientOpts: ClientOpts) =>
    proxy<T>(
      async (path, data, requestOpts?: ClientRequestOpts) =>
        await withContext(async context => {
          let headers = {
            ...clientOpts.headers,
            ...(await clientOpts.getHeaders?.()),
            ...requestOpts?.headers
          };

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
              referrerPolicy: clientOpts.referrerPolicy,
              disableBatching: requestOpts?.disableBatching,
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
              referrerPolicy: clientOpts.referrerPolicy,
              disableBatching: requestOpts?.disableBatching,
              context
            })
          ).data;
        })
    );
