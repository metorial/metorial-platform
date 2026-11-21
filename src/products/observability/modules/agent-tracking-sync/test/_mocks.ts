import { vi } from 'vitest';

export let mocks = {
  agentTracking: {} as Record<string, any>,
  enabled: { value: true },
  flagged: { value: true },
  flagChecks: [] as unknown[]
};

export let queueModule = {
  createQueue: vi.fn((config: { name: string; workerOpts?: unknown }) => ({
    name: config.name,
    workerOpts: config.workerOpts,
    add: vi.fn(),
    addMany: vi.fn(),
    addManyWithOps: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => ({ processors })),
  pacedDelay: vi.fn(() => ({ delay: 25_000 })),
  dailyPacedDelay: vi.fn(() => ({ delay: 0 }))
};

export let cronModule = {
  createCron: vi.fn((config, handler) => ({ config, handler }))
};

export let clientModule = {
  getAgentTracking: () => (mocks.enabled.value ? mocks.agentTracking : null),
  requireAgentTracking: () => mocks.agentTracking,
  isAgentTrackingEnabled: () => mocks.enabled.value,
  ignoreNotFound: (promise: Promise<unknown>) => promise
};

export let flagModule = {
  isAgentTrackingEnabledForOrganization: async (d: unknown) => {
    mocks.flagChecks.push(d);
    return mocks.enabled.value && mocks.flagged.value;
  }
};

export let storedSettings = {
  organization: null as Record<string, unknown> | null,
  project: null as Record<string, unknown> | null,
  instance: null as Record<string, unknown> | null
};

export let settingsModule = async (importOriginal: () => Promise<any>) => ({
  ...(await importOriginal()),
  readOrganizationSettings: vi.fn(async () => storedSettings.organization),
  readProjectSettings: vi.fn(async () => storedSettings.project),
  readInstanceSettings: vi.fn(async () => storedSettings.instance)
});

type Oid = { oid: bigint };

export let links = {
  organization: new Set<bigint>(),
  project: new Set<bigint>(),
  instance: new Set<bigint>()
};

export let linksModule = {
  isOrganizationLinked: vi.fn(async (organization: Oid) =>
    links.organization.has(organization.oid)
  ),
  isProjectLinked: vi.fn(async (project: Oid) => links.project.has(project.oid)),
  isInstanceLinked: vi.fn(async (instance: Oid) => links.instance.has(instance.oid)),
  markOrganizationLinked: vi.fn(async (organization: Oid) => {
    links.organization.add(organization.oid);
  }),
  markProjectLinked: vi.fn(async (project: Oid) => {
    links.project.add(project.oid);
  }),
  markInstanceLinked: vi.fn(async (instance: Oid) => {
    links.instance.add(instance.oid);
  }),
  unlinkProject: vi.fn(async (project: Oid) => {
    links.project.delete(project.oid);
  }),
  unlinkInstance: vi.fn(async (instance: Oid) => {
    links.instance.delete(instance.oid);
  }),
  unlinkOrganizationTree: vi.fn(async () => {
    for (let level of Object.values(links)) level.clear();
  })
};

export let resetLinks = () => {
  for (let level of Object.values(links)) level.clear();
};

export let resetMocks = () => {
  vi.clearAllMocks();
  resetLinks();
  mocks.enabled.value = true;
  mocks.flagged.value = true;
  mocks.flagChecks.length = 0;
};
