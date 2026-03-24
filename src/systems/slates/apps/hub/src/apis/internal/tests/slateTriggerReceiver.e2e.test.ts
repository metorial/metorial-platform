import { describe, it, expect, beforeEach } from 'vitest';
import { SlateTriggerReceiverStatus } from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('slateTriggerReceiver:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns trigger receivers for a tenant', async () => {
    const { receiver, tenant, slate, instance } = await f.slateTriggerReceiver.complete();

    await f.slateTriggerReceiver.withInstance({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'slate.trigger.receiver',
      id: receiver.id,
      slateId: slate.id,
      slateInstanceId: instance.id,
      authConfigId: null,
      status: SlateTriggerReceiverStatus.active,
      name: receiver.name,
      description: receiver.description,
      eventTypes: receiver.eventTypes,
      consecutivePollingFailures: 0,
      consecutiveEventFailures: 0,
      triggers: expect.any(Array),
      destinations: expect.any(Array),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const { receiver: receiver1, tenant, slate: slate1 } = await f.slateTriggerReceiver.complete({
      slateIdentifier: 'slate-1'
    });

    const slate2 = await f.slate.complete({ slateIdentifier: 'slate-2' });
    const instance2 = await f.slateInstance.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid
    });
    await f.slateTriggerReceiver.default({
      tenantOid: tenant.oid,
      slateOid: slate2.oid,
      instanceOid: instance2.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(receiver1.id);
  });

  it('filters by slateInstanceIds', async () => {
    const { receiver: receiver1, tenant, instance: instance1 } =
      await f.slateTriggerReceiver.complete();

    const slate2 = await f.slate.complete();
    const instance2 = await f.slateInstance.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid
    });
    await f.slateTriggerReceiver.default({
      tenantOid: tenant.oid,
      slateOid: slate2.oid,
      instanceOid: instance2.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.list({
      tenantId: tenant.id,
      slateInstanceIds: [instance1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(receiver1.id);
  });
});

describe('slateTriggerReceiver:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single trigger receiver by ID', async () => {
    const { receiver, tenant, slate } = await f.slateTriggerReceiver.complete();

    const result = await slatesHubClient.slateTriggerReceiver.get({
      tenantId: tenant.id,
      slateTriggerReceiverId: receiver.id
    });

    expect(result).toMatchObject({
      object: 'slate.trigger.receiver',
      id: receiver.id,
      status: SlateTriggerReceiverStatus.active,
      slateId: slate.id,
      consecutivePollingFailures: 0,
      consecutiveEventFailures: 0
    });
  });
});

describe('slateTriggerReceiver:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple trigger receivers by IDs', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete();

    const receiver1 = await f.slateTriggerReceiver.withInstance({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });
    const receiver2 = await f.slateTriggerReceiver.withInstance({
      tenantOid: tenant.oid,
      slateOid: slate.oid
    });

    const result = await slatesHubClient.slateTriggerReceiver.getMany({
      tenantId: tenant.id,
      slateTriggerReceiverIds: [receiver1.id, receiver2.id]
    });

    expect(result).toMatchObject([{ id: receiver1.id }, { id: receiver2.id }]);
  });
});
