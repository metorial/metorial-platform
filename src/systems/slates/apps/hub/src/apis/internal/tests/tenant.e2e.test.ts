import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('tenant:upsert E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new tenant', async () => {
    const result = await slatesHubClient.tenant.upsert({
      identifier: 'new-tenant',
      name: 'New Tenant'
    });

    expect(result).toMatchObject({
      object: 'tenant',
      id: expect.any(String),
      identifier: 'new-tenant',
      name: 'New Tenant',
      createdAt: expect.any(Date)
    });
  });

  it('updates existing tenant with same identifier', async () => {
    await slatesHubClient.tenant.upsert({
      identifier: 'existing-tenant',
      name: 'Original Name'
    });

    const result = await slatesHubClient.tenant.upsert({
      identifier: 'existing-tenant',
      name: 'Updated Name'
    });

    expect(result).toMatchObject({
      identifier: 'existing-tenant',
      name: 'Updated Name'
    });
  });
});

describe('tenant:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single tenant by ID', async () => {
    const tenant = await f.tenant.default();

    const result = await slatesHubClient.tenant.get({
      tenantId: tenant.id
    });

    expect(result).toMatchObject({
      object: 'tenant',
      id: tenant.id,
      identifier: tenant.identifier,
      name: tenant.name,
      createdAt: expect.any(Date)
    });
  });
});
