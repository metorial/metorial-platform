import type { Instance } from '@metorial/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getProviderById: vi.fn(),
  getProviderVersionById: vi.fn(),
  getProviderDeploymentById: vi.fn(),
  createProviderDeployment: vi.fn(),
  getProviderConfigById: vi.fn(),
  createProviderConfig: vi.fn(),
  getProviderConfigVaultById: vi.fn(),
  getProviderAuthConfigById: vi.fn(),
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
    getProviderConfigById: mocks.getProviderConfigById,
    createProviderConfig: mocks.createProviderConfig
  },
  providerConfigVaultService: {
    getProviderConfigVaultById: mocks.getProviderConfigVaultById
  }
}));
vi.mock('@metorial-subspace/module-auth', () => ({
  providerAuthConfigService: {
    getProviderAuthConfigById: mocks.getProviderAuthConfigById,
    createProviderAuthConfig: mocks.createProviderAuthConfig
  }
}));

import { resolveSessionProviderInput } from './_providerInput';

let instance = { id: 'ins_1' } as Instance;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('resolveSessionProviderInput', () => {
  it('validates deployment, config and auth config references', async () => {
    mocks.getProviderDeploymentById.mockResolvedValue({ id: 'pdp_1' });
    mocks.getProviderConfigById.mockResolvedValue({ id: 'pcf_1' });
    mocks.getProviderAuthConfigById.mockResolvedValue({ id: 'pac_1' });

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
    expect(mocks.getProviderConfigById).toHaveBeenCalledWith({
      instance,
      providerConfigId: 'pcf_1'
    });
    expect(mocks.getProviderAuthConfigById).toHaveBeenCalledWith({
      instance,
      providerAuthConfigId: 'pac_1'
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

  it('rejects config references that cannot be resolved', async () => {
    mocks.getProviderConfigById.mockRejectedValue(new Error('config not found'));

    await expect(
      resolveSessionProviderInput({
        instance,
        providerConfig: { type: 'reference', providerConfigId: 'pcf_missing' }
      })
    ).rejects.toThrow('config not found');
  });

  it("resolves the provider of an ephemeral config from the deployment's provider", async () => {
    let provider = { id: 'pro_1' };
    let providerDeployment = { id: 'pdp_1', provider: { id: 'pro_1' } };
    mocks.getProviderDeploymentById.mockResolvedValue(providerDeployment);
    mocks.getProviderById.mockResolvedValue(provider);
    mocks.createProviderConfig.mockResolvedValue({ id: 'pcf_new' });

    let result = await resolveSessionProviderInput({
      instance,
      providerDeployment: {
        type: 'reference',
        providerDeploymentId: 'pdp_1'
      },
      providerConfig: {
        type: 'ephemeral',
        config: { type: 'inline', data: { region: 'us' } }
      }
    });

    expect(mocks.getProviderById).toHaveBeenCalledWith({ instance, providerId: 'pro_1' });
    expect(mocks.createProviderConfig).toHaveBeenCalledWith({
      instance,
      provider,
      providerDeployment,
      input: {
        name: 'Ephemeral config',
        isEphemeral: true,
        config: { type: 'inline', data: { region: 'us' } }
      }
    });
    expect(result).toMatchObject({ configId: 'pcf_new', __allowEphemeral: true });
  });

  it("falls back to the deployment's provider for ephemeral auth configs", async () => {
    let provider = { id: 'pro_1' };
    let providerDeployment = { id: 'pdp_1', provider: { id: 'pro_1' } };
    mocks.getProviderDeploymentById.mockResolvedValue(providerDeployment);
    mocks.getProviderById.mockResolvedValue(provider);
    mocks.createProviderAuthConfig.mockResolvedValue({ id: 'pac_new' });

    let result = await resolveSessionProviderInput({
      instance,
      providerDeployment: {
        type: 'reference',
        providerDeploymentId: 'pdp_1'
      },
      providerAuthConfig: {
        type: 'ephemeral',
        providerAuthMethodId: 'pam_1',
        credentials: { token: 'secret' }
      }
    });

    expect(mocks.getProviderById).toHaveBeenCalledWith({ instance, providerId: 'pro_1' });
    expect(mocks.createProviderAuthConfig).toHaveBeenCalledWith(
      expect.objectContaining({ provider, providerDeployment })
    );
    expect(result.authConfigId).toBe('pac_new');
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
