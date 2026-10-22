import {
  expectServiceError,
  firstPage,
  startMcpTestServer,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  customProviderCommitService,
  customProviderDeploymentService,
  customProviderEnvironmentService,
  customProviderService,
  customProviderVersionService
} from '../src';
import {
  createDeployedCustomProvider,
  createRemoteCustomProvider,
  expectVersionDeployed,
  expectVersionFailed,
  type Fixture,
  useFlakyServer,
  waitForCommit
} from './helpers';

describe('module-custom-provider versions', () => {
  let org = useOrganization();
  let server = useMcpTestServer();
  let flakyServer = useFlakyServer(server);
  let nextServer: ReturnType<typeof startMcpTestServer>;

  beforeAll(() => {
    nextServer = startMcpTestServer({ serverName: 'custom-provider-e2e-next' });
  });

  afterAll(async () => {
    await nextServer?.stop();
  });

  let getEnvironment = async (fixture: Fixture, customProviderId: string) => {
    let [environment] = await firstPage(
      await customProviderEnvironmentService.listCustomProviderEnvironments({
        instance: fixture.instance,
        customProviderIds: [customProviderId]
      })
    );
    return environment!;
  };

  let currentProviderVersionOid = async (customProviderOid: bigint) => {
    let customProvider = await subspaceDb.customProvider.findUniqueOrThrow({
      where: { oid: customProviderOid },
      include: { providerVariant: true }
    });
    return customProvider.providerVariant?.currentVersionOid;
  };

  it('promotes a new version and rolls back to the previous one', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createDeployedCustomProvider(fixture, { url: server.url });
    let releaseUrl = `${server.url}?release=2`;

    let created = await customProviderVersionService.createCustomProviderVersion({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      customProvider: first.customProvider,
      input: {
        message: 'Switch upstream',
        from: { type: 'remote', remoteUrl: releaseUrl, protocol: 'streamable_http' }
      }
    });
    expect(created.versionIndex).toBe(2);
    expect(created.status).toBe('queued');
    expect(created.deployment.status).toBe('queued');
    expect(created.deployment.trigger).toBe('manual');

    let storedProvider = await subspaceDb.customProvider.findUniqueOrThrow({
      where: { oid: first.customProvider.oid }
    });
    expect(storedProvider.maxVersionIndex).toBe(2);
    expect(storedProvider.payload.from).toMatchObject({ remoteUrl: releaseUrl });

    let second = await expectVersionDeployed(first.customProvider.id, 2);
    let secondCommit = await waitForCommit({
      targetCustomProviderVersionOid: second.oid,
      type: 'create_version'
    });
    expect(secondCommit).toMatchObject({
      status: 'applied',
      message: 'Switch upstream',
      toEnvironmentVersionBeforeOid: first.version.oid
    });

    let listVersions = async (order: 'asc' | 'desc') => {
      let paginator = await customProviderVersionService.listCustomProviderVersions({
        instance: fixture.instance,
        customProviderIds: [first.customProvider.id]
      });
      let page = await paginator.run({ limit: 10, order });
      return page.items.map(item => item.versionIndex);
    };
    expect(await listVersions('asc')).toEqual([1, 2]);
    expect(await listVersions('desc')).toEqual([2, 1]);

    let fetchedFirst = await customProviderVersionService.getCustomProviderVersionById({
      instance: fixture.instance,
      customProviderVersionId: first.version.id
    });
    let fetchedSecond = await customProviderVersionService.getCustomProviderVersionById({
      instance: fixture.instance,
      customProviderVersionId: second.id
    });
    expect(fetchedFirst).toMatchObject({ remoteUrl: server.url });
    expect(fetchedSecond).toMatchObject({ remoteUrl: releaseUrl });

    expect(await currentProviderVersionOid(first.customProvider.oid)).toBe(
      second.providerVersionOid
    );
    let providerVersions = await subspaceDb.providerVersion.findMany({
      where: { oid: { in: [first.version.providerVersionOid!, second.providerVersionOid!] } }
    });
    expect(
      Object.fromEntries(providerVersions.map(item => [item.oid.toString(), item.isCurrent]))
    ).toEqual({
      [first.version.providerVersionOid!.toString()]: false,
      [second.providerVersionOid!.toString()]: true
    });

    let environment = await getEnvironment(fixture, first.customProvider.id);
    expect(environment.providerEnvironment?.currentVersionOid).toBe(second.providerVersionOid);

    let refreshed = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId: first.customProvider.id
    });
    expect(refreshed.payload.from).toMatchObject({ remoteUrl: releaseUrl });

    let rollback = await customProviderCommitService.createCustomProviderCommit({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      input: {
        message: 'Roll back upstream',
        action: { type: 'rollback_to_version', environment, version: fetchedFirst }
      }
    });
    expect(rollback.type).toBe('rollback_to_version');
    expect(rollback.status).toBe('pending');
    expect(rollback.targetCustomProviderVersionOid).toBe(first.version.oid);

    let appliedRollback = await waitForCommit({ id: rollback.id });
    expect(appliedRollback.status).toBe('applied');
    expect(await currentProviderVersionOid(first.customProvider.oid)).toBe(
      first.version.providerVersionOid
    );
    expect(
      (await getEnvironment(fixture, first.customProvider.id)).providerEnvironment
        ?.currentVersionOid
    ).toBe(first.version.providerVersionOid);

    let commits = await firstPage(
      await customProviderCommitService.listCustomProviderCommits({
        instance: fixture.instance,
        customProviderIds: [first.customProvider.id]
      })
    );
    expect(commits.map(commit => commit.type).sort()).toEqual([
      'create_version',
      'create_version',
      'rollback_to_version'
    ]);

    let deployments = await firstPage(
      await customProviderDeploymentService.listCustomProviderDeployments({
        instance: fixture.instance,
        customProviderIds: [first.customProvider.id]
      })
    );
    expect(deployments.map(deployment => deployment.status)).toEqual([
      'succeeded',
      'succeeded'
    ]);
  }, 240_000);

  it('recovers from a failed version with a new version', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    flakyServer.failing = true;
    let created = await createRemoteCustomProvider(fixture, { url: flakyServer.url });

    let failed = await expectVersionFailed(created.id, 1);
    flakyServer.failing = false;
    expect(failed.status).toBe('deployment_failed');
    expect(failed.providerVersionOid).toBeNull();

    let customProvider = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId: created.id
    });
    expect(customProvider.providerOid).toBeNull();

    let retryUrl = `${flakyServer.url}?attempt=2`;
    let next = await customProviderVersionService.createCustomProviderVersion({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      customProvider,
      input: {
        message: 'Retry upstream',
        from: { type: 'remote', remoteUrl: retryUrl, protocol: 'streamable_http' }
      }
    });
    expect(next.versionIndex).toBe(2);

    let recovered = await expectVersionDeployed(created.id, 2);
    expect(recovered.status).toBe('deployment_succeeded');
    expect(
      (await waitForCommit({ targetCustomProviderVersionOid: recovered.oid })).status
    ).toBe('applied');

    let refreshed = await customProviderService.getCustomProviderById({
      instance: fixture.instance,
      customProviderId: created.id
    });
    expect(refreshed.providerOid).not.toBeNull();
    expect(refreshed.payload.from).toMatchObject({ remoteUrl: retryUrl });
    expect(
      await customProviderVersionService.getCustomProviderVersionById({
        instance: fixture.instance,
        customProviderVersionId: recovered.id
      })
    ).toMatchObject({ remoteUrl: retryUrl });
    expect(await currentProviderVersionOid(created.oid)).toBe(recovered.providerVersionOid);

    let environment = await getEnvironment(fixture, created.id);
    await expectServiceError(
      customProviderCommitService.createCustomProviderCommit({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: {
          message: 'Roll back to broken version',
          action: { type: 'rollback_to_version', environment, version: failed }
        }
      }),
      'bad_request'
    );
  }, 240_000);

  it('fails a new version that moves the remote server to another host', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createDeployedCustomProvider(fixture, { url: server.url });

    await customProviderVersionService.createCustomProviderVersion({
      instance: fixture.instance,
      organizationActor: fixture.actor,
      auditScope: fixture.auditScope,
      customProvider: first.customProvider,
      input: {
        message: 'Move upstream',
        from: { type: 'remote', remoteUrl: nextServer.url, protocol: 'streamable_http' }
      }
    });

    let failed = await expectVersionFailed(first.customProvider.id, 2);
    expect(failed.status).toBe('deployment_failed');
    expect(failed.providerVersionOid).toBeNull();

    let upcoming = await subspaceDb.upcomingCustomProvider.findFirstOrThrow({
      where: { customProviderOid: first.customProvider.oid }
    });
    expect(upcoming).toMatchObject({
      type: 'create_custom_provider_version',
      errorCode: 'deployment_failed'
    });
    expect(upcoming.errorMessage).toContain('Cannot change remote server host');

    expect(await currentProviderVersionOid(first.customProvider.oid)).toBe(
      first.version.providerVersionOid
    );
    expect(nextServer.requests).toEqual([]);
  }, 240_000);

  it('rejects invalid version changes and commits', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createDeployedCustomProvider(fixture, { url: server.url });
    let other = await createDeployedCustomProvider(fixture, { url: server.url });

    await expectServiceError(
      customProviderVersionService.createCustomProviderVersion({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        customProvider: first.customProvider,
        input: {
          from: { type: 'container', repository: { imageRef: 'ghcr.io/metorial/e2e:latest' } }
        }
      }),
      'bad_request'
    );

    let environment = await getEnvironment(fixture, first.customProvider.id);
    let otherEnvironment = await getEnvironment(fixture, other.customProvider.id);

    await expectServiceError(
      customProviderCommitService.createCustomProviderCommit({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: {
          message: 'Roll back to a foreign version',
          action: { type: 'rollback_to_version', environment, version: other.version }
        }
      }),
      'bad_request'
    );

    await expectServiceError(
      customProviderCommitService.createCustomProviderCommit({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: {
          message: 'Merge into itself',
          action: {
            type: 'merge_version_into_environment',
            fromEnvironment: environment,
            toEnvironment: environment
          }
        }
      }),
      'bad_request'
    );

    await expectServiceError(
      customProviderCommitService.createCustomProviderCommit({
        instance: fixture.instance,
        organizationActor: fixture.actor,
        auditScope: fixture.auditScope,
        input: {
          message: 'Merge across providers',
          action: {
            type: 'merge_version_into_environment',
            fromEnvironment: otherEnvironment,
            toEnvironment: environment
          }
        }
      }),
      'bad_request'
    );

    let stored = await subspaceDb.customProvider.findUniqueOrThrow({
      where: { oid: first.customProvider.oid }
    });
    expect(stored.maxVersionIndex).toBe(1);
    expect(stored.payload.from).toMatchObject({ type: 'remote', remoteUrl: server.url });
    expect(
      await subspaceDb.customProviderCommit.count({
        where: { customProviderOid: first.customProvider.oid }
      })
    ).toBe(1);
  }, 240_000);
});
