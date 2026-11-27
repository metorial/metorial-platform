import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerConfigFindUniqueOrThrow: vi.fn(),
  providerUseUpsert: vi.fn(),
  indexProviderConfigAdd: vi.fn()
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: vi.fn(() => ({
    add: vi.fn(),
    addMany: vi.fn(),
    process: (handler: unknown) => handler
  }))
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerConfig: {
      findUniqueOrThrow: mocks.providerConfigFindUniqueOrThrow,
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    providerUse: { upsert: mocks.providerUseUpsert },
    providerDeployment: { updateMany: vi.fn() },
    sessionProvider: { updateMany: vi.fn() },
    sessionTemplateProvider: { updateMany: vi.fn() },
    identityCredential: { updateMany: vi.fn() },
    integrationInstanceProvider: { findMany: vi.fn() }
  },
  getId: vi.fn(() => ({ oid: 1n, id: 'pus_1' }))
}));

vi.mock(
  '@metorial-subspace/module-identity/src/queues/lifecycle/integrationInstanceProviderCredential',
  () => ({
    integrationInstanceProviderCredentialSyncQueue: { add: vi.fn(), addMany: vi.fn() }
  })
);

vi.mock('../../env', () => ({
  env: { service: { REDIS_URL: 'redis://localhost:6379' } }
}));

vi.mock('../search/providerConfig', () => ({
  indexProviderConfigQueue: { add: mocks.indexProviderConfigAdd }
}));

import { providerConfigCreatedQueueProcessor } from './providerConfig';

let runProcessor = providerConfigCreatedQueueProcessor as unknown as (d: {
  providerConfigId: string;
}) => Promise<void>;

let makeProviderConfig = (overrides: Record<string, unknown> = {}) => ({
  oid: 10n,
  id: 'pcf_1',
  tenantOid: 1n,
  projectOid: 2n,
  solutionOid: 1,
  environmentOid: 3n,
  instanceOid: 4n,
  providerOid: 5n,
  ...overrides
});

describe('Provider config created lifecycle queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mirrors the project and instance references from the loaded provider config', async () => {
    mocks.providerConfigFindUniqueOrThrow.mockResolvedValue(makeProviderConfig());

    await runProcessor({ providerConfigId: 'pcf_1' });

    expect(mocks.providerUseUpsert).toHaveBeenCalledTimes(1);
    let call = mocks.providerUseUpsert.mock.calls[0]![0];

    expect(call.create).toMatchObject({
      tenantOid: 1n,
      projectOid: 2n,
      solutionOid: 1,
      environmentOid: 3n,
      instanceOid: 4n,
      providerOid: 5n
    });
  });

  it('keeps the legacy composite unique key untouched', async () => {
    mocks.providerConfigFindUniqueOrThrow.mockResolvedValue(makeProviderConfig());

    await runProcessor({ providerConfigId: 'pcf_1' });

    let call = mocks.providerUseUpsert.mock.calls[0]![0];

    expect(call.where).toEqual({
      tenantOid_solutionOid_environmentOid_providerOid: {
        tenantOid: 1n,
        solutionOid: 1,
        environmentOid: 3n,
        providerOid: 5n
      }
    });
  });

  it('writes null when the provider config is not linked to a project or instance', async () => {
    mocks.providerConfigFindUniqueOrThrow.mockResolvedValue(
      makeProviderConfig({ projectOid: null, instanceOid: null })
    );

    await runProcessor({ providerConfigId: 'pcf_1' });

    let call = mocks.providerUseUpsert.mock.calls[0]![0];

    expect(call.create.projectOid).toBeNull();
    expect(call.create.instanceOid).toBeNull();
    expect(call.create.tenantOid).toBe(1n);
    expect(call.create.environmentOid).toBe(3n);
  });
});
