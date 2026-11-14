import { request } from './request';
import type { ClientRequestOpts } from './shared/clientBuilder';
import { clientBuilder } from './shared/clientBuilder';

export type { ClientOpts, ClientRequestOpts, HeadersProvider } from './shared/clientBuilder';
export { projectedTokenHeaders } from './projectedToken';
export { getRpcRequestDiagnostics } from './request';

export type RpcMethod<I, O> = ((input: I, opts?: ClientRequestOpts) => Promise<O>) & {
  getFull: (
    input: I,
    opts?: ClientRequestOpts
  ) => Promise<{ data: O; status: number; headers: Record<string, string> }>;
};

export let createClient = clientBuilder(request);
