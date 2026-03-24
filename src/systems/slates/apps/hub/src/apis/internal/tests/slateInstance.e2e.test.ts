import { beforeEach, describe, expect, it } from 'vitest';
import { SlateStatus } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateInstance:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns instances for a tenant', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });
    const instance = await f.slateInstance.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    await f.slateInstance.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    const result = await slatesHubClient.slateInstance.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'slate.instance',
      id: instance.id,
      slateId: slate.id,
      lockedSlateVersionId: null,
      config: {},
      error: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const tenant = await f.tenant.default();
    const slate1 = await f.slate.complete({ slateIdentifier: 'slate-1' });
    const slate2 = await f.slate.complete({ slateIdentifier: 'slate-2' });

    const instance1 = await f.slateInstance.default({
      slateOid: slate1.oid,
      tenantOid: tenant.oid
    });
    await f.slateInstance.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid
    });

    const result = await slatesHubClient.slateInstance.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(instance1.id);
  });
});

describe('slateInstance:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single instance by ID', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });
    const instance = await f.slateInstance.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    const result = await slatesHubClient.slateInstance.get({
      tenantId: tenant.id,
      slateInstanceId: instance.id
    });

    expect(result).toMatchObject({
      id: instance.id,
      slateId: slate.id
    });
  });
});

describe('slateInstance:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple instances by IDs', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete();

    const instance1 = await f.slateInstance.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });
    const instance2 = await f.slateInstance.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    const result = await slatesHubClient.slateInstance.getMany({
      tenantId: tenant.id,
      slateInstanceIds: [instance1.id, instance2.id]
    });

    expect(result).toMatchObject([{ id: instance1.id }, { id: instance2.id }]);
  });
});
