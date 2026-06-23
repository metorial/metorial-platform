import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { signalClient } from '../../test/client';

describe('tenant.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts and fetches a tenant', async () => {
    const f = fixtures(testDb);
    const existingTenant = await f.tenant.default({ name: 'Original Tenant' });

    const fetched = await signalClient.tenant.get({ tenantId: existingTenant.id });
    expect(fetched).toMatchObject({
      id: existingTenant.id,
      identifier: existingTenant.identifier,
      name: existingTenant.name
    });

    const updated = await signalClient.tenant.upsert({
      identifier: existingTenant.identifier,
      name: 'Updated Tenant'
    });

    expect(updated).toMatchObject({
      id: existingTenant.id,
      name: 'Updated Tenant'
    });

    const fetchedUpdated = await signalClient.tenant.get({ tenantId: existingTenant.id });
    expect(fetchedUpdated.name).toBe('Updated Tenant');
  });
});
