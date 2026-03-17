import { proxy } from '@lowerdeck/proxy';
import { Requester } from './requester';

export interface ClientOpts {
  endpoint: string;
  referrerPolicy?: RequestInit['referrerPolicy'];
  headers?: Record<string, string | undefined>;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  getBatchKey?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
    context: any;
  }) => string | null | undefined;
  onRequest?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
  }) => any;
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
          let name = path[path.length - 1] == 'getFull' ? path.slice(0, -1).join(':') : path.join(':');
          let headers = {
            ...clientOpts.headers,
            ...(await clientOpts.getHeaders?.()),
            ...requestOpts?.headers
          };

          clientOpts.onRequest?.({
            endpoint: clientOpts.endpoint,
            name,
            payload: data,
            headers,
            query: requestOpts?.query
          });

          let response = await request({
            endpoint: clientOpts.endpoint,
            payload: data,
            name,
            headers,
            query: requestOpts?.query,
            referrerPolicy: clientOpts.referrerPolicy,
            batchKey:
              clientOpts.getBatchKey?.({
                endpoint: clientOpts.endpoint,
                name,
                payload: data,
                headers,
                query: requestOpts?.query,
                context
              }) ?? undefined,
            context
          });

          if (path[path.length - 1] == 'getFull') {
            return response;
          }

          return response.data;
        })
    );
