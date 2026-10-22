import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  customProviderCommitService,
  customProviderDeploymentService,
  customProviderEnvironmentService,
  customProviderService,
  customProviderVersionService
} from '../src';
import {
  createRemoteCustomProvider,
  expectVersionFailed,
  type Fixture,
  refusedUrl,
  useFlakyServer,
  waitForCommit
} from './helpers';

describe('module-custom-provider failing deployments', () => {
  let org = useOrganization();
  let erroringServer = useFlakyServer(useMcpTestServer());

  let expectRecordedFailure = async (fixture: Fixture, customProviderId: string) => {
    let version = await expectVersionFailed(customProviderId, 1);
    expect(version.status).toBe('deployment_failed');
    expect(version.providerVersionOid).toBeNull();
    expect(version.deployment.startedAt).toBeInstanceOf(Date);
    expect(version.deployment.endedAt).toBeInstanceOf(Date);

    let commit = await waitForCommit({ targetCustomProviderVersionOid: version.oid });
    expect(commit).toMatchObject({
      oid: version.deployment.commitOid,
      status: 'failed',
      errorCode: 'deployment_failed',
      message: 'Initial commit'
    });
    expect(commit.errorMessage).toBeTruthy();

    let customProvider = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId
    });
    expect(customProvider.status).toBe('active');
    expect(customProvider.providerOid).toBeNull();

    let deployment = await customProviderDeploymentService.getCustomProviderDeploymentById({
      instance: fixture.instance,
      customProviderDeploymentId: version.deployment.id
    });
    expect(deployment.status).toBe('failed');

    let logs = await eventually(async () => {
      let logs = await customProviderDeploymentService.getLogs({
        instance: fixture.instance,
        customProviderDeployment: deployment
      });
      let messages = JSON.stringify(logs.steps);
      if (!messages.includes('Remote server check failed')) {
        throw new Error(`Failure not logged yet: ${messages}`);
      }
      return logs;
    });
    expect(logs.steps.length).toBeGreaterThan(0);

    return version;
  };

  it('fails the deployment of an unreachable remote server', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createRemoteCustomProvider(fixture, { url: refusedUrl });

    await expectRecordedFailure(fixture, created.id);
  }, 180_000);

  it('fails the deployment of a remote server that answers with errors', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let hitsBefore = erroringServer.hits;
    let created = await createRemoteCustomProvider(fixture, { url: erroringServer.url });

    await expectRecordedFailure(fixture, created.id);
    expect(erroringServer.hits).toBeGreaterThan(hitsBefore);
  }, 180_000);

  it('records an error when a container provider cannot be deployed', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let created = await customProviderService.createCustomProvider({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      input: {
        name: uniqueId('container-provider'),
        from: { type: 'container', repository: { imageRef: '' } }
      }
    });
    expect(created.type).toBe('container');

    let upcoming = await eventually(async () => {
      let upcoming = await subspaceDb.upcomingCustomProvider.findFirstOrThrow({
        where: { customProviderOid: created.oid }
      });
      if (!upcoming.errorCode) throw new Error('Upcoming custom provider has no error yet');
      return upcoming;
    });
    expect(upcoming.errorCode).toBe('deployment_failed');
    expect(upcoming.errorMessage).toBeTruthy();

    let version = await expectVersionFailed(created.id, 1);
    expect(version.status).toBe('deployment_failed');
    expect(version.deployment.commitOid).toBeNull();

    let deployment = await subspaceDb.customProviderDeployment.findUniqueOrThrow({
      where: { oid: version.deploymentOid }
    });
    expect(deployment.shuttleCustomServerDeploymentOid).toBeNull();
  }, 180_000);

  it.fails(
    'keeps a custom provider whose first deployment failed before a version was created visible (bug: the management visibility filter requires a custom provider environment version, so the provider can never be fetched or retried)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);

      let created = await customProviderService.createCustomProvider({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: {
          name: uniqueId('container-provider'),
          from: { type: 'container', repository: { imageRef: '' } }
        }
      });
      await expectVersionFailed(created.id, 1);

      let customProvider = await customProviderService.getCustomProviderById({
        instance: fixture.instance,
        customProviderId: created.id
      });
      expect(customProvider.id).toBe(created.id);
    },
    180_000
  );

  it('rejects invalid custom provider input', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('function-provider');

    await expectServiceError(
      customProviderService.createCustomProvider({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: {
          name,
          from: {
            type: 'function',
            env: {},
            runtime: { identifier: 'nodejs', version: '24.x' }
          }
        }
      }),
      'bad_request'
    );

    expect(await subspaceDb.customProvider.count({ where: { name } })).toBe(0);
  });

  it('rejects unknown ids', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { instance } = fixture;

    await expectServiceError(
      customProviderService.getCustomProviderById({
        instance,
        customProviderId: uniqueId('missing-custom-provider')
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderVersionService.getCustomProviderVersionById({
        instance,
        customProviderVersionId: uniqueId('missing-version')
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderDeploymentService.getCustomProviderDeploymentById({
        instance,
        customProviderDeploymentId: uniqueId('missing-deployment')
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderEnvironmentService.getCustomProviderEnvironmentById({
        instance,
        customProviderEnvironmentId: uniqueId('missing-environment')
      }),
      'not_found'
    );
    await expectServiceError(
      customProviderCommitService.getCustomProviderCommitById({
        instance,
        customProviderCommitId: uniqueId('missing-commit')
      }),
      'not_found'
    );

    expect(
      await firstPage(
        await customProviderVersionService.listCustomProviderVersions({
          instance,
          customProviderIds: []
        })
      )
    ).toEqual([]);
  });
});
