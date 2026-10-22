import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import { describe, expect, it } from 'vitest';
import {
  customProviderCommitService,
  customProviderDeploymentService,
  customProviderEnvironmentService,
  customProviderService,
  customProviderVersionService
} from '../src';
import { createDeployedCustomProvider } from './helpers';

describe('module-custom-provider lifecycle', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  it('updates a custom provider and its provider', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { customProvider } = await createDeployedCustomProvider(fixture, { url: server.url });
    let name = uniqueId('renamed-provider');

    let updated = await customProviderService.updateCustomProvider({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      customProvider,
      input: {
        name,
        description: 'Updated description',
        readme: '# Updated readme',
        metadata: { team: 'e2e' }
      }
    });
    expect(updated).toMatchObject({
      id: customProvider.id,
      name,
      description: 'Updated description',
      metadata: { team: 'e2e' }
    });

    let provider = await subspaceDb.provider.findUniqueOrThrow({
      where: { oid: customProvider.providerOid! }
    });
    expect(provider.name).toBe(name);
    expect(provider.description).toBe('Updated description');

    let fetched = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId: customProvider.id
    });
    expect(fetched.name).toBe(name);

    await expectServiceError(
      customProviderService.updateCustomProvider({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        customProvider: fetched,
        input: {
          repository: {
            type: 'git',
            repositoryUrl: 'https://github.com/metorial/e2e.git',
            branch: 'main'
          }
        }
      }),
      'bad_request'
    );
  }, 180_000);

  it('archives a custom provider and rejects further changes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { customProvider } = await createDeployedCustomProvider(fixture, {
      url: server.url
    });

    let archived = await customProviderService.archiveCustomProvider({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      customProvider
    });
    expect(archived.status).toBe('archived');

    let fetched = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId: customProvider.id
    });
    expect(fetched.status).toBe('archived');

    let listIds = async (status?: ('active' | 'archived')[]) =>
      (
        await firstPage(
          await customProviderService.listCustomProviders({
            instance: fixture.instance,
            status
          })
        )
      ).map(item => item.id);
    expect(await listIds()).not.toContain(customProvider.id);
    expect(await listIds(['archived'])).toContain(customProvider.id);

    expect(
      await firstPage(
        await customProviderDeploymentService.listCustomProviderDeployments({
          instance: fixture.instance,
          customProviderIds: [customProvider.id]
        })
      )
    ).toEqual([]);
    expect(
      await subspaceDb.upcomingCustomProvider.count({
        where: { customProviderOid: customProvider.oid }
      })
    ).toBe(0);

    await expectServiceError(
      customProviderService.updateCustomProvider({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        customProvider: fetched,
        input: { name: uniqueId('too-late') }
      }),
      'gone'
    );
    await expectServiceError(
      customProviderService.archiveCustomProvider({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        customProvider: fetched
      }),
      'gone'
    );
    await expectServiceError(
      customProviderVersionService.createCustomProviderVersion({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        customProvider: fetched,
        input: { message: 'After archive' }
      }),
      'use_after_delete'
    );

    let stored = await subspaceDb.customProvider.findUniqueOrThrow({
      where: { oid: customProvider.oid }
    });
    expect(stored).toMatchObject({ status: 'archived', maxVersionIndex: 1 });
  }, 180_000);

  it('archives the provider and provider deployments of an archived custom provider', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { customProvider } = await createDeployedCustomProvider(fixture, {
      url: server.url
    });

    let provider = await subspaceDb.provider.findUniqueOrThrow({
      where: { oid: customProvider.providerOid! },
      include: { defaultVariant: true }
    });
    let providerDeployment = await providerDeploymentService.createProviderDeployment({
      instance: fixture.instance,
      provider,
      input: { name: uniqueId('deployment'), config: { type: 'none' } }
    });

    await customProviderService.archiveCustomProvider({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      customProvider
    });

    await eventually(async () => {
      let stored = await subspaceDb.provider.findUniqueOrThrow({
        where: { oid: provider.oid }
      });
      if (stored.status !== 'archived') throw new Error(`Provider is ${stored.status}`);
    });
    await eventually(async () => {
      let stored = await subspaceDb.providerDeployment.findUniqueOrThrow({
        where: { oid: providerDeployment.oid }
      });
      if (stored.status !== 'archived') {
        throw new Error(`Provider deployment is ${stored.status}`);
      }
    });
  }, 180_000);

  it('isolates custom providers between organizations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let { customProvider, version, commit } = await createDeployedCustomProvider(fixture, {
      url: server.url
    });

    await expectServiceError(
      customProviderService.getCustomProviderById({
        instance: other.instance,
        customProviderId: customProvider.id
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderVersionService.getCustomProviderVersionById({
        instance: other.instance,
        customProviderVersionId: version.id
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderDeploymentService.getCustomProviderDeploymentById({
        instance: other.instance,
        customProviderDeploymentId: version.deployment.id
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderCommitService.getCustomProviderCommitById({
        instance: other.instance,
        customProviderCommitId: commit.id
      }),
      'not_found'
    );

    let [environment] = await firstPage(
      await customProviderEnvironmentService.listCustomProviderEnvironments({
        instance: fixture.instance,
        customProviderIds: [customProvider.id]
      })
    );
    await expectServiceError(
      customProviderEnvironmentService.getCustomProviderEnvironmentById({
        instance: other.instance,
        customProviderEnvironmentId: environment!.id
      }),
      'not_found'
    );

    expect(
      (
        await firstPage(
          await customProviderService.listCustomProviders({ instance: other.instance })
        )
      ).map(item => item.id)
    ).not.toContain(customProvider.id);
    expect(
      (
        await firstPage(
          await customProviderDeploymentService.listCustomProviderDeployments({
            instance: other.instance
          })
        )
      ).map(item => item.id)
    ).not.toContain(version.deployment.id);
    expect(
      (
        await firstPage(
          await customProviderVersionService.listCustomProviderVersions({
            instance: other.instance
          })
        )
      ).map(item => item.id)
    ).not.toContain(version.id);

    await expect(
      customProviderService.updateCustomProvider({
        instance: other.instance,
        organizationActor: other.actor,
        auditScope: other.auditScope,
        customProvider,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      customProviderService.archiveCustomProvider({
        instance: other.instance,
        organizationActor: other.actor,
        auditScope: other.auditScope,
        customProvider
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      customProviderVersionService.createCustomProviderVersion({
        instance: other.instance,
        organizationActor: other.actor,
        auditScope: other.auditScope,
        customProvider,
        input: { message: 'Hijacked version' }
      })
    ).rejects.toThrow('Tenant mismatch');

    let stored = await subspaceDb.customProvider.findUniqueOrThrow({
      where: { oid: customProvider.oid }
    });
    expect(stored).toMatchObject({
      name: customProvider.name,
      status: 'active',
      maxVersionIndex: 1
    });
  }, 180_000);
});
