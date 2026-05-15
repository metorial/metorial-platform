import { beforeEach, describe, expect, it } from 'vitest';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('cargo tenant.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts a tenant and its environment', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-alpha',
      name: 'Tenant Alpha'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'dev',
      name: 'Development',
      type: 'development'
    });

    expect(tenant).toMatchObject({
      id: expect.any(String),
      identifier: 'tenant-alpha',
      name: 'Tenant Alpha'
    });

    expect(environment).toMatchObject({
      id: expect.any(String),
      identifier: 'dev',
      name: 'Development',
      type: 'development'
    });

    let fetched = await cargoClient.tenant.get({
      tenantId: tenant.id
    });

    expect(fetched.environments).toHaveLength(1);
    expect(fetched.environments[0]).toMatchObject({
      id: environment.id,
      identifier: 'dev',
      name: 'Development'
    });
  });
});
