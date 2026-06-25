import { beforeEach, describe, expect, it } from 'vitest';
import { SlateDeploymentStatus, SlateStatus } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateDeployment:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns deployments for a slate', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });
    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.succeeded({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const result = await slatesHubClient.slateDeployment.list({
      slateId: slate.id,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: deployment.id,
      status: 'succeeded',
      error: null,
      slate: {
        id: slate.id
      },
      version: {
        id: slate.currentVersion.id
      },
      createdAt: expect.any(Date)
    });
  });

  it('filters by versionIds', async () => {
    const slate = await f.slate.complete();
    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const result = await slatesHubClient.slateDeployment.list({
      slateId: slate.id,
      versionIds: [slate.currentVersion.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(deployment.id);
  });

  it('filters by status without slateId', async () => {
    const slate1 = await f.slate.complete();
    const slate2 = await f.slate.complete();
    const provider = await f.deploymentProvider.default();

    const succeeded = await f.slateDeployment.succeeded({
      slateOid: slate1.oid,
      slateVersionOid: slate1.currentVersion.oid,
      providerOid: provider.oid
    });

    await f.slateDeployment.default({
      slateOid: slate2.oid,
      slateVersionOid: slate2.currentVersion.oid,
      providerOid: provider.oid,
      status: SlateDeploymentStatus.failed
    });

    const result = await slatesHubClient.slateDeployment.list({
      status: SlateDeploymentStatus.succeeded,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(succeeded.id);
  });
});

describe('slateDeployment:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single deployment by ID', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });
    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const result = await slatesHubClient.slateDeployment.get({
      slateId: slate.id,
      slateDeploymentId: deployment.id
    });

    expect(result).toMatchObject({
      id: deployment.id,
      slate: {
        id: slate.id
      }
    });
  });
});
