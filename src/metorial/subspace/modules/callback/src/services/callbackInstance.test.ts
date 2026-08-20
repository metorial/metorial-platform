import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findCallbackInstance: vi.fn(),
  createCallbackInstance: vi.fn(),
  updateCallbackInstance: vi.fn(),
  upsertCallbackInstance: vi.fn(),
  getCombinations: vi.fn(),
  upsertDeploymentConfigPair: vi.fn(),
  syncCallbackInstance: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackInstance: {
      findFirst: mocks.findCallbackInstance,
      create: mocks.createCallbackInstance,
      update: mocks.updateCallbackInstance,
      upsert: mocks.upsertCallbackInstance
    }
  },
  getId: () => ({ oid: 100n, id: 'cbi_generated' }),
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  normalizeStatusForList: () => ({ onlyParent: {} }),
  resolveCallbacks: vi.fn(),
  resolveProviderAuthConfigs: vi.fn(),
  resolveProviderConfigs: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerCombinationService: { getCombinations: mocks.getCombinations },
  providerDeploymentConfigPairInternalService: {
    upsertDeploymentConfigPair: mocks.upsertDeploymentConfigPair
  }
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  getTenantForSlates: vi.fn()
}));

vi.mock('@metorial-subspace/module-auth', () => ({
  tombstoneProvisionedTenantAppsForCallbackInTransaction: vi.fn()
}));

vi.mock('./callback', () => ({
  callbackService: {}
}));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: {
    syncCallbackInstance: mocks.syncCallbackInstance
  }
}));

import { callbackInstanceService } from './callbackInstance';

let tenant = { oid: 1n, id: 'ten_authorized' } as any;
let solution = { oid: 2n, id: 'sol_authorized' } as any;
let environment = { oid: 3n, id: 'env_authorized' } as any;
let callback = {
  oid: 4n,
  id: 'clb_authorized',
  status: 'active',
  providerDeployment: {
    oid: 5n,
    id: 'pde_authorized',
    status: 'active',
    currentVersion: { oid: 6n, id: 'pdv_authorized' }
  }
} as any;
let config = {
  oid: 7n,
  id: 'pcf_authorized',
  currentVersion: { oid: 8n, id: 'pcv_authorized' }
} as any;
let pair = { oid: 9n, id: 'pdp_authorized' } as any;

let attach = () =>
  callbackInstanceService.attach({
    tenant,
    solution,
    environment,
    callback,
    config
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCombinations.mockResolvedValue([{ config, authConfig: null }]);
  mocks.upsertDeploymentConfigPair.mockResolvedValue({ pair });
  mocks.syncCallbackInstance.mockResolvedValue(undefined);
});

describe('callback instance attachment identity', () => {
  it.each(['attached', 'detached'] as const)(
    'atomically returns the canonical pair row when it is %s',
    async status => {
      let stored = {
        oid: 10n,
        id: 'cbi_canonical',
        callbackOid: callback.oid,
        providerDeploymentConfigPairOid: pair.oid,
        status
      } as any;
      let attached = { ...stored, status: 'attached' };

      mocks.upsertCallbackInstance.mockResolvedValue(attached);
      mocks.findCallbackInstance.mockResolvedValue(attached);

      let result = await attach();

      expect(mocks.upsertCallbackInstance).toHaveBeenCalledWith({
        where: {
          callbackOid_providerDeploymentConfigPairOid: {
            callbackOid: callback.oid,
            providerDeploymentConfigPairOid: pair.oid
          }
        },
        create: {
          oid: 100n,
          id: 'cbi_generated',
          callbackOid: callback.oid,
          providerDeploymentConfigPairOid: pair.oid,
          status: 'attached',
          registrationStatus: 'pending'
        },
        update: {
          status: 'attached'
        },
        include: expect.any(Object)
      });
      expect(mocks.createCallbackInstance).not.toHaveBeenCalled();
      expect(mocks.updateCallbackInstance).not.toHaveBeenCalled();
      expect(mocks.syncCallbackInstance).toHaveBeenCalledWith({
        callbackInstanceId: stored.id
      });
      expect(result.id).toBe(stored.id);
      expect(result.status).toBe('attached');
    }
  );

  it('rejects attaching to an archived callback', async () => {
    await expect(
      callbackInstanceService.attach({
        tenant,
        solution,
        environment,
        callback: { ...callback, status: 'archived' },
        config
      })
    ).rejects.toThrow('Instances cannot be attached to an archived callback.');
    expect(mocks.upsertCallbackInstance).not.toHaveBeenCalled();
  });
});
