import { beforeEach, describe, expect, it, vi } from 'vitest';

let { providerDeploymentServiceMock, integrationProviderServiceMock } = vi.hoisted(() => ({
  providerDeploymentServiceMock: {
    getProviderDeploymentByIdInternal: vi.fn()
  },
  integrationProviderServiceMock: {
    ensureIntegrationProviderForDeploymentInternal: vi.fn()
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: () => factory() })
  }
}));

vi.mock('@lowerdeck/pagination', () => ({ Paginator: {} }));

vi.mock('@metorial/fabric', () => ({ Fabric: {} }));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(),
  db: {},
  getId: vi.fn(),
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', () => ({}));

vi.mock('@metorial-subspace/module-catalog', () => ({ providerService: {} }));

vi.mock('@metorial-subspace/module-deployment', () => ({
  providerDeploymentService: providerDeploymentServiceMock
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  assertAuthMethodAllowedForTenant: vi.fn(),
  providerCombinationService: {}
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn(),
  getMetorialSolution: vi.fn(),
  toProviderEventBase: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../src/lib/versions', () => ({
  createIntegrationInstanceProviderVersion: vi.fn(),
  normalizeIntegrationProviderToolFilter: vi.fn(),
  refreshIntegrationInstanceStatus: vi.fn()
}));

vi.mock('../src/listeners', () => ({ notifyIntegrationTransaction: vi.fn() }));

vi.mock('../src/queues/lifecycle/integrationInstanceProvider', () => ({
  enqueueIntegrationInstanceProviderSet: vi.fn(),
  enqueueIntegrationInstanceProvidersSet: vi.fn()
}));

vi.mock('../src/services/integration', () => ({
  getIntegrationToolFilterCapabilities: vi.fn()
}));

vi.mock('../src/services/integrationInstance', () => ({
  integrationInstanceProviderInclude: {},
  integrationInstanceProviderVersionInclude: {}
}));

vi.mock('../src/services/integrationProvider', () => ({
  integrationProviderService: integrationProviderServiceMock,
  MAX_INTEGRATION_PROVIDERS: 10
}));

import { integrationInstanceProviderService } from '../src/services/integrationInstanceProvider';

let tenant = { oid: 1n } as any;
let environment = { oid: 2n } as any;
let integration = { oid: 3n } as any;
let integrationInstance = { oid: 4n } as any;

let deploymentProviderOids: Record<string, bigint> = {
  deployment_a: 100n,
  deployment_b: 100n,
  deployment_c: 200n
};

describe('setMagicMcpIntegrationInstanceProvidersInternal', () => {
  let setProviders: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    providerDeploymentServiceMock.getProviderDeploymentByIdInternal.mockImplementation(
      async (d: { providerDeploymentId: string }) => ({
        providerOid: deploymentProviderOids[d.providerDeploymentId]
      })
    );
    integrationProviderServiceMock.ensureIntegrationProviderForDeploymentInternal.mockImplementation(
      async (d: { input: { providerDeploymentId: string } }) => ({
        id: `ip_${deploymentProviderOids[d.input.providerDeploymentId]}`
      })
    );

    setProviders = vi
      .spyOn(integrationInstanceProviderService, 'setIntegrationInstanceProvidersInternal')
      .mockResolvedValue([] as any) as any;
  });

  it('collapses deployments of the same provider into a single input', async () => {
    await integrationInstanceProviderService.setMagicMcpIntegrationInstanceProvidersInternal({
      tenant,
      environment,
      integration,
      integrationInstance,
      isReconciliation: true,
      input: [
        { providerDeploymentId: 'deployment_a' },
        { providerDeploymentId: 'deployment_c' },
        { providerDeploymentId: 'deployment_b' }
      ]
    });

    expect(
      integrationProviderServiceMock.ensureIntegrationProviderForDeploymentInternal
    ).toHaveBeenCalledTimes(2);

    let providerIds = setProviders.mock.calls[0]![0].input.map(
      (input: { providerId: string }) => input.providerId
    );
    expect(providerIds).toEqual(['ip_100', 'ip_200']);
  });

  it('keeps the last input for a duplicated provider', async () => {
    await integrationInstanceProviderService.setMagicMcpIntegrationInstanceProvidersInternal({
      tenant,
      environment,
      integration,
      integrationInstance,
      input: [
        { providerDeploymentId: 'deployment_a' },
        { providerDeploymentId: 'deployment_b' }
      ]
    });

    expect(setProviders.mock.calls[0]![0].input).toEqual([
      expect.objectContaining({ providerDeploymentId: 'deployment_b' })
    ]);
  });

  it('does nothing without inputs', async () => {
    let result =
      await integrationInstanceProviderService.setMagicMcpIntegrationInstanceProvidersInternal(
        {
          tenant,
          environment,
          integration,
          integrationInstance,
          input: []
        }
      );

    expect(result).toEqual([]);
    expect(setProviders).not.toHaveBeenCalled();
  });
});
