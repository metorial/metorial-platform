import { isServiceError, notFoundError, ServiceError } from '@lowerdeck/error';
import * as clientFamilies from '@metorial/module-agent-tracking-sync/src/definitions/clientFamilies';
import type { Instance } from '@metorial/db';
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

export let desktop = { toolDetails: false, sessionTitles: false };

export let links = { ticketUrlTemplate: null as string | null };

export let agentTrackingEnabled = vi.fn(async (_d: any) => true);

export let syncModule = {
  ...clientFamilies,
  consumerEntitySource: 'metorial.consumer',
  deviceEntitySource: 'metorial.device',
  ticketUrlTemplateKey: '{key}',
  ignoreNotFound: async <T>(promise: Promise<T>) => {
    try {
      return await promise;
    } catch (error) {
      if (isServiceError(error) && error.data.status == 404) return null;
      throw error;
    }
  },
  requireAgentTracking: () => client,
  withInstanceScope,
  isAgentTrackingEnabledForOrganization: agentTrackingEnabled,
  assertAgentTrackingEnabled: async (d: any) => {
    if (!(await agentTrackingEnabled(d))) {
      throw new ServiceError(notFoundError(d.entity ?? 'agent_tracking'));
    }
  },
  agentTrackingSettingsService: {
    getOrganizationValues: async () => ({
      privacy: { ...privacy },
      desktop: { ...desktop },
      links: { ...links }
    })
  }
};

export let toolCalls = {
  rows: [] as any[],
  listToolCalls: vi.fn(async (d: any) => ({
    run: async (page: { limit: number; after?: string }) => {
      let visible = toolCalls.rows
        .filter(row => !row.hiddenFrom || row.hiddenFrom != d.organizationActor?.id)
        .filter(row => row.instanceId == d.instance.id)
        .filter(row => !d.ids || d.ids.includes(row.id))
        .filter(row => !d.clientCallIds || d.clientCallIds.includes(row.clientCallId))
        .filter(row => !d.clientCallSource || row.clientCallSource == d.clientCallSource)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      let start = page.after ? visible.findIndex(row => row.id == page.after) + 1 : 0;
      let items = visible.slice(start, start + page.limit);

      return {
        items,
        pagination: {
          hasNextPage: start + page.limit < visible.length,
          hasPreviousPage: start > 0
        }
      };
    }
  }))
};

export let sessionModule = { toolCallService: toolCalls };

export let connectionModule = { toolCallClientSources: ['claude-code', 'codex'] as const };

export let providers = {
  rows: [] as { id: string; name: string; instanceId: string | null }[],
  getManyProvidersByIds: vi.fn(async (d: { instance: { id: string }; ids: string[] }) =>
    providers.rows.filter(
      row => d.ids.includes(row.id) && (!row.instanceId || row.instanceId == d.instance.id)
    )
  )
};

export let catalogModule = {
  providerService: { getManyProvidersByIds: providers.getManyProvidersByIds }
};

export let consumers = { findMany: vi.fn(async (_query: any): Promise<any[]> => []) };

export let instanceConsumers = {
  findMany: vi.fn(async (_query: any): Promise<any[]> => [])
};

export let deviceSkills = {
  rows: [] as {
    instanceOid: bigint;
    name: string;
    skillOid: bigint;
    consumerDeviceId: string;
    consumerDeviceStatus: string;
  }[],
  findMany: vi.fn(async (_query: any): Promise<any[]> => [])
};

export let skills = {
  rows: [] as { oid: bigint; id: string; name: string; instanceOid: bigint; status: string }[],
  findMany: vi.fn(async (_query: any): Promise<any[]> => [])
};

let activeSkillOids = () =>
  new Set(skills.rows.filter(skill => skill.status == 'active').map(skill => skill.oid));

let findDeviceSkills = async (query: any) => {
  let active = activeSkillOids();

  return deviceSkills.rows
    .filter(
      row =>
        row.instanceOid == query.where.instanceOid &&
        query.where.name.in.includes(row.name) &&
        query.where.consumerDevice.id.in.includes(row.consumerDeviceId) &&
        row.consumerDeviceStatus == query.where.consumerDevice.status &&
        active.has(row.skillOid)
    )
    .map(row => ({
      name: row.name,
      skillOid: row.skillOid,
      consumerDevice: { id: row.consumerDeviceId }
    }));
};

let findSkills = async (query: any) =>
  skills.rows.filter(
    skill =>
      query.where.oid.in.includes(skill.oid) &&
      skill.instanceOid == query.where.instanceOid &&
      skill.status == query.where.status
  );

export let dbModule = {
  db: {
    consumer: consumers,
    instanceConsumer: instanceConsumers,
    consumerDeviceSkill: deviceSkills,
    skill: skills
  }
};

export let scope = {
  organization: { oid: 1n, id: 'org_1', name: 'Acme' },
  project: { oid: 2n, id: 'proj_1', name: 'Production' },
  instance: {
    oid: 3n,
    id: 'inst_1',
    name: 'Default',
    subspaceEnvironmentId: 'env_1'
  } as Instance
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

export let remoteRepository = (overrides: Record<string, unknown> = {}) => ({
  ...remoteMember({
    id: 'aten_repo',
    kind: 'repo',
    status: 'discovered',
    source: null,
    ref: null,
    name: 'acme/api',
    attributes: {
      provider: 'github.com',
      owner: 'acme',
      name: 'api',
      url: 'https://github.com/acme/api'
    },
    identifiers: [{ type: 'remote', value: 'github.com/acme/api', createdAt: new Date() }]
  }),
  ...overrides
});

export let resetMocks = () => {
  rpc.calls.length = 0;
  rpc.handlers = {};
  cache.store.clear();
  cache.failing = false;
  consumers.findMany.mockReset();
  consumers.findMany.mockImplementation(async () => []);
  instanceConsumers.findMany.mockReset();
  instanceConsumers.findMany.mockImplementation(async () => []);
  withInstanceScope.mockClear();
  toolCalls.rows = [];
  toolCalls.listToolCalls.mockClear();
  deviceSkills.rows = [];
  deviceSkills.findMany.mockReset();
  deviceSkills.findMany.mockImplementation(findDeviceSkills);
  skills.rows = [];
  skills.findMany.mockReset();
  skills.findMany.mockImplementation(findSkills);
  providers.rows = [];
  providers.getManyProvidersByIds.mockReset();
  providers.getManyProvidersByIds.mockImplementation(async d =>
    providers.rows.filter(
      row => d.ids.includes(row.id) && (!row.instanceId || row.instanceId == d.instance.id)
    )
  );
  agentTrackingEnabled.mockReset();
  agentTrackingEnabled.mockImplementation(async () => true);
  privacy.hideIndividuals = false;
  privacy.minGroupUsers = 5;
  desktop.toolDetails = false;
  desktop.sessionTitles = false;
  links.ticketUrlTemplate = null;
};

export let callsTo = (path: string) => rpc.calls.filter(call => call.path == path);

export let rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (isServiceError(error)) return error.data;
    throw error;
  }

  throw new Error('Expected a rejection');
};

export let settles = async (promise: Promise<unknown>) =>
  await Promise.race([
    promise.then(
      () => 'settled',
      () => 'settled'
    ),
    new Promise(resolve => setTimeout(() => resolve('pending'), 1000))
  ]);
