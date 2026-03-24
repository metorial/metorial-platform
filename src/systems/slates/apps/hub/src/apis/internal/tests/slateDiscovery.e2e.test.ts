import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SlateSessionToolCallStatus,
  SlateVersionDiscoveryStatus
} from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

const buildOutputState = vi.hoisted(() => ({
  value: {
    logs: [[Date.now(), 'Discovery build log']],
    status: 'succeeded',
    createdAt: new Date()
  }
}));

vi.mock('../../../functionBay', () => ({
  functionBay: {
    tenant: {
      upsert: vi.fn(async () => ({ id: 'fb-tenant' }))
    },
    functionInvocation: {
      get: vi.fn(async () => buildOutputState.value)
    }
  },
  functionBayTenant: { id: 'fb-tenant' },
  functionBayProvider: { oid: BigInt(1) }
}));

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
      object: 'slate.discovery',
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
      object: 'slate.discovery',
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
      object: 'slate.specification',
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
    const invocation = await f.slateInvocation.default({
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid
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
      object: 'slate.discovery.build_output',
      logs: buildOutputState.value.logs,
      status: buildOutputState.value.status
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
    const { slate, version, session, action, invocation } =
      await f.slateSessionToolCall.complete();

    const discovery = await f.slateVersionDiscovery.default({
      slateVersionOid: version.oid,
      specificationOid: version.specification.oid
    });

    await f.slateSessionToolCall.default({
      sessionOid: session.oid,
      actionOid: action.oid,
      invocationOid: invocation.oid,
      versionOid: version.oid,
      status: SlateSessionToolCallStatus.failed
    });

    const result = await slatesHubClient.slateDiscovery.getToolCallStats({
      slateId: slate.id,
      slateVersionId: version.id,
      slateDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      object: 'slate.discovery.tool_call_stats',
      total: 2,
      succeeded: 1,
      failed: 1,
      byTool: {
        [action.key]: {
          total: 2,
          succeeded: 1,
          failed: 1
        }
      }
    });
  });
});
