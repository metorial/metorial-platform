import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerTestClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('tenant.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts and fetches a tenant', async () => {
    let anonymousClient = createSubspaceControllerTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-solution'
    });

    let client = createSubspaceControllerTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });

    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-tenant',
      logRetentionInDays: 14,
      environments: [
        {
          name: 'Development',
          identifier: 'test-tenant-dev',
          type: 'development'
        }
      ]
    });

    expect(tenant).toMatchObject({
      id: expect.any(String),
      identifier: 'test-tenant',
      name: 'Test Tenant',
      logRetentionInDays: 14,
      allowAuthConfigExport: false,
      allowAuthConfigImport: false,
      createdAt: expect.any(Date)
    });

    let updated = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-tenant',
      allowAuthConfigExport: true,
      allowAuthConfigImport: true,
      environments: []
    });

    expect(updated).toMatchObject({
      allowAuthConfigExport: true,
      allowAuthConfigImport: true
    });

    let fetched = await client.tenant.get({
      tenantId: tenant.id,
      environmentId: 'test-tenant-dev'
    });

    expect(fetched).toMatchObject({
      id: tenant.id,
      identifier: tenant.identifier,
      name: tenant.name,
      logRetentionInDays: 14,
      allowAuthConfigExport: true,
      allowAuthConfigImport: true
    });
  });
});
