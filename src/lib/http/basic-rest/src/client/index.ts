import { proxy } from '@lowerdeck/proxy';
import { request } from './request';

export * from '@lowerdeck/error';
export * from './proxy';
export * from './request';

export let createEntityClient = <Client extends object>(
  opts: {
    endpoint: string;
    headers?: Record<string, string | undefined>;
    getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  }
): Client => {
  return proxy<Client>(
    async (
      path,
      payload,
      requestOpts?: {
        headers?: Record<string, string | undefined>;
        query?: Record<string, string | undefined>;
      }
    ) => {
      let headers = {
        ...opts.headers,
        ...(await opts.getHeaders?.()),
        ...requestOpts?.headers
      };

      return (
        await request({
          endpoint: opts.endpoint,
          path,
          payload,
          headers,
          query: requestOpts?.query
        })
      ).data;
    }
  );
};
