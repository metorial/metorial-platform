import {
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  customProviderCommitService,
  customProviderEnvironmentService,
  customProviderService
} from '../src';
import { createDeployedCustomProvider, type Fixture, scopeOf, waitForCommit } from './helpers';

describe('module-custom-provider environments', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let development: Fixture;

  beforeAll(async () => {
    expectOk(
      await org.clients.management.post('/organization/sandboxes', {
        name: uniqueId('sandbox'),
        project_id: org.ids.projectId
      })
    );

    let instance = await db.instance.findFirstOrThrow({
      where: { project: { id: org.ids.projectId }, type: 'development' }
    });
    development = await loadOrganizationFixture({ ...org.ids, instanceId: instance.id });

    await customProviderService.listCustomProviders({ instance: development.instance });
  }, 120_000);

  let deployInProduction = async () => {
    let production = await loadOrganizationFixture(org.ids);
    let deployed = await createDeployedCustomProvider(production, { url: server.url });

    let productionScope = await scopeOf(production);
    let developmentScope = await scopeOf(development);

    let environments = await firstPage(
      await customProviderEnvironmentService.listCustomProviderEnvironments({
        instance: production.instance,
        customProviderIds: [deployed.customProvider.id]
      })
    );
    let productionEnvironment = environments.find(
      item => item.environmentOid === productionScope.environment.oid
    );
    let developmentEnvironment = environments.find(
      item => item.environmentOid === developmentScope.environment.oid
    );

    return {
      production,
      ...deployed,
      environments,
      productionEnvironment: productionEnvironment!,
      developmentEnvironment: developmentEnvironment!
    };
  };

  it('creates an environment per instance but only publishes to the deploying one', async () => {
    let {
      customProvider,
      version,
      environments,
      productionEnvironment,
      developmentEnvironment
    } = await deployInProduction();

    expect(environments).toHaveLength(2);
    expect(productionEnvironment.providerEnvironment?.currentVersionOid).toBe(
      version.providerVersionOid
    );
    expect(developmentEnvironment.providerEnvironmentOid).toBeNull();

    await expectServiceError(
      customProviderService.getCustomProviderById({
        instance: development.instance,
        customProviderId: customProvider.id
      }),
      'not_found'
    );
    expect(
      (
        await firstPage(
          await customProviderService.listCustomProviders({ instance: development.instance })
        )
      ).map(item => item.id)
    ).not.toContain(customProvider.id);

    await expectServiceError(
      customProviderEnvironmentService.getCustomProviderEnvironmentById({
        instance: development.instance,
        customProviderEnvironmentId: developmentEnvironment.id
      }),
      'not_found'
    );
    let unpublished = await customProviderEnvironmentService.getCustomProviderEnvironmentById({
      instance: development.instance,
      customProviderEnvironmentId: developmentEnvironment.id,
      includeUnpublished: true
    });
    expect(unpublished.id).toBe(developmentEnvironment.id);
  }, 180_000);

  it('lists the commits of an environment', async () => {
    let { production, commit, productionEnvironment } = await deployInProduction();

    let commits = await firstPage(
      await customProviderCommitService.listCustomProviderCommits({
        instance: production.instance,
        customProviderEnvironmentIds: [productionEnvironment.id]
      })
    );
    expect(commits.map(item => item.id)).toEqual([commit.id]);
  }, 180_000);

  it('merges a version into another environment', async () => {
    let {
      production,
      customProvider,
      version,
      productionEnvironment,
      developmentEnvironment
    } = await deployInProduction();

    let merge = await customProviderCommitService.createCustomProviderCommit({
      instance: production.instance,
      organizationActor: production.actor,
      auditScope: production.auditScope,
      input: {
        message: 'Promote to development',
        action: {
          type: 'merge_version_into_environment',
          fromEnvironment: productionEnvironment,
          toEnvironment: developmentEnvironment
        }
      }
    });
    expect(merge).toMatchObject({
      type: 'merge_version_into_environment',
      status: 'pending',
      fromEnvironmentOid: productionEnvironment.oid,
      toEnvironmentOid: developmentEnvironment.oid,
      targetCustomProviderVersionOid: version.oid,
      toEnvironmentVersionBeforeOid: null
    });

    let applied = await waitForCommit({ id: merge.id });
    expect(applied.status).toBe('applied');

    let published = await customProviderService.getCustomProviderById({
      instance: development.instance,
      customProviderId: customProvider.id
    });
    expect(published.id).toBe(customProvider.id);

    let developmentView =
      await customProviderEnvironmentService.getCustomProviderEnvironmentById({
        instance: development.instance,
        customProviderEnvironmentId: developmentEnvironment.id
      });
    expect(developmentView.providerEnvironment?.currentVersionOid).toBe(
      version.providerVersionOid
    );

    let refreshedDevelopmentEnvironment =
      await customProviderEnvironmentService.getCustomProviderEnvironmentById({
        instance: production.instance,
        customProviderEnvironmentId: developmentEnvironment.id,
        includeOtherEnvironments: true
      });
    await expectServiceError(
      customProviderCommitService.createCustomProviderCommit({
        instance: production.instance,
        organizationActor: production.actor,
        auditScope: production.auditScope,
        input: {
          message: 'Promote again',
          action: {
            type: 'merge_version_into_environment',
            fromEnvironment: productionEnvironment,
            toEnvironment: refreshedDevelopmentEnvironment
          }
        }
      }),
      'bad_request'
    );
  }, 180_000);
});
