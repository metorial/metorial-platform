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

export let rpcPingMethod = 'rpc:ping';

// Every lowerdeck RPC server (Node and Go) answers rpc:ping, so any client built with
// createClient can call it; generated client types don't list it.
export let pingRpc = (client: object, opts?: ClientRequestOpts) =>
  (client as { rpc: { ping: RpcMethod<{}, { ok: true }> } }).rpc.ping({}, opts);
