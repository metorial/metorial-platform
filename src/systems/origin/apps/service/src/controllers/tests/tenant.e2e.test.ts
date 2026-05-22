import { beforeEach, describe, expect, it } from 'vitest';
import { originClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('origin tenant.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts a tenant by identifier', async () => {
    let created = await originClient.tenant.upsert({
      identifier: 'origin-tenant-alpha',
      name: 'Origin Tenant Alpha'
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      identifier: 'origin-tenant-alpha',
      name: 'Origin Tenant Alpha'
    });

    let updated = await originClient.tenant.upsert({
      identifier: 'origin-tenant-alpha',
      name: 'Origin Tenant Beta'
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Origin Tenant Beta');

    let fetched = await originClient.tenant.get({ tenantId: created.id });
    expect(fetched.name).toBe('Origin Tenant Beta');
  });
});
