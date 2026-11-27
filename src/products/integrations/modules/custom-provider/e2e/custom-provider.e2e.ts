import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  customProviderDeploymentService,
  customProviderService,
  customProviderVersionService
} from '../src';

describe('module-custom-provider', () => {
  let org = useOrganization();

  it('lists no custom providers or deployments for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await firstPage(await customProviderService.listCustomProviders({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(
        await customProviderDeploymentService.listCustomProviderDeployments({ instance })
      )
    ).toEqual([]);

    await expect(
      customProviderService.getCustomProviderById({
        instance,
        customProviderId: uniqueId('missing-custom-provider')
      })
    ).rejects.toThrow(/could not be found/);
  });

  it('creates a remote custom provider with a queued initial deployment', async () => {
    let { instance, actor, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('remote-provider');

    let customProvider = await customProviderService.createCustomProvider({
      instance,
      organizationActor: actor,
      auditScope,
      input: {
        name,
        description: 'E2E remote provider',
        from: {
          type: 'remote',
          remoteUrl: 'https://mcp.e2e.metorial.test/mcp',
          protocol: 'streamable_http'
        }
      }
    });
    expect(customProvider.name).toBe(name);
    expect(customProvider.type).toBe('remote');
    expect(customProvider.status).toBe('active');

    let deployments = await firstPage(
      await customProviderDeploymentService.listCustomProviderDeployments({ instance })
    );
    let deployment = deployments.find(item => item.customProviderOid === customProvider.oid);
    expect(deployment).toBeDefined();

    let fetchedDeployment =
      await customProviderDeploymentService.getCustomProviderDeploymentById({
        instance,
        customProviderDeploymentId: deployment!.id
      });
    expect(fetchedDeployment.trigger).toBe('manual');

    let versions = await firstPage(
      await customProviderVersionService.listCustomProviderVersions({ instance })
    );
    let version = versions.find(item => item.customProviderOid === customProvider.oid);
    expect(version).toBeDefined();
    expect(version!.deploymentOid).toBe(deployment!.oid);

    let fetchedVersion = await customProviderVersionService.getCustomProviderVersionById({
      instance,
      customProviderVersionId: version!.id
    });
    expect(fetchedVersion.versionIndex).toBe(1);
  });
});
