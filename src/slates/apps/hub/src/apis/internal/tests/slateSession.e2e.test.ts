import { beforeEach, describe, expect, it } from 'vitest';

import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateSession:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns sessions for a tenant', async () => {
    const { session, instance, tenant, slate } = await f.slateSession.complete();

    await f.slateSession.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      instanceOid: instance.oid,
      versionOid: slate.currentVersion.oid
    });

    const result = await slatesHubClient.slateSession.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: session.id,
      slateId: slate.id,
      slateInstanceId: instance.id,
      createdAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const {
      session: session1,
      tenant,
      slate: slate1
    } = await f.slateSession.complete({
      slateIdentifier: 'slate-1'
    });

    const slate2 = await f.slate.complete({ slateIdentifier: 'slate-2' });
    const instance2 = await f.slateInstance.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid
    });
    await f.slateSession.default({
      slateOid: slate2.oid,
      tenantOid: tenant.oid,
      instanceOid: instance2.oid,
      versionOid: slate2.currentVersion.oid
    });

    const result = await slatesHubClient.slateSession.list({
      tenantId: tenant.id,
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(session1.id);
  });
});

describe('slateSession:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single session by ID', async () => {
    const { session, tenant, slate } = await f.slateSession.complete();

    const result = await slatesHubClient.slateSession.get({
      tenantId: tenant.id,
      slateSessionId: session.id
    });

    expect(result).toMatchObject({
      id: session.id,
      slateId: slate.id
    });
  });
});

describe('slateSession:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple sessions by IDs', async () => {
    const tenant = await f.tenant.default();
    const slate = await f.slate.complete();
    const instance = await f.slateInstance.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid
    });

    const session1 = await f.slateSession.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      instanceOid: instance.oid,
      versionOid: slate.currentVersion.oid
    });
    const session2 = await f.slateSession.default({
      slateOid: slate.oid,
      tenantOid: tenant.oid,
      instanceOid: instance.oid,
      versionOid: slate.currentVersion.oid
    });

    const result = await slatesHubClient.slateSession.getMany({
      tenantId: tenant.id,
      slateSessionIds: [session1.id, session2.id]
    });

    expect(result).toMatchObject([{ id: session1.id }, { id: session2.id }]);
  });
});
