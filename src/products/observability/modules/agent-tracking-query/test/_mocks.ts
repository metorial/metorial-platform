import * as clientFamilies from '@metorial/module-agent-tracking-sync/src/definitions/clientFamilies';
import { vi } from 'vitest';

type Handler = (input: any, opts: any) => unknown;

export let rpc = {
  calls: [] as { path: string; input: any; opts: any }[],
  handlers: {} as Record<string, Handler>
};

// Same trap as the real RPC client: every property, `then` included, is a callable path.
let rpcProxy = (path: string[]): any =>
  new Proxy(() => {}, {
    get: (_, prop) => rpcProxy([...path, String(prop)]),
    apply: (_, __, [input, opts]) => {
      let name = path.join(':');
      rpc.calls.push({ path: name, input, opts });

      let handler = rpc.handlers[name];
      if (!handler) return new Promise(() => {});

      return Promise.resolve().then(() => handler(input, opts));
    }
  });

export let client = rpcProxy([]);

export let cache = {
  store: new Map<string, { value: unknown; expiresAt: number }>(),
  options: [] as { name: string; ttlSeconds: number }[],
  failing: false
};

export let cacheModule = {
  createCachedFunction: (opts: any) => {
    cache.options.push({ name: opts.name, ttlSeconds: opts.ttlSeconds });

    return async (input: any) => {
      if (cache.failing) throw new Error('Redis connection refused');

      let hash = opts.getHash(input);
      let hit = cache.store.get(hash);
      if (hit && hit.expiresAt > Date.now()) return hit.value;

      let ttl = opts.ttlSeconds;
      let value = await opts.provider(input, { setTTL: (next: number) => (ttl = next) });
      cache.store.set(hash, { value, expiresAt: Date.now() + ttl * 1000 });

      return value;
    };
  }
};

export let withInstanceScope = vi.fn(
  async (_d: any, run: () => Promise<unknown>) => await run()
);

export let privacy = { hideIndividuals: false, minGroupUsers: 5 };

export let syncModule = {
  ...clientFamilies,
  consumerEntitySource: 'metorial.consumer',
  requireAgentTracking: () => client,
  withInstanceScope,
  agentTrackingSettingsService: { getPrivacy: async () => ({ ...privacy }) }
};

export let consumers = { findMany: vi.fn(async (_query: any): Promise<any[]> => []) };

export let dbModule = { db: { consumer: consumers } };

export let scope = {
  organization: { oid: 1n, id: 'org_1', name: 'Acme' },
  project: { oid: 2n, id: 'proj_1', name: 'Production' },
  instance: { oid: 3n, id: 'inst_1', name: 'Default' }
};

export let remoteMember = (overrides: Record<string, unknown> = {}) => ({
  object: 'agent_tracking#entity',
  id: 'aten_ada',
  kind: 'user',
  status: 'managed',
  source: 'metorial.consumer',
  ref: 'con_ada',
  slug: null,
  name: 'Ada',
  attributes: {},
  needsReview: false,
  mergedIntoId: null,
  scope: { projectId: null, instanceId: null },
  identifiers: [{ type: 'email', value: 'ada@example.com', createdAt: new Date() }],
  firstSeenAt: new Date('2026-11-01T00:00:00Z'),
  lastSeenAt: new Date('2026-11-17T10:00:00Z'),
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export let resetMocks = () => {
  rpc.calls.length = 0;
  rpc.handlers = {};
  cache.store.clear();
  cache.failing = false;
  consumers.findMany.mockReset();
  consumers.findMany.mockImplementation(async () => []);
  withInstanceScope.mockClear();
  privacy.hideIndividuals = false;
  privacy.minGroupUsers = 5;
};

export let callsTo = (path: string) => rpc.calls.filter(call => call.path == path);

export let settles = async (promise: Promise<unknown>) =>
  await Promise.race([
    promise.then(
      () => 'settled',
      () => 'settled'
    ),
    new Promise(resolve => setTimeout(() => resolve('pending'), 1000))
  ]);
