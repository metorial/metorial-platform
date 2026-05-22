import { beforeEach, describe, expect, it } from 'vitest';
import { registryClient } from '../../../test/client';
import { cleanDatabase } from '../../../test/setup';

describe('slates-registry tenant.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts a tenant by identifier', async () => {
    let created = await registryClient.tenant.upsert({
      identifier: 'registry-tenant-alpha',
      name: 'Registry Tenant Alpha'
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      identifier: 'registry-tenant-alpha',
      name: 'Registry Tenant Alpha'
    });

    let updated = await registryClient.tenant.upsert({
      identifier: 'registry-tenant-alpha',
      name: 'Registry Tenant Beta'
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Registry Tenant Beta');

    let fetched = await registryClient.tenant.get({ tenantId: created.id });
    expect(fetched.name).toBe('Registry Tenant Beta');
  });
});
