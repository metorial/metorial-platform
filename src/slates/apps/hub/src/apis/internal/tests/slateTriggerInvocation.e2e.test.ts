import { beforeEach, describe, expect, it } from 'vitest';
import { SlateTriggerInvocationType } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateTriggerInvocation:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns trigger invocations for a tenant', async () => {
    const { triggerInvocation, tenant, receiver, receiverTrigger, invocation } =
      await f.slateTriggerInvocation.complete();

    const invocation2 = await f.slateInvocation.succeeded({
      deploymentOid: invocation.deploymentOid
    });
    await f.slateTriggerInvocation.default({
      receiverOid: receiver.oid,
      receiverTriggerOid: receiverTrigger.oid,
      invocationOid: invocation2.oid
    });

    const result = await slatesHubClient.slateTriggerInvocation.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: triggerInvocation.id,
      type: SlateTriggerInvocationType.poll,
      createdAt: expect.any(Date)
    });
  });

  it('filters by triggerReceiverIds', async () => {
    const {
      triggerInvocation: inv1,
      tenant,
      receiver: receiver1
    } = await f.slateTriggerInvocation.complete();
    await f.slateTriggerInvocation.complete();

    const result = await slatesHubClient.slateTriggerInvocation.list({
      tenantId: tenant.id,
      triggerReceiverIds: [receiver1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(inv1.id);
  });

  it('filters by types', async () => {
    const { triggerInvocation, tenant } = await f.slateTriggerInvocation.complete({
      type: SlateTriggerInvocationType.webhook_handle
    });
    await f.slateTriggerInvocation.complete({
      type: SlateTriggerInvocationType.poll
    });

    const result = await slatesHubClient.slateTriggerInvocation.list({
      tenantId: tenant.id,
      types: [SlateTriggerInvocationType.webhook_handle],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(triggerInvocation.id);
  });
});

describe('slateTriggerInvocation:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single trigger invocation by ID', async () => {
    const { triggerInvocation, tenant } = await f.slateTriggerInvocation.complete({
      type: SlateTriggerInvocationType.poll
    });

    const result = await slatesHubClient.slateTriggerInvocation.get({
      tenantId: tenant.id,
      slateTriggerInvocationId: triggerInvocation.id
    });

    expect(result).toMatchObject({
      id: triggerInvocation.id,
      type: SlateTriggerInvocationType.poll
    });
  });
});
