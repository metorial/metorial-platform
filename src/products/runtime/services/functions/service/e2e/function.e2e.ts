import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { functionBay } from './client';
import { createFunction, createFunctionWithVersion, createTenant } from './fixtures';

describe('function-bay function', () => {
  it('creates a function and persists it', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('function');

    let result = await functionBay.function.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'My Function'
    });

    expect(result).toMatchObject({ identifier, name: 'My Function', createdAt: expect.any(Date) });

    let row = await db.function.findUniqueOrThrow({ where: { id: result.id } });
    expect(row.tenantOid).toBe(tenant.oid);
  });

  it('updates a function with the same identifier', async () => {
    let tenant = await createTenant();
    let identifier = uniqueId('function');

    let first = await functionBay.function.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Original'
    });
    let second = await functionBay.function.upsert({
      tenantId: tenant.id,
      identifier,
      name: 'Updated'
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Updated');
  });

  it('lists only the tenant functions', async () => {
    let tenant = await createTenant();
    let other = await createTenant();
    let functions = await Promise.all(
      [0, 1, 2].map(() => createFunction({ tenantOid: tenant.oid }))
    );
    let otherFunction = await createFunction({ tenantOid: other.oid });

    let result = await functionBay.function.list({ tenantId: tenant.id, limit: 10 });
    let ids = result.items.map(item => item.id);

    expect(ids).toHaveLength(3);
    for (let func of functions) expect(ids).toContain(func.id);
    expect(ids).not.toContain(otherFunction.id);
  });

  it('gets a function by id', async () => {
    let tenant = await createTenant();
    let func = await createFunction({ tenantOid: tenant.oid });

    let result = await functionBay.function.get({ tenantId: tenant.id, functionId: func.id });
    expect(result).toMatchObject({ id: func.id, identifier: func.identifier, name: func.name });
  });

  it('does not expose a function to another tenant', async () => {
    let tenant = await createTenant();
    let other = await createTenant();
    let func = await createFunction({ tenantOid: tenant.oid });

    await expect(
      functionBay.function.get({ tenantId: other.id, functionId: func.id })
    ).rejects.toThrow();
  });

  it('updates the function name', async () => {
    let tenant = await createTenant();
    let func = await createFunction({ tenantOid: tenant.oid });

    let result = await functionBay.function.update({
      tenantId: tenant.id,
      functionId: func.id,
      name: 'Updated Function Name'
    });

    expect(result).toMatchObject({ id: func.id, name: 'Updated Function Name' });
    let row = await db.function.findUniqueOrThrow({ where: { oid: func.oid } });
    expect(row.name).toBe('Updated Function Name');
  });

  it('rejects invoking a function without deployed versions', async () => {
    let tenant = await createTenant();
    let func = await createFunction({ tenantOid: tenant.oid });

    await expect(
      functionBay.function.invoke({
        tenantId: tenant.id,
        functionId: func.id,
        payload: { input: 'test' }
      })
    ).rejects.toThrow('Function has no versions deployed');
  });

  it('records the current version on a seeded function', async () => {
    let seeded = await createFunctionWithVersion();

    let result = await functionBay.function.get({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id
    });

    expect(result.id).toBe(seeded.function.id);
  });
});
