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
  organization: new Map<bigint, string>(),
  project: new Map<bigint, string>(),
  instance: new Map<bigint, string>()
};

export let linksModule = {
  readOrganizationLink: vi.fn(async (organization: Oid) =>
    links.organization.get(organization.oid)
  ),
  readProjectLink: vi.fn(async (project: Oid) => links.project.get(project.oid)),
  readInstanceLink: vi.fn(async (instance: Oid) => links.instance.get(instance.oid)),
  linkOrganization: vi.fn(async (organization: Oid, id: string) => {
    links.organization.set(organization.oid, id);
  }),
  linkProject: vi.fn(async (project: Oid, id: string) => {
    links.project.set(project.oid, id);
  }),
  linkInstance: vi.fn(async (instance: Oid, id: string) => {
    links.instance.set(instance.oid, id);
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
