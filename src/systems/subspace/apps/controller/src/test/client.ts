import { createClient } from '@lowerdeck/rpc-client';
import { createServer, type InferClient, rpcMux } from '@lowerdeck/rpc-server';
import { createFetchRouter } from '@lowerdeck/testing-tools';
import { appWithoutSolution } from '../controllers/_app';
import { type rootController, subspaceControllerRPC } from '../controllers';
import { solutionController } from '../controllers/solution';
import { tenantController } from '../controllers/tenant';

let testRootController = appWithoutSolution.controller({
  solution: solutionController,
  tenant: tenantController
});

let testRpc = rpcMux(
  { path: '/subspace-controller' },
  [createServer({})(testRootController)]
);
let fullTestRpc = rpcMux({ path: '/subspace-controller' }, [subspaceControllerRPC]);

type ClientOptsLike = Parameters<typeof createClient>[0];
type RouteOwner = 'partial' | 'root';
type RpcLike = { fetch: (request: Request) => Promise<Response> | Response };

let fetchRouter = createFetchRouter();
fetchRouter.install();

let registeredEndpoints = new Map<string, RouteOwner>();

let registerInMemoryRoute = (endpoint: string, owner: RouteOwner, rpc: RpcLike) => {
  let existingOwner = registeredEndpoints.get(endpoint);
  if (existingOwner) {
    if (existingOwner === owner) return;

    throw new Error(
      `Test endpoint "${endpoint}" is already registered for "${existingOwner}" client`
    );
  }

  fetchRouter.registerRoute(endpoint, request => rpc.fetch(request));
  registeredEndpoints.set(endpoint, owner);
};

let defaultEndpoint = 'http://subspace-controller.test/subspace-controller';
let defaultRootEndpoint = 'http://subspace-controller-root.test/subspace-controller';

let createTestClient = <TClient extends object>(
  opts: Partial<ClientOptsLike>,
  config: {
    defaultEndpoint: string;
    owner: RouteOwner;
    rpc: RpcLike;
  }
) => {
  let endpoint = opts.endpoint ?? config.defaultEndpoint;
  registerInMemoryRoute(endpoint, config.owner, config.rpc);

  return createClient<TClient>({
    ...opts,
    endpoint
  } as ClientOptsLike);
};

export let createSubspaceControllerTestClient = (opts: Partial<ClientOptsLike> = {}) =>
  createTestClient<SubspaceControllerTestClient>(opts, {
    defaultEndpoint,
    owner: 'partial',
    rpc: testRpc
  });

export type SubspaceControllerTestClient = InferClient<typeof testRootController>;

export let createSubspaceControllerRootTestClient = (opts: Partial<ClientOptsLike> = {}) =>
  createTestClient<SubspaceControllerRootTestClient>(opts, {
    defaultEndpoint: defaultRootEndpoint,
    owner: 'root',
    rpc: fullTestRpc
  });

export type SubspaceControllerRootTestClient = InferClient<typeof rootController>;
