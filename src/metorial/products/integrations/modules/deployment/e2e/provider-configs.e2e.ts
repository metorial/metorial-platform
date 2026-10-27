import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '../src';
import { createDeployableProvider } from './helpers';

describe('module-deployment provider configs and vaults', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let provider: Awaited<ReturnType<typeof createDeployableProvider>>;
  let otherProvider: Awaited<ReturnType<typeof createDeployableProvider>>;

  beforeAll(async () => {
    provider = await createDeployableProvider(org, server.url);
    otherProvider = await createDeployableProvider(org, server.url);
  }, 120_000);

  let instanceOf = async () => (await loadOrganizationFixture(org.ids)).instance;

  let createDeployment = async () => {
    let instance = await instanceOf();
    let deployment = await providerDeploymentService.createProviderDeployment({
      instance,
      provider,
      input: { name: uniqueId('deployment'), config: { type: 'none' } }
    });
    return providerDeploymentService.getProviderDeploymentById({
      instance,
      providerDeploymentId: deployment.id
    });
  };

  let listConfigIds = async (
    input: Omit<Parameters<typeof providerConfigService.listProviderConfigs>[0], 'instance'>
  ) =>
    (
      await firstPage(
        await providerConfigService.listProviderConfigs({
          instance: await instanceOf(),
          ...input
        })
      )
    ).map(item => item.id);

  it('creates, updates and archives a standalone config', async () => {
    let instance = await instanceOf();

    let config = await providerConfigService.createProviderConfig({
      instance,
      provider,
      input: {
        name: '  Standalone config  ',
        description: 'E2E config',
        metadata: { purpose: 'e2e' },
        config: { type: 'inline', data: {} }
      }
    });
    expect(config).toMatchObject({
      status: 'active',
      name: 'Standalone config',
      description: 'E2E config',
      isDefault: false,
      isForVault: false,
      isEphemeral: false,
      deploymentOid: null,
      providerOid: provider.oid,
      specificationOid: provider.defaultVariant!.currentVersion!.specificationOid
    });
    expect(config.currentVersionOid).not.toBeNull();
    expect(
      await subspaceDb.providerConfigUpdate.count({ where: { configOid: config.oid } })
    ).toBe(1);

    expect(await listConfigIds({ providerIds: [provider.id] })).toContain(config.id);
    expect(await listConfigIds({ providerIds: [otherProvider.id] })).not.toContain(config.id);

    let updated = await providerConfigService.updateProviderConfig({
      instance,
      providerConfig: config,
      input: { name: 'Renamed config', metadata: { stage: 'renamed' } }
    });
    expect(updated).toMatchObject({
      name: 'Renamed config',
      description: 'E2E config',
      metadata: { stage: 'renamed' }
    });

    let archived = await providerConfigService.archiveProviderConfig({
      instance,
      providerConfig: updated
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let fetched = await providerConfigService.getProviderConfigById({
      instance,
      providerConfigId: config.id
    });
    expect(fetched.status).toBe('archived');
    expect(await listConfigIds({ ids: [config.id] })).toEqual([]);
    expect(await listConfigIds({ ids: [config.id], status: ['archived'] })).toEqual([
      config.id
    ]);

    await expectServiceError(
      providerConfigService.updateProviderConfig({
        instance,
        providerConfig: fetched,
        input: { name: uniqueId('too-late') }
      }),
      'gone'
    );
    await expectServiceError(
      providerConfigService.archiveProviderConfig({ instance, providerConfig: fetched }),
      'gone'
    );
  }, 120_000);

  it('switches the default config of a deployment', async () => {
    let instance = await instanceOf();
    let deployment = await createDeployment();

    await expectServiceError(
      providerConfigService.createProviderConfig({
        instance,
        provider,
        input: { isDefault: true, config: { type: 'inline', data: {} } }
      }),
      'default_config_requires_deployment'
    );

    let first = await providerConfigService.createProviderConfig({
      instance,
      provider,
      providerDeployment: deployment,
      input: { isDefault: true, config: { type: 'inline', data: {} } }
    });
    let second = await providerConfigService.createProviderConfig({
      instance,
      provider,
      providerDeployment: deployment,
      input: { isDefault: true, config: { type: 'inline', data: {} } }
    });

    let [storedFirst, storedSecond, storedDeployment] = await Promise.all([
      subspaceDb.providerConfig.findUniqueOrThrow({ where: { oid: first.oid } }),
      subspaceDb.providerConfig.findUniqueOrThrow({ where: { oid: second.oid } }),
      subspaceDb.providerDeployment.findUniqueOrThrow({ where: { oid: deployment.oid } })
    ]);
    expect(storedFirst.isDefault).toBe(false);
    expect(storedSecond.isDefault).toBe(true);
    expect(storedDeployment.defaultConfigOid).toBe(second.oid);

    expect((await listConfigIds({ providerDeploymentIds: [deployment.id] })).sort()).toEqual(
      [first.id, second.id].sort()
    );
  }, 120_000);

  it('manages config vaults and the configs created from them', async () => {
    let instance = await instanceOf();
    let deployment = await createDeployment();
    let otherDeployment = await createDeployment();

    let vault = await providerConfigVaultService.createProviderConfigVault({
      instance,
      provider,
      providerDeployment: deployment,
      input: { name: uniqueId('vault'), config: { type: 'inline', data: {} } }
    });
    expect(vault).toMatchObject({
      status: 'active',
      providerOid: provider.oid,
      deploymentOid: deployment.oid
    });

    let vaultConfig = await subspaceDb.providerConfig.findUniqueOrThrow({
      where: { oid: vault.configOid },
      include: { provider: true, deployment: true }
    });
    expect(vaultConfig).toMatchObject({ isForVault: true, isEphemeral: true });
    expect(await listConfigIds({ providerIds: [provider.id] })).not.toContain(vaultConfig.id);
    await expectServiceError(
      providerConfigService.getProviderConfigById({
        instance,
        providerConfigId: vaultConfig.id
      }),
      'not_found'
    );
    await expectServiceError(
      providerConfigService.updateProviderConfig({
        instance,
        providerConfig: vaultConfig,
        input: { name: uniqueId('vault-config') }
      }),
      'vault_config_operation'
    );
    await expectServiceError(
      providerConfigService.archiveProviderConfig({ instance, providerConfig: vaultConfig }),
      'vault_config_operation'
    );

    let fromVault = await providerConfigService.createProviderConfig({
      instance,
      provider,
      providerDeployment: deployment,
      input: { config: { type: 'vault', vault } }
    });
    expect(fromVault).toMatchObject({
      fromVaultOid: vault.oid,
      parentConfigOid: vaultConfig.oid,
      deploymentOid: deployment.oid,
      specificationOid: vaultConfig.specificationOid
    });
    expect(await listConfigIds({ providerConfigVaultIds: [vault.id] })).toEqual([
      fromVault.id
    ]);

    await expectServiceError(
      providerConfigService.createProviderConfig({
        instance,
        provider,
        providerDeployment: otherDeployment,
        input: { config: { type: 'vault', vault } }
      }),
      'deployment_lock_mismatch'
    );
    await expectServiceError(
      providerConfigService.createProviderConfig({
        instance,
        provider: otherProvider,
        input: { config: { type: 'vault', vault } }
      }),
      'provider_mismatch'
    );

    let vaultIds = async (
      input: Omit<
        Parameters<typeof providerConfigVaultService.listProviderConfigVaults>[0],
        'instance'
      >
    ) =>
      (
        await firstPage(
          await providerConfigVaultService.listProviderConfigVaults({ instance, ...input })
        )
      ).map(item => item.id);
    expect(await vaultIds({ providerDeploymentIds: [deployment.id] })).toEqual([vault.id]);
    expect(await vaultIds({ providerDeploymentIds: [otherDeployment.id] })).toEqual([]);

    let renamed = await providerConfigVaultService.updateProviderConfigVault({
      instance,
      providerConfigVault: await providerConfigVaultService.getProviderConfigVaultById({
        instance,
        providerConfigVaultId: vault.id
      }),
      input: { name: 'Renamed vault' }
    });
    expect(renamed.name).toBe('Renamed vault');

    let archived = await providerConfigVaultService.archiveProviderConfigVault({
      instance,
      providerConfigVault: renamed
    });
    expect(archived.status).toBe('archived');
    expect(await vaultIds({ ids: [vault.id] })).toEqual([]);
    expect(await vaultIds({ ids: [vault.id], status: ['archived'] })).toEqual([vault.id]);

    await expectServiceError(
      providerConfigVaultService.updateProviderConfigVault({
        instance,
        providerConfigVault: await providerConfigVaultService.getProviderConfigVaultById({
          instance,
          providerConfigVaultId: vault.id
        }),
        input: { name: uniqueId('too-late') }
      }),
      'gone'
    );
    await expectServiceError(
      providerConfigService.createProviderConfig({
        instance,
        provider,
        providerDeployment: deployment,
        input: { config: { type: 'vault', vault: archived } }
      }),
      'use_after_delete'
    );
  }, 120_000);

  it('isolates configs and vaults between organizations', async () => {
    let instance = await instanceOf();
    let other = await loadOrganizationFixture(otherOrg.ids);

    let config = await providerConfigService.createProviderConfig({
      instance,
      provider,
      input: { config: { type: 'inline', data: {} } }
    });
    let vault = await providerConfigVaultService.createProviderConfigVault({
      instance,
      provider,
      input: { name: uniqueId('vault'), config: { type: 'inline', data: {} } }
    });

    await expectServiceError(
      providerConfigService.getProviderConfigById({
        instance: other.instance,
        providerConfigId: config.id
      }),
      'not_found'
    );
    await expectServiceError(
      providerConfigVaultService.getProviderConfigVaultById({
        instance: other.instance,
        providerConfigVaultId: vault.id
      }),
      'not_found'
    );
    expect(
      (
        await firstPage(
          await providerConfigService.listProviderConfigs({ instance: other.instance })
        )
      ).map(item => item.id)
    ).not.toContain(config.id);
    expect(
      (
        await firstPage(
          await providerConfigVaultService.listProviderConfigVaults({
            instance: other.instance
          })
        )
      ).map(item => item.id)
    ).not.toContain(vault.id);

    await expect(
      providerConfigService.archiveProviderConfig({
        instance: other.instance,
        providerConfig: config
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      providerConfigService.createProviderConfig({
        instance: other.instance,
        provider,
        input: { config: { type: 'vault', vault } }
      })
    ).rejects.toThrow('Tenant mismatch');

    let stored = await subspaceDb.providerConfig.findUniqueOrThrow({
      where: { oid: config.oid }
    });
    expect(stored.status).toBe('active');
  }, 120_000);
});
