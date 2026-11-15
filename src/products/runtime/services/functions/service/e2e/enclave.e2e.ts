import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { functionBay } from './client';
import { createTenant } from './fixtures';

describe('function-bay enclave', () => {
  it('creates an enclave', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('enclave');

    let result = await functionBay.enclave.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Customer A'
    });

    expect(result).toMatchObject({ identifier, name: 'Customer A', createdAt: expect.any(Date) });

    let row = await db.enclave.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.tenantOid).toBe(tenant.oid);
  });

  it('updates an enclave with the same identifier', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('enclave');

    let first = await functionBay.enclave.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Original'
    });
    let second = await functionBay.enclave.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Updated'
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Updated');
  });

  it('gets an enclave by id and by identifier', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('enclave');
    let enclave = await functionBay.enclave.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Customer A'
    });

    for (let enclaveId of [enclave.id, identifier]) {
      let result = await functionBay.enclave.get({ tenantId: tenant.id, enclaveId });
      expect(result).toMatchObject({ id: enclave.id, identifier, name: 'Customer A' });
    }
  });

  it('does not expose an enclave to another tenant', async () => {
    let tenant = await createTenant();
    let other = await createTenant();
    let enclave = await functionBay.enclave.upsert({
      tenantId: tenant.id,
      identifier: uniqueId('enclave'),
      name: 'Private'
    });

    await expect(
      functionBay.enclave.get({ tenantId: other.id, enclaveId: enclave.id })
    ).rejects.toThrow();
  });
});
