import { proxy } from '@metorial/proxy';
import { Requester } from './requester';

export interface ClientOpts {
  endpoint: string;
  headers?: Record<string, string | undefined>;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
}

let noopWithContext = (cb: (ctx: any) => any) => cb({});

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
