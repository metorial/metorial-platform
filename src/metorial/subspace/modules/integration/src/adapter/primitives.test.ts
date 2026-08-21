import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  tx,
  createIntegrationInternal,
  updateIntegrationInternal,
  archiveIntegrationInternal,
  createIntegrationInstanceInternal,
  updateIntegrationInstanceInternal,
  archiveIntegrationInstanceInternal,
  createIntegrationProviderInternal,
  archiveIntegrationProviderInternal,
  setIntegrationInstanceProviderInternal
} = vi.hoisted(() => {
  let createModel = () => ({
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  });

  return {
    tx: {
      adapterIntegration: createModel(),
      adapterIntegrationProvider: createModel(),
      adapterIntegrationInstance: createModel(),
      adapterIntegrationInstanceProvider: createModel(),
      integration: createModel(),
      integrationProvider: createModel(),
      integrationInstance: createModel(),
      integrationInstanceProvider: createModel(),
      provider: createModel(),
      providerAdapter: createModel(),
      providerAdapterGlobal: createModel(),
      tenant: createModel(),
      environment: createModel()
    },
    createIntegrationInternal: vi.fn(),
    updateIntegrationInternal: vi.fn(),
    archiveIntegrationInternal: vi.fn(),
    createIntegrationInstanceInternal: vi.fn(),
    updateIntegrationInstanceInternal: vi.fn(),
    archiveIntegrationInstanceInternal: vi.fn(),
    createIntegrationProviderInternal: vi.fn(),
    archiveIntegrationProviderInternal: vi.fn(),
    setIntegrationInstanceProviderInternal: vi.fn()
  };
});

