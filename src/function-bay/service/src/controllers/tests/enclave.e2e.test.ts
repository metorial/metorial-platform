import { beforeEach, describe, expect, it } from 'vitest';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('enclave:upsert E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new enclave', async () => {
    const tenant = await f.tenant.default();

    const result = await functionBayClient.enclave.upsert({
      tenantId: tenant.id,
      identifier: 'customer-a',
      name: 'Customer A'
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: 'customer-a',
      name: 'Customer A',
      createdAt: expect.any(Date)
    });
  });

  it('updates existing enclave with same identifier', async () => {
    const tenant = await f.tenant.default();

    await functionBayClient.enclave.upsert({
      tenantId: tenant.id,
      identifier: 'customer-a',
      name: 'Original Name'
    });

    const result = await functionBayClient.enclave.upsert({
      tenantId: tenant.id,
      identifier: 'customer-a',
      name: 'Updated Name'
    });

    expect(result).toMatchObject({
      identifier: 'customer-a',
      name: 'Updated Name'
    });
  });
});

describe('enclave:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single enclave by ID', async () => {
    const tenant = await f.tenant.default();
    const enclave = await functionBayClient.enclave.upsert({
      tenantId: tenant.id,
      identifier: 'customer-a',
      name: 'Customer A'
    });

    const result = await functionBayClient.enclave.get({
      tenantId: tenant.id,
      enclaveId: enclave.id
    });

    expect(result).toMatchObject({
      id: enclave.id,
      identifier: 'customer-a',
      name: 'Customer A',
      createdAt: expect.any(Date)
    });
  });

  it('returns a single enclave by identifier', async () => {
    const tenant = await f.tenant.default();
    await functionBayClient.enclave.upsert({
      tenantId: tenant.id,
      identifier: 'customer-a',
      name: 'Customer A'
    });

    const result = await functionBayClient.enclave.get({
      tenantId: tenant.id,
      enclaveId: 'customer-a'
    });

    expect(result).toMatchObject({
      identifier: 'customer-a',
      name: 'Customer A'
    });
  });
});
