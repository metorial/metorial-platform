import type { Instance } from '@metorial/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getProviderById: vi.fn(),
  getProviderVersionById: vi.fn(),
  getProviderDeploymentById: vi.fn(),
  createProviderDeployment: vi.fn(),
  createProviderConfig: vi.fn(),
  getProviderConfigVaultById: vi.fn(),
  createProviderAuthConfig: vi.fn()
}));

vi.mock('@metorial-subspace/module-catalog', () => ({
  providerService: { getProviderById: mocks.getProviderById },
  providerVersionService: { getProviderVersionById: mocks.getProviderVersionById }
}));
vi.mock('@metorial-subspace/module-deployment', () => ({
  providerDeploymentService: {
    getProviderDeploymentById: mocks.getProviderDeploymentById,
    createProviderDeployment: mocks.createProviderDeployment
  },
  providerConfigService: {
    createProviderConfig: mocks.createProviderConfig
  },
  providerConfigVaultService: {
    getProviderConfigVaultById: mocks.getProviderConfigVaultById
  }
}));
vi.mock('@metorial-subspace/module-auth', () => ({
  providerAuthConfigService: {
    createProviderAuthConfig: mocks.createProviderAuthConfig
  }
}));

import { resolveSessionProviderInput } from './_providerInput';

let instance = { id: 'ins_1' } as Instance;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('resolveSessionProviderInput', () => {
  it('preserves reference validation and deferred config/auth lookup', async () => {
    mocks.getProviderDeploymentById.mockResolvedValue({ id: 'pdp_1' });

    let result = await resolveSessionProviderInput({
      instance,
      providerDeployment: {
        type: 'reference',
        providerDeploymentId: 'pdp_1'
      },
      providerConfig: {
        type: 'reference',
        providerConfigId: 'pcf_1'
      },
      providerAuthConfig: {
        type: 'reference',
        providerAuthConfigId: 'pac_1'
      }
    });

    expect(mocks.getProviderDeploymentById).toHaveBeenCalledWith({
      instance,
      providerDeploymentId: 'pdp_1'
    });
    expect(result).toEqual({
      sessionTemplateId: undefined,
      deploymentId: 'pdp_1',
      configId: 'pcf_1',
      authConfigId: 'pac_1',
      toolFilters: undefined,
      __allowEphemeral: false
    });
  });

  it('preserves ephemeral deployment defaults and the legacy allowance oddity', async () => {
    let provider = { id: 'pro_1', name: 'Example' };
    let lockedVersion = { id: 'pvr_1' };
    mocks.getProviderById.mockResolvedValue(provider);
    mocks.getProviderVersionById.mockResolvedValue(lockedVersion);
    mocks.createProviderDeployment.mockResolvedValue({ id: 'pdp_new' });

    let result = await resolveSessionProviderInput({
      instance,
      providerDeployment: {
        type: 'ephemeral',
        providerId: 'pro_1',
        lockedProviderVersionId: 'pvr_1'
      }
    });

    expect(mocks.getProviderVersionById).toHaveBeenCalledWith({
      instance,
      providerVersionId: 'pvr_1'
    });
    expect(mocks.createProviderDeployment).toHaveBeenCalledWith({
      instance,
      provider,
      lockedVersion,
      input: {
        name: 'Ephemeral deployment for Example',
        description: undefined,
        metadata: undefined,
        isEphemeral: true,
        config: { type: 'none' }
      }
    });
    expect(result.deploymentId).toBe('pdp_new');
    expect(result.__allowEphemeral).toBe(false);
  });

  it('preserves the former deployment-id provider lookup for ephemeral configs', async () => {
    mocks.getProviderDeploymentById.mockResolvedValue({ id: 'pdp_1' });
    mocks.getProviderById.mockRejectedValue(new Error('provider not found'));

    await expect(
      resolveSessionProviderInput({
        instance,
        providerDeployment: {
          type: 'reference',
          providerDeploymentId: 'pdp_1'
        },
        providerConfig: {
          type: 'ephemeral',
          config: { type: 'inline', data: { region: 'us' } }
        }
      })
    ).rejects.toThrow('provider not found');

    expect(mocks.getProviderById).toHaveBeenCalledWith({
      instance,
      providerId: 'pdp_1'
    });
    expect(mocks.createProviderConfig).not.toHaveBeenCalled();
  });

  it('preserves provider resolution before loading an ephemeral vault config', async () => {
    await expect(
      resolveSessionProviderInput({
        instance,
        providerConfig: {
          type: 'ephemeral',
          config: {
            type: 'vault',
            providerConfigVaultId: 'pcv_1'
          }
        }
      })
    ).rejects.toThrow('Unable to resolve provider. Please provide a valid provider ID.');

    expect(mocks.getProviderConfigVaultById).not.toHaveBeenCalled();
    expect(mocks.createProviderConfig).not.toHaveBeenCalled();
  });

  it('preserves ephemeral auth defaults, attribution, and explicit provider resolution', async () => {
    let provider = { id: 'pro_1' };
    mocks.getProviderById.mockResolvedValue(provider);
    mocks.createProviderAuthConfig.mockResolvedValue({ id: 'pac_new' });

    let result = await resolveSessionProviderInput({
      instance,
      providerAuthConfig: {
        type: 'ephemeral',
        providerId: 'pro_1',
        providerAuthMethodId: 'pam_1',
        credentials: { token: 'secret' }
      }
    });

    expect(mocks.createProviderAuthConfig).toHaveBeenCalledWith({
      instance,
      provider,
      providerDeployment: undefined,
      source: 'manual',
      import: {
        ip: undefined,
        ua: undefined,
        note: 'Created via ephemeral provider configuration'
      },
      input: {
        name: 'Ephemeral auth config',
        authMethodId: 'pam_1',
        isEphemeral: true,
        config: { token: 'secret' }
      }
    });
    expect(result.authConfigId).toBe('pac_new');
    expect(result.__allowEphemeral).toBe(true);
  });
});
