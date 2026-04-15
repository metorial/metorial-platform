import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgeClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

vi.mock('../../providers/aws-codebuild', () => ({
  startAwsCodeBuildQueue: { add: vi.fn().mockResolvedValue({ id: 'test-job' }) }
}));

vi.mock('../../storage', () => ({
  storage: {
    putObject: vi.fn().mockResolvedValue({ storageKey: 'test-key' }),
    getObject: vi.fn().mockResolvedValue({ data: Buffer.from('') }),
    getPublicURL: vi.fn().mockResolvedValue({ url: 'http://example.com/artifact' }),
    upsertBucket: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('tenant:upsert E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new tenant', async () => {
    const result = await forgeClient.tenant.upsert({
      identifier: 'new-tenant',
      name: 'New Tenant'
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: 'new-tenant',
      name: 'New Tenant',
      createdAt: expect.any(Date)
    });
  });

  it('updates existing tenant with same identifier', async () => {
    await forgeClient.tenant.upsert({
      identifier: 'existing-tenant',
      name: 'Original Name'
    });

    const result = await forgeClient.tenant.upsert({
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

    const result = await forgeClient.tenant.get({
      tenantId: tenant.id
    });

    expect(result).toMatchObject({
      id: tenant.id,
      identifier: tenant.identifier,
      name: tenant.name,
      createdAt: expect.any(Date)
    });
  });
});
