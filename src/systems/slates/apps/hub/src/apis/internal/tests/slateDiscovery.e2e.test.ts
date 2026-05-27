import { beforeEach, describe, expect, it } from 'vitest';
import {
  SlateSessionToolCallStatus,
  SlateVersionDiscoveryStatus
} from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateDiscovery:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('lists discoveries and filters by status', async () => {
    const slate = await f.slate.complete();

    await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      status: SlateVersionDiscoveryStatus.succeeded
    });

    const failed = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      status: SlateVersionDiscoveryStatus.failed,
      overrides: {
        errorCode: 'build_failed',
        errorMessage: 'Build failed'
      }
    });

    const result = await slatesHubClient.slateDiscovery.list({
      slateId: slate.id,
      status: SlateVersionDiscoveryStatus.failed,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: failed.id,
      status: SlateVersionDiscoveryStatus.failed,
      slate: { id: slate.id },
      version: { id: slate.currentVersion.id }
    });
  });
});

describe('slateDiscovery:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns discovery with error code and message', async () => {
    const slate = await f.slate.complete();
    const discovery = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      status: SlateVersionDiscoveryStatus.failed,
      overrides: {
        errorCode: 'build_failed',
        errorMessage: 'Build failed'
      }
    });

    const result = await slatesHubClient.slateDiscovery.get({
      slateId: slate.id,
      slateVersionId: slate.currentVersion.id,
      slateDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      id: discovery.id,
      error: {
        code: 'build_failed',
        message: 'Build failed'
      }
    });
  });
});

describe('slateDiscovery:getSpecification E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns the discovery specification', async () => {
    const slate = await f.slate.complete();
    const discovery = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid
    });

    const result = await slatesHubClient.slateDiscovery.getSpecification({
      slateId: slate.id,
      slateVersionId: slate.currentVersion.id,
      slateDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      id: slate.currentVersion.specification.id,
      protocolVersion: '1.0'
    });
  });
});

describe('slateDiscovery:getBuildOutput E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns build output when invocation exists', async () => {
    const slate = await f.slate.complete();
    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.succeeded({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const bucket = await f.storageBucket.default();
    const invocation = await f.slateInvocation.succeeded({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      overrides: {
        providerInvocationId: 'bfi_discovery_test'
      }
    });

    const discovery = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      overrides: { invocationOid: invocation.oid }
    });

    const result = await slatesHubClient.slateDiscovery.getBuildOutput({
      slateId: slate.id,
      slateVersionId: slate.currentVersion.id,
      slateDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      logs: [{ message: 'Test invocation completed', timestamp: expect.any(Number) }],
      status: 'succeeded'
    });
    expect(result?.createdAt).toBeInstanceOf(Date);
  });
});

describe('slateDiscovery:getToolCallStats E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns aggregated tool call stats', async () => {
    let setup = await f.slateSessionToolCall.complete({
      status: SlateSessionToolCallStatus.succeeded
    });

    let discovery = await f.slateVersionDiscovery.default({
      slateVersionOid: setup.version.oid,
      specificationOid: setup.version.specification.oid
    });

    await f.slateSessionToolCall.default({
      sessionOid: setup.session.oid,
      actionOid: setup.action.oid,
      invocationOid: setup.invocation.oid,
      versionOid: setup.version.oid,
      status: SlateSessionToolCallStatus.failed
    });

    let result = await slatesHubClient.slateDiscovery.getToolCallStats({
      slateId: setup.slate.id,
      slateVersionId: setup.version.id,
      slateDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      total: 2,
      succeeded: 1,
      failed: 1,
      byTool: {
        [setup.action.key]: { total: 2, succeeded: 1, failed: 1 }
      }
    });
  });
});