vi.mock('@metorial-subspace/db', () => ({
  getId: (kind: string) => ({ id: `${kind}_new`, oid: 100n }),
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('../services/integration', () => ({
  integrationService: {
    createIntegrationInternal,
    updateIntegrationInternal,
    archiveIntegrationInternal
  }
}));

vi.mock('../services/integrationInstance', () => ({
  integrationInstanceService: {
    createIntegrationInstanceInternal,
    updateIntegrationInstanceInternal,
    archiveIntegrationInstanceInternal
  }
}));

vi.mock('../services/integrationProvider', () => ({
  integrationProviderService: {
    createIntegrationProviderInternal,
    archiveIntegrationProviderInternal
  }
}));

vi.mock('../services/integrationInstanceProvider', () => ({
  integrationInstanceProviderService: {
    setIntegrationInstanceProviderInternal
  }
}));

import {
  applyAdapterIntegrationPresentation,
  ensureAdapterInstance,
  ensureAdapterIntegration,
  ensureAdapterProvider,
  removeAdapterInstance,
  removeAdapterIntegration
} from './primitives';

let tenant = { oid: 1n, projectOid: 11n } as any;
let environment = { oid: 3n, instanceOid: 33n } as any;
let adapterGlobal = { oid: 9n, identifier: 'chat' } as any;

let hiddenIntegration = {
  oid: 20n,
  id: 'int_hidden',
  name: 'Support',
  description: '',
  metadata: {},
  isMagicMcpBacking: false,
  isAdapterBacking: true,
  tenantOid: 1n,
  projectOid: 11n,
  environmentOid: 3n,
  instanceOid: 33n,
  solutionOid: 2
};

let visibleIntegration = {
  ...hiddenIntegration,
  oid: 21n,
  id: 'int_visible',
  isAdapterBacking: false
};

let adapterIntegrationRow = {
  oid: 100n,
  id: 'adapterIntegration_new',
  type: 'chat',
  isStandalone: true,
  status: 'active',
  adapterGlobalOid: 9n,
  integrationOid: 20n,
  tenantOid: 1n,
  projectOid: 11n,
  environmentOid: 3n,
  instanceOid: 33n,
  solutionOid: 2,
  integration: hiddenIntegration,
  adapterGlobal
};

describe('adapter primitives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.adapterIntegration.findFirst.mockResolvedValue(null);
    tx.adapterIntegration.findUniqueOrThrow.mockResolvedValue(adapterIntegrationRow);
    tx.adapterIntegration.create.mockResolvedValue(adapterIntegrationRow);
    tx.adapterIntegration.update.mockImplementation(async ({ data }: any) => ({
      ...adapterIntegrationRow,
      ...data
    }));
    tx.adapterIntegrationProvider.findUnique.mockResolvedValue(null);
    tx.adapterIntegrationProvider.findMany.mockResolvedValue([]);
    tx.adapterIntegrationProvider.create.mockImplementation(async ({ data }: any) => ({
      oid: 200n,
      ...data
    }));
    tx.adapterIntegrationProvider.update.mockImplementation(async ({ data }: any) => data);
    tx.adapterIntegrationProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.adapterIntegrationInstance.findMany.mockResolvedValue([]);
    tx.adapterIntegrationInstance.findUnique.mockResolvedValue(null);
    tx.adapterIntegrationInstance.findUniqueOrThrow.mockResolvedValue({
      oid: 300n,
      status: 'active',
      isStandalone: true,
      integrationInstanceOid: 40n,
      adapterIntegrationOid: 100n,
      adapterIntegration: adapterIntegrationRow,
      integrationInstance: { oid: 40n, name: 'Inst', isAdapterBacking: true, status: 'active' }
    });
    tx.adapterIntegrationInstance.create.mockImplementation(async ({ data }: any) => ({
      oid: 300n,
      ...data
    }));
    tx.adapterIntegrationInstance.update.mockImplementation(async ({ data }: any) => ({
      oid: 300n,
      ...data
    }));
    tx.adapterIntegrationInstanceProvider.findUnique.mockResolvedValue(null);
    tx.adapterIntegrationInstanceProvider.findMany.mockResolvedValue([]);
    tx.adapterIntegrationInstanceProvider.updateMany.mockResolvedValue({ count: 0 });
    tx.integrationProvider.findMany.mockResolvedValue([]);
    tx.integrationInstanceProvider.findMany.mockResolvedValue([]);
    tx.provider.findFirst.mockResolvedValue({ oid: 8n, id: 'pro_slack' });
    tx.providerAdapter.findFirst.mockResolvedValue({ oid: 1n });
    createIntegrationInternal.mockResolvedValue(hiddenIntegration);
    createIntegrationInstanceInternal.mockResolvedValue({
      oid: 40n,
      name: 'Inst',
      isAdapterBacking: true,
      integrationOid: 20n,
      status: 'draft'
    });
    createIntegrationProviderInternal.mockResolvedValue({ oid: 70n, providerOid: 8n });
  });

  it('standalone create hides the integration and copies name only', async () => {
    let result = await ensureAdapterIntegration({
      tenant,
      environment,
      type: 'chat',
      adapterGlobal,
      isStandalone: true,
      presentation: { name: 'Support' }
    });

    expect(createIntegrationInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        isAdapterBacking: true,
        slug: 'adapter-chat-adapterIntegration_new',
        input: expect.objectContaining({
          name: 'Support',
          description: '',
          metadata: {}
        })
      })
    );
    expect(result.isStandalone).toBe(true);

    tx.adapterIntegration.findUniqueOrThrow.mockResolvedValue(adapterIntegrationRow);
    await applyAdapterIntegrationPresentation({
      tenant,
      environment,
      adapterIntegration: adapterIntegrationRow as any,
      name: 'New name'
    });
    expect(updateIntegrationInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { name: 'New name' }
      })
    );
  });

  it('rejects attaching a Magic MCP integration and integrations with no capable providers', async () => {
    let err = await ensureAdapterIntegration({
      tenant,
      environment,
      type: 'chat',
      adapterGlobal,
      isStandalone: false,
      integration: { ...visibleIntegration, isMagicMcpBacking: true } as any
    }).catch((error: any) => error);
    expect(err?.data?.code ?? err?.error?.code ?? String(err)).toMatch(
      /adapter_integration_magic_mcp_blocked|Magic MCP/
    );

    tx.integrationProvider.findMany.mockResolvedValue([]);
    let missing = await ensureAdapterIntegration({
      tenant,
      environment,
      type: 'chat',
      adapterGlobal,
      isStandalone: false,
      integration: visibleIntegration as any
    }).catch((error: any) => error);
    expect(missing?.data?.code ?? missing?.error?.code ?? String(missing)).toMatch(
      /adapter_integration_no_capable_providers|no providers/
    );
  });

  it('filters capable providers and reuses one live row per type', async () => {
    tx.integrationProvider.findMany.mockResolvedValue([
      { oid: 2n, providerOid: 2n },
      { oid: 3n, providerOid: 3n }
    ]);
    tx.adapterIntegration.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...adapterIntegrationRow,
      isStandalone: false,
      integrationOid: 21n,
      integration: visibleIntegration
    });
    tx.adapterIntegration.create.mockResolvedValue({
      ...adapterIntegrationRow,
      isStandalone: false,
      integrationOid: 21n
    });
    tx.adapterIntegration.findUniqueOrThrow.mockResolvedValue({
      ...adapterIntegrationRow,
      isStandalone: false,
      integrationOid: 21n,
      integration: visibleIntegration
    });

    let first = await ensureAdapterIntegration({
      tenant,
      environment,
      type: 'chat',
      adapterGlobal,
      isStandalone: false,
      integration: visibleIntegration as any
    });
    expect(createIntegrationInternal).not.toHaveBeenCalled();
    expect(tx.adapterIntegrationProvider.create).toHaveBeenCalledTimes(2);

    let second = await ensureAdapterIntegration({
      tenant,
      environment,
      type: 'chat',
      adapterGlobal,
      isStandalone: false,
      integration: visibleIntegration as any
    });
    expect(second.oid).toBe(first.oid);
    expect(tx.adapterIntegration.create).toHaveBeenCalledTimes(1);
  });

  it('rejects definition provider writes on existing adapter integrations', async () => {
    tx.adapterIntegration.findUniqueOrThrow.mockResolvedValue({
      ...adapterIntegrationRow,
      isStandalone: false,
      integration: visibleIntegration
    });

    let err = await ensureAdapterProvider({
      tenant,
      environment,
      adapterIntegration: adapterIntegrationRow as any,
      input: { providerId: 'pro_slack' }
    }).catch((error: any) => error);
    expect(err?.data?.code ?? err?.error?.code ?? String(err)).toMatch(
      /adapter_integration_providers_managed_by_integration|managed by the integration/
    );
  });

  it('archives the hidden integration on standalone product archive', async () => {
    await removeAdapterIntegration({
      tenant,
      environment,
      adapterIntegration: adapterIntegrationRow as any,
      cause: 'product'
    });

    expect(archiveIntegrationInternal).toHaveBeenCalledWith(
      expect.objectContaining({ _canModifyAdapterBacking: true })
    );
  });

  it('does not archive a visible integration on product archive', async () => {
    tx.adapterIntegration.findUniqueOrThrow.mockResolvedValue({
      ...adapterIntegrationRow,
      isStandalone: false,
      integration: visibleIntegration
    });

    await removeAdapterIntegration({
      tenant,
      environment,
      adapterIntegration: { ...adapterIntegrationRow, isStandalone: false } as any,
      cause: 'product'
    });

    expect(archiveIntegrationInternal).not.toHaveBeenCalled();
  });

  it('creates a hidden instance for standalone parent adapters and instance-only standalone otherwise', async () => {
    await ensureAdapterInstance({
      tenant,
      environment,
      adapterIntegration: adapterIntegrationRow as any,
      createStandaloneInstance: { name: 'Bot' }
    });
    expect(createIntegrationInstanceInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        isAdapterBacking: true,
        input: expect.objectContaining({ name: 'Bot' })
      })
    );
    expect(tx.adapterIntegrationInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft' })
      })
    );

    tx.adapterIntegration.findUniqueOrThrow.mockResolvedValue({
      ...adapterIntegrationRow,
      isStandalone: false,
      integrationOid: 21n,
      integration: visibleIntegration
    });
    createIntegrationInstanceInternal.mockClear();

    await ensureAdapterInstance({
      tenant,
      environment,
      adapterIntegration: { ...adapterIntegrationRow, isStandalone: false } as any,
      createStandaloneInstance: { name: 'Hidden inst' }
    });
    expect(createIntegrationInstanceInternal).toHaveBeenCalled();

    createIntegrationInstanceInternal.mockClear();
    let visibleInstance = {
      oid: 55n,
      integrationOid: 21n,
      name: 'Visible',
      isAdapterBacking: false,
      status: 'active'
    } as any;
    await ensureAdapterInstance({
      tenant,
      environment,
      adapterIntegration: { ...adapterIntegrationRow, isStandalone: false } as any,
      integrationInstance: visibleInstance
    });
    expect(createIntegrationInstanceInternal).not.toHaveBeenCalled();
  });

  it('archives a standalone instance backing on product archive and leaves a linked instance', async () => {
    await removeAdapterInstance({
      tenant,
      environment,
      adapterInstance: { oid: 300n } as any,
      cause: 'product'
    });
    expect(archiveIntegrationInstanceInternal).toHaveBeenCalled();

    archiveIntegrationInstanceInternal.mockClear();
    tx.adapterIntegrationInstance.findUniqueOrThrow.mockResolvedValue({
      oid: 301n,
      status: 'active',
      isStandalone: false,
      adapterIntegration: { ...adapterIntegrationRow, isStandalone: false },
      integrationInstance: { oid: 55n }
    });

    await removeAdapterInstance({
      tenant,
      environment,
      adapterInstance: { oid: 301n } as any,
      cause: 'product'
    });
    expect(archiveIntegrationInstanceInternal).not.toHaveBeenCalled();
  });
});
