import { beforeEach, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  add: vi.fn(),
  captureException: vi.fn(),
  discoverCapabilities: vi.fn(),
  createEvent: vi.fn(),
  createNotification: vi.fn(),
  findVersion: vi.fn(),
  updateSlate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: () => ({ add: mocks.add, process: (handler: unknown) => handler })
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: (_key: string, handler: () => unknown) => handler() })
}));
vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));
vi.mock('@mtsrc/slates-hub-env/env', () => ({
  env: { service: { REDIS_URL: 'redis://test' } }
}));
vi.mock('@mtsrc/slates-hub-function-bay/failureReports', () => ({
  reportSlateDiscoveryFailure: vi.fn()
}));
vi.mock('../../registry', () => ({ followsRegistryCurrentVersion: () => false }));
vi.mock('./discoverCapabilities', () => ({
  discoverSlateCapabilities: mocks.discoverCapabilities
}));

vi.mock('@mtsrc/slates-hub-db/db', () => {
  let member = {
    createManyAndReturn: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn()
  };
  let join = { deleteMany: vi.fn() };

  return {
    withTransaction: mocks.transaction,
    db: {
      slateVersion: { findFirst: mocks.findVersion, updateMany: vi.fn() },
      slate: { update: mocks.updateSlate },
      slateEvent: { create: mocks.createEvent },
      slateSpecification: {
        upsert: vi.fn().mockResolvedValue({ oid: 3n }),
        updateMany: vi.fn()
      },
      slateAction: member,
      slateAuthMethod: member,
      slateTriggerGroup: member,
      slateAdapter: { findMany: vi.fn().mockResolvedValue([]) },
      slateVersionAdapter: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
      adapterCapability: { findMany: vi.fn().mockResolvedValue([]) },
      slateVersionAdapterCapability: { deleteMany: vi.fn() },
      slateConfigSchema: {
        upsert: vi.fn().mockResolvedValue({ oid: 4n }),
        updateMany: vi.fn()
      },
      slateSpecificationAction: join,
      slateSpecificationAuthMethod: join,
      slateSpecificationTriggerGroup: join,
      slateSpecificationConfigSchema: { ...join, upsert: vi.fn() },
      slateVersionDiscovery: { createMany: vi.fn() },
      changeNotification: { create: mocks.createNotification }
    }
  };
});

vi.mock('@mtsrc/slates-hub-module-invocations/slateInvocation', () => {
  let success = (data: unknown) => async () => ({
    status: 'success',
    invocation: { oid: 5n },
    data
  });

  return {
    slateInvocationService: {
      createInvocation: vi.fn(),
      getProviderInfo: success({ protocol: '1.0.0', provider: { name: 'Test', id: 'test' } }),
      getConfigSchema: success({ schema: {} }),
      listAuthMethods: success({ authenticationMethods: [] }),
      listActions: success({ actions: [] })
    }
  };
});

import { discoverSlateQueueProcessor } from './discover';

let run = discoverSlateQueueProcessor as unknown as (data: {
  versionId: string;
}) => Promise<void>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.discoverCapabilities.mockResolvedValue({ capabilitiesSupported: false });
  mocks.findVersion.mockResolvedValue({
    id: 'version_1',
    oid: 1n,
    slateOid: 2n,
    slate: { id: 'slate_1', oid: 2n, currentVersion: null },
    version: '1.0.0',
    status: 'active',
    willBeCurrent: true,
    providerDeploymentInfo: { functionDeploymentId: 'deployment_1' },
    activeDeploymentOid: 6n
  });
  mocks.transaction.mockImplementation((handler: () => Promise<void>) => handler());
});

it('continues rediscovery and retries activation when event IDs collide', async () => {
  let firstOids = new Map<string, bigint>();
  mocks.createEvent.mockImplementation(
    async ({ data }: { data: { type: string; oid: bigint } }) => {
      if (!firstOids.has(data.type)) {
        firstOids.set(data.type, data.oid);
        throw Object.assign(new Error('SlateEvent_pkey'), { code: 'P2002' });
      }

      expect(data.oid).not.toBe(firstOids.get(data.type));
    }
  );

  await run({ versionId: 'version_1' });

  expect([...firstOids.keys()]).toEqual([
    'discovery_started',
    'discovery_succeeded',
    'version_set_as_current'
  ]);
  expect(mocks.createEvent).toHaveBeenCalledTimes(6);
  expect(mocks.discoverCapabilities).toHaveBeenCalledOnce();
  expect(mocks.transaction).toHaveBeenCalledTimes(2);
  expect(mocks.updateSlate).toHaveBeenCalledTimes(2);
  expect(mocks.createNotification).toHaveBeenCalledOnce();
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.captureException).not.toHaveBeenCalled();
});
