import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { functionBay } from './client';
import { createTenant } from './fixtures';

describe('function-bay tenant', () => {
  it('creates a tenant and persists it', async () => {
    let identifier = uniqueId('tenant');
    let result = await functionBay.tenant.upsert({ identifier, name: 'New Tenant' });

    expect(result).toMatchObject({ identifier, name: 'New Tenant', createdAt: expect.any(Date) });

    let row = await db.tenant.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.identifier).toBe(identifier);
  });

  it('updates an existing tenant with the same identifier', async () => {
    let identifier = uniqueId('tenant');
    let first = await functionBay.tenant.upsert({ identifier, name: 'Original' });
    let second = await functionBay.tenant.upsert({ identifier, name: 'Updated' });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Updated');
  });

  it('marks service default tenants', async () => {
    let result = await functionBay.tenant.upsert({
      identifier: uniqueId('tenant'),
      name: 'Service Default',
      isServiceDefault: true
    });

    expect(result.isServiceDefault).toBe(true);
  });

  it('enables automatic enclave overrides', async () => {
    let result = await functionBay.tenant.upsert({
      identifier: uniqueId('tenant'),
      name: 'Auto Enclave',
      hasAutomaticEnclaveOverride: true
    });

    expect(result.hasAutomaticEnclaveOverride).toBe(true);
  });

  it('gets a tenant by id', async () => {
    let tenant = await createTenant();
    let result = await functionBay.tenant.get({ tenantId: tenant.id });

    expect(result).toMatchObject({ id: tenant.id, identifier: tenant.identifier });
  });

  it('gets a service default tenant by identifier', async () => {
    let identifier = uniqueId('tenant');
    let tenant = await functionBay.tenant.upsert({
      identifier,
      name: 'Default',
      isServiceDefault: true
    });

    let result = await functionBay.tenant.get({ tenantId: identifier });
    expect(result).toMatchObject({ id: tenant.id, isServiceDefault: true });
  });

  it('rejects an unknown tenant', async () => {
    await expect(functionBay.tenant.get({ tenantId: uniqueId('missing') })).rejects.toThrow();
  });
});
