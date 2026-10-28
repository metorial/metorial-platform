import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '../src';

describe('module-deployment', () => {
  let org = useOrganization();

  it('lists no deployments, configs or config vaults for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await firstPage(await providerDeploymentService.listProviderDeployments({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(await providerConfigService.listProviderConfigs({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(await providerConfigVaultService.listProviderConfigVaults({ instance }))
    ).toEqual([]);
  });

  it('rejects unknown deployment, config and config vault ids', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    await expect(
      providerDeploymentService.getProviderDeploymentById({
        instance,
        providerDeploymentId: uniqueId('missing-deployment')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      providerConfigService.getProviderConfigById({
        instance,
        providerConfigId: uniqueId('missing-config')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      providerConfigVaultService.getProviderConfigVaultById({
        instance,
        providerConfigVaultId: uniqueId('missing-vault')
      })
    ).rejects.toThrow(/could not be found/);

    let deployments = await providerDeploymentService.getManyProviderDeploymentsByIds({
      instance,
      ids: [uniqueId('missing-deployment')]
    });
    expect(deployments).toEqual([]);
  });
});
