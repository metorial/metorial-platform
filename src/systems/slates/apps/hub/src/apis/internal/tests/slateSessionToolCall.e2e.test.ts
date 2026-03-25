import { beforeEach, describe, expect, it } from 'vitest';
import { SlateSessionToolCallStatus } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateSessionToolCall:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns tool calls for a tenant', async () => {
    const { toolCall, session, version, action, tenant } =
      await f.slateSessionToolCall.complete();

    const result = await slatesHubClient.slateSessionToolCall.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: toolCall.id,
      sessionId: session.id,
      slateVersionId: version.id,
      action: {
        id: action.id,
        key: action.key,
        name: action.name
      },
      createdAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const {
      toolCall: call1,
      tenant,
      slate: slate1
    } = await f.slateSessionToolCall.complete({
      slateIdentifier: 'slate-1'
    });
    await f.slateSessionToolCall.complete({ slateIdentifier: 'slate-2' });

    const result = await slatesHubClient.slateSessionToolCall.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(call1.id);
  });
});

describe('slateSessionToolCall:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single tool call by ID', async () => {
    const { toolCall, tenant } = await f.slateSessionToolCall.complete({
      status: SlateSessionToolCallStatus.succeeded
    });

    const result = await slatesHubClient.slateSessionToolCall.get({
      tenantId: tenant.id,
      slateSessionToolCallId: toolCall.id
    });

    expect(result).toMatchObject({
      id: toolCall.id
    });
  });

  it('returns failed tool call', async () => {
    const { toolCall, tenant } = await f.slateSessionToolCall.complete({
      status: SlateSessionToolCallStatus.failed
    });

    const result = await slatesHubClient.slateSessionToolCall.get({
      tenantId: tenant.id,
      slateSessionToolCallId: toolCall.id
    });

    expect(result).toMatchObject({
      id: toolCall.id
    });
  });
});

describe('slateSessionToolCall:getLogs E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns logs for a tool call', async () => {
    const { toolCall, session, action, version, invocation, tenant } =
      await f.slateSessionToolCall.complete({ withLogs: true });

    const result = await slatesHubClient.slateSessionToolCall.getLogs({
      tenantId: tenant.id,
      slateSessionToolCallId: toolCall.id
    });

    expect(result).toMatchObject({
      id: toolCall.id,
      sessionId: session.id,
      slateVersionId: version.id,
      action: {
        id: action.id,
        key: action.key,
        name: action.name
      },
      invocation: {
        id: invocation.id
      },
      createdAt: expect.any(Date)
    });
  });
});

describe('slateSessionToolCall:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple tool calls by IDs', async () => {
    const { session, slate, version, tenant } = await f.slateSession.complete();

    const action = await f.slateSpecification.createAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      type: 'tool'
    });

    const provider = await f.deploymentProvider.default();
    const deployment = await f.slateDeployment.default({
      slateOid: slate.oid,
      slateVersionOid: version.oid,
      providerOid: provider.oid
    });
    const bucket = await f.storageBucket.default();

    const call1 = await f.slateSessionToolCall.withInvocation({
      sessionOid: session.oid,
      actionOid: action.oid,
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      versionOid: version.oid
    });
    const call2 = await f.slateSessionToolCall.withInvocation({
      sessionOid: session.oid,
      actionOid: action.oid,
      deploymentOid: deployment.oid,
      bucketOid: bucket.oid,
      versionOid: version.oid
    });

    const result = await slatesHubClient.slateSessionToolCall.getMany({
      tenantId: tenant.id,
      slateSessionToolCallIds: [call1.id, call2.id]
    });

    expect(result).toMatchObject([{ id: call1.id }, { id: call2.id }]);
  });
});
