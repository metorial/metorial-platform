import { describe, expect, it } from 'vitest';
import { SlateDeploymentStatus, SlateVersionStatus } from '@mtsrc/slates-hub-db/client';
import { db as testDb } from '@mtsrc/slates-hub-db/db';
import { slatesHubClient } from './client';
import { fixtures } from './fixtures';
import { listAll } from './helpers';

describe('slate pipeline E2E', () => {
  let f = fixtures(testDb);

  let setup = async () => {
    let slate = await f.slate.withRegistry();
    let provider = await f.deploymentProvider.default();

    let addVersion = (
      version: string,
      overrides: Parameters<typeof testDb.slateVersion.update>[0]['data'] = {}
    ) =>
      f.slateVersion
        .default({
          slateOid: slate.oid,
          registryOid: slate.registryOid,
          version,
          overrides: {
            versionIdOnRegistry: `regver_${slate.id}_${version}`,
            isCurrent: false,
            willBeCurrent: false,
            status: SlateVersionStatus.unavailable
          }
        })
        .then(v => testDb.slateVersion.update({ where: { oid: v.oid }, data: overrides }));

    let addDeployment = (
      version: { oid: bigint },
      status: SlateDeploymentStatus,
      overrides: Record<string, unknown> = {}
    ) =>
      f.slateDeployment.default({
        slateVersionOid: version.oid,
        slateOid: slate.oid,
        providerOid: provider.oid,
        status,
        overrides
      });

    let backdate = (version: { oid: bigint }, minutes: number) =>
      testDb.$executeRaw`UPDATE "SlateVersion" SET "updatedAt" = now() - make_interval(mins => ${minutes}) WHERE oid = ${version.oid}`;

    return { slate, addVersion, addDeployment, backdate };
  };

  it('looks a slate up by its registry id', async () => {
    let { slate } = await setup();

    let presented = await slatesHubClient.slate.getByRegistryId({
      registrySlateId: slate.slateIdOnRegistry
    });
    expect(presented.id).toBe(slate.id);

    await expect(
      slatesHubClient.slate.getByRegistryId({ registrySlateId: 'slate_does_not_exist' })
    ).rejects.toThrow();
  });

  it('filters versions and presents the latest deployment', async () => {
    let { slate, addVersion, addDeployment } = await setup();

    let failed = await addVersion('1.0.0', {
      status: SlateVersionStatus.deployment_failed,
      willBeCurrent: true
    });
    await addVersion('0.9.0');

    await addDeployment(failed, SlateDeploymentStatus.failed, {
      createdAt: new Date(Date.now() - 60_000),
      errorCode: 'function_bay.build_failed',
      errorMessage: 'old failure'
    });
    let latest = await addDeployment(failed, SlateDeploymentStatus.failed, {
      errorCode: 'function_bay.build_failed',
      errorMessage: 'npm ERR! missing script: build',
      pendingReason: 'Waiting for cluster capacity: Unschedulable'
    });

    let page = await slatesHubClient.slateVersion.list({
      slateId: slate.id,
      registryVersionIds: [failed.versionIdOnRegistry],
      status: [SlateVersionStatus.deployment_failed]
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: failed.id,
      willBeCurrent: true,
      latestDeployment: {
        id: latest.id,
        status: 'failed',
        error: {
          code: 'function_bay.build_failed',
          message: 'npm ERR! missing script: build'
        },
        pendingReason: 'Waiting for cluster capacity: Unschedulable',
        isCancelledByRedeploy: false
      }
    });

    let none = await slatesHubClient.slateVersion.list({
      slateId: slate.id,
      status: [SlateVersionStatus.active]
    });
    expect(none.items).toHaveLength(0);
  });

  it('lists failed and stalled target versions as issues', async () => {
    let { slate, addVersion, backdate } = await setup();

    let failed = await addVersion('2.0.0', {
      status: SlateVersionStatus.discovery_failed,
      willBeCurrent: true
    });
    let stalled = await addVersion('1.9.0', {
      status: SlateVersionStatus.deploying,
      isCurrent: true
    });
    await backdate(stalled, 45);

    let recent = await addVersion('1.8.0', {
      status: SlateVersionStatus.deploying,
      willBeCurrent: true
    });
    let superseded = await addVersion('1.7.0', {
      status: SlateVersionStatus.deployment_failed
    });

    let issues = await listAll(page =>
      slatesHubClient.slateVersion.listIssues({ ...page, slateId: slate.id })
    );
    let ids = issues.map(i => i.id);

    expect(ids).toEqual(expect.arrayContaining([failed.id, stalled.id]));
    expect(ids).not.toContain(recent.id);
    expect(ids).not.toContain(superseded.id);

    let strict = await listAll(page =>
      slatesHubClient.slateVersion.listIssues({
        ...page,
        slateId: slate.id,
        stalledAfterMinutes: 60
      })
    );
    expect(strict.map(i => i.id)).not.toContain(stalled.id);
  });

  it('rebuilds a version and cancels its in-flight deployments', async () => {
    let { slate, addVersion, addDeployment } = await setup();

    let version = await addVersion('3.0.0', {
      status: SlateVersionStatus.deploying,
      willBeCurrent: true
    });
    let inFlight = await addDeployment(version, SlateDeploymentStatus.running);

    let res = await slatesHubClient.slateVersion.deploy({
      slateId: slate.id,
      slateVersionId: version.id
    });
    expect(res).toMatchObject({ slateVersionId: version.id, queuedAt: expect.anything() });

    let cancelled = await testDb.slateDeployment.findUniqueOrThrow({
      where: { oid: inFlight.oid }
    });
    expect(cancelled).toMatchObject({
      status: SlateDeploymentStatus.failed,
      isCancelledByRedeploy: true,
      errorCode: 'cancelled_by_redeploy'
    });
    expect(cancelled.endedAt).not.toBeNull();

    let presented = await slatesHubClient.slateDeployment.get({
      slateId: slate.id,
      slateDeploymentId: inFlight.id
    });
    expect(presented).toMatchObject({
      isCancelledByRedeploy: true,
      functionDeploymentId: null,
      endedAt: expect.anything()
    });
  });
});
