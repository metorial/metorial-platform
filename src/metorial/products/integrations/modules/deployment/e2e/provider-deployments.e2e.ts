import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '../src';
import { createDeployableProvider } from './helpers';

describe('module-deployment provider deployments', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();
  let provider: Awaited<ReturnType<typeof createDeployableProvider>>;

  beforeAll(async () => {
    provider = await createDeployableProvider(org, server.url);
  }, 120_000);

  let createDeployment = async (
    input: Partial<
      Parameters<typeof providerDeploymentService.createProviderDeployment>[0]['input']
    > = {}
  ) => {
    let { instance } = await loadOrganizationFixture(org.ids);

    return providerDeploymentService.createProviderDeployment({
      instance,
      provider,
      input: { name: uniqueId('deployment'), config: { type: 'none' }, ...input }
    });
  };

  let getDeployment = async (providerDeploymentId: string) => {
    let { instance } = await loadOrganizationFixture(org.ids);
    return providerDeploymentService.getProviderDeploymentById({
      instance,
      providerDeploymentId
    });
  };

  it('creates a deployment and records its version and usage', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { tenant, environment } = await resolveMetorialFacing({ instance: fixture.instance });

    let deployment = await createDeployment({
      name: '  Padded deployment  ',
      description: 'E2E deployment',
      metadata: { purpose: 'e2e' }
    });
    expect(deployment).toMatchObject({
      status: 'active',
      name: 'Padded deployment',
      description: 'E2E deployment',
      metadata: { purpose: 'e2e' },
      isDefault: false,
      isEphemeral: false,
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      providerOid: provider.oid,
      providerVariantOid: provider.defaultVariantOid,
      defaultConfigOid: null
    });
    expect(deployment.currentVersion?.lockedVersionOid).toBeNull();

    expect(
      await subspaceDb.providerDeploymentVersion.count({
        where: { deploymentOid: deployment.oid }
      })
    ).toBe(1);
    expect(
      await subspaceDb.providerConfig.count({ where: { deploymentOid: deployment.oid } })
    ).toBe(0);
    expect(
      await subspaceDb.environmentProvider.count({
        where: { tenantOid: tenant.oid, providerOid: provider.oid }
      })
    ).toBe(1);

    await eventually(async () => {
      let stored = await subspaceDb.providerDeployment.findUniqueOrThrow({
        where: { oid: deployment.oid }
      });
      if (!stored.isMonitorReconciled) throw new Error('Deployment monitor not reconciled');
    });
    let usage = await eventually(async () =>
      subspaceDb.providerUse.findFirstOrThrow({
        where: {
          tenantOid: tenant.oid,
          environmentOid: environment.oid,
          providerOid: provider.oid
        }
      })
    );
    expect(usage.deployments).toBeGreaterThanOrEqual(1);

    let fetched = await getDeployment(deployment.id);
    expect(fetched.id).toBe(deployment.id);

    let many = await providerDeploymentService.getManyProviderDeploymentsByIds({
      instance: fixture.instance,
      ids: [deployment.id, uniqueId('missing-deployment')]
    });
    expect(many.map(item => item.id)).toEqual([deployment.id]);
  }, 120_000);

  it('creates an inline default config with the deployment', async () => {
    let deployment = await createDeployment({ config: { type: 'inline', data: {} } });
    expect(deployment.defaultConfigOid).not.toBeNull();

    let config = await subspaceDb.providerConfig.findUniqueOrThrow({
      where: { oid: deployment.defaultConfigOid! }
    });
    expect(config).toMatchObject({
      status: 'active',
      isDefault: true,
      isForVault: false,
      deploymentOid: deployment.oid,
      providerOid: provider.oid,
      name: `Default Config for ${deployment.name}`
    });
    expect(config.specificationOid).not.toBeNull();
    expect(config.currentVersionOid).not.toBeNull();

    expect(
      await subspaceDb.providerDeploymentConfigPair.count({
        where: {
          providerDeploymentVersionOid: deployment.currentVersionOid!,
          providerConfigVersionOid: config.currentVersionOid!
        }
      })
    ).toBe(1);
  }, 120_000);

  it('names the default config of an unnamed deployment after its provider', async () => {
    let deployment = await createDeployment({
      name: undefined,
      config: { type: 'inline', data: {} }
    });

    let config = await subspaceDb.providerConfig.findUniqueOrThrow({
      where: { oid: deployment.defaultConfigOid! }
    });
    expect(config.name).not.toMatch(/undefined/);
  }, 120_000);

  it('keeps a single default deployment per provider', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    let first = await createDeployment({ isDefault: true });
    let second = await createDeployment({ isDefault: true });

    let [storedFirst, storedSecond] = await Promise.all([
      subspaceDb.providerDeployment.findUniqueOrThrow({ where: { oid: first.oid } }),
      subspaceDb.providerDeployment.findUniqueOrThrow({ where: { oid: second.oid } })
    ]);
    expect(storedFirst.isDefault).toBe(false);
    expect(storedSecond.isDefault).toBe(true);

    let ensured = await providerDeploymentService.ensureDefaultProviderDeployment({
      instance,
      provider
    });
    expect(ensured.id).toBe(second.id);
  }, 120_000);

  it('locks, keeps and unlocks the provider version of a deployment', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let providerVersion = await subspaceDb.providerVersion.findUniqueOrThrow({
      where: { oid: provider.defaultVariant!.currentVersionOid! }
    });
    let deployment = await createDeployment();
    let versionCount = () =>
      subspaceDb.providerDeploymentVersion.count({ where: { deploymentOid: deployment.oid } });

    let locked = await providerDeploymentService.updateProviderDeployment({
      instance,
      providerDeployment: await getDeployment(deployment.id),
      input: { lockedVersion: providerVersion }
    });
    expect(locked.currentVersionOid).not.toBe(deployment.currentVersionOid);
    expect(locked.currentVersion?.lockedVersionOid).toBe(providerVersion.oid);
    expect(await versionCount()).toBe(2);

    let unchanged = await providerDeploymentService.updateProviderDeployment({
      instance,
      providerDeployment: await getDeployment(deployment.id),
      input: { lockedVersion: providerVersion }
    });
    expect(unchanged.currentVersionOid).toBe(locked.currentVersionOid);
    expect(await versionCount()).toBe(2);

    let unlocked = await providerDeploymentService.updateProviderDeployment({
      instance,
      providerDeployment: await getDeployment(deployment.id),
      input: { lockedVersion: null }
    });
    expect(unlocked.currentVersionOid).not.toBe(locked.currentVersionOid);
    expect(unlocked.currentVersion?.lockedVersionOid).toBeNull();
    expect(await versionCount()).toBe(3);

    let renamed = await providerDeploymentService.updateProviderDeployment({
      instance,
      providerDeployment: await getDeployment(deployment.id),
      input: { name: 'Renamed deployment', metadata: { stage: 'renamed' } }
    });
    expect(renamed).toMatchObject({
      name: 'Renamed deployment',
      description: deployment.description,
      metadata: { stage: 'renamed' },
      currentVersionOid: unlocked.currentVersionOid
    });
    expect(await versionCount()).toBe(3);
  }, 120_000);

  it('archives a deployment together with its configs and vaults', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let deployment = await createDeployment({
      isDefault: true,
      config: { type: 'inline', data: {} }
    });
    let current = await getDeployment(deployment.id);
    let vault = await providerConfigVaultService.createProviderConfigVault({
      instance,
      provider,
      providerDeployment: current,
      input: { name: uniqueId('vault'), config: { type: 'inline', data: {} } }
    });

    let archived = await providerDeploymentService.archiveProviderDeployment({
      instance,
      providerDeployment: current
    });
    expect(archived).toMatchObject({
      status: 'archived',
      isDefault: false,
      defaultConfigOid: null
    });
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let fetched = await getDeployment(deployment.id);
    expect(fetched.status).toBe('archived');

    let listIds = async (status?: ('active' | 'archived')[]) =>
      (
        await firstPage(
          await providerDeploymentService.listProviderDeployments({
            instance,
            providerIds: [provider.id],
            status
          })
        )
      ).map(item => item.id);
    expect(await listIds()).not.toContain(deployment.id);
    expect(await listIds(['archived'])).toContain(deployment.id);

    await eventually(async () => {
      let configs = await subspaceDb.providerConfig.findMany({
        where: { deploymentOid: deployment.oid, isForVault: false }
      });
      if (configs.some(config => config.status !== 'archived')) {
        throw new Error('Deployment configs are not archived yet');
      }
    });
    await eventually(async () => {
      let stored = await subspaceDb.providerConfigVault.findUniqueOrThrow({
        where: { oid: vault.oid }
      });
      if (stored.status !== 'archived') throw new Error('Vault is not archived yet');
    });

    await expectServiceError(
      providerDeploymentService.updateProviderDeployment({
        instance,
        providerDeployment: fetched,
        input: { name: uniqueId('too-late') }
      }),
      'gone'
    );
    await expectServiceError(
      providerDeploymentService.archiveProviderDeployment({
        instance,
        providerDeployment: fetched
      }),
      'gone'
    );
    await expectServiceError(
      providerConfigService.createProviderConfig({
        instance,
        provider,
        providerDeployment: fetched,
        input: { config: { type: 'inline', data: {} } }
      }),
      'use_after_delete'
    );
  }, 120_000);

  it('filters the deployment list', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let first = await createDeployment();
    let second = await createDeployment();
    let ephemeral = await createDeployment({ isEphemeral: true });

    let list = async (
      input: Omit<
        Parameters<typeof providerDeploymentService.listProviderDeployments>[0],
        'instance'
      >
    ) =>
      (
        await firstPage(
          await providerDeploymentService.listProviderDeployments({ instance, ...input })
        )
      ).map(item => item.id);

    expect(await list({ ids: [first.id] })).toEqual([first.id]);

    let byProvider = await list({ providerIds: [provider.id] });
    expect(byProvider).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(byProvider).not.toContain(ephemeral.id);

    expect(await list({ ids: [first.id, second.id], status: ['archived'] })).toEqual([]);
    expect(await list({ ids: [ephemeral.id] })).toEqual([]);

    let fetchedEphemeral = await getDeployment(ephemeral.id);
    expect(fetchedEphemeral.isEphemeral).toBe(true);
  }, 120_000);

  it('isolates deployments between organizations', async () => {
    let other = await loadOrganizationFixture(otherOrg.ids);
    let deployment = await createDeployment();
    let current = await getDeployment(deployment.id);

    await expectServiceError(
      providerDeploymentService.getProviderDeploymentById({
        instance: other.instance,
        providerDeploymentId: deployment.id
      }),
      'not_found'
    );
    expect(
      await providerDeploymentService.getManyProviderDeploymentsByIds({
        instance: other.instance,
        ids: [deployment.id]
      })
    ).toEqual([]);
    expect(
      (
        await firstPage(
          await providerDeploymentService.listProviderDeployments({ instance: other.instance })
        )
      ).map(item => item.id)
    ).not.toContain(deployment.id);

    await expect(
      providerDeploymentService.archiveProviderDeployment({
        instance: other.instance,
        providerDeployment: current
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      providerDeploymentService.updateProviderDeployment({
        instance: other.instance,
        providerDeployment: current,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow();
    await expect(
      providerConfigService.createProviderConfig({
        instance: other.instance,
        provider,
        providerDeployment: current,
        input: { config: { type: 'inline', data: {} } }
      })
    ).rejects.toThrow('Tenant mismatch');

    let stored = await subspaceDb.providerDeployment.findUniqueOrThrow({
      where: { oid: deployment.oid }
    });
    expect(stored).toMatchObject({ status: 'active', name: deployment.name });
  }, 120_000);
});
