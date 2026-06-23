import { createClient } from '@lowerdeck/rpc-client';
import { rpcMux } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { CargoRPC, type CargoClient } from '../controllers';

type ClientOptsLike = {
  endpoint: string;
  headers?: Record<string, string | undefined>;
  getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  onRequest?: (d: {
    endpoint: string;
    name: string;
    payload: any;
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
  }) => any;
};

let fetchRouter = createFetchRouter();
let cargoRpc = rpcMux({ path: '/metorial-cargo' }, [CargoRPC]);

let registerInMemoryRoute = (endpoint: string) => {
  fetchRouter.registerRoute(endpoint, request => cargoRpc.fetch(request));
};

let defaultEndpoint = 'http://cargo.test/metorial-cargo';

export let createTestCargoClient = (opts: Partial<ClientOptsLike> = {}) => {
  let endpoint = opts.endpoint ?? defaultEndpoint;
  registerInMemoryRoute(endpoint);
  fetchRouter.install();

  return createClient<CargoClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let cargoClient = createTestCargoClient();
export type CargoTestClient = ReturnType<typeof createTestCargoClient>;
