import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { forge } from './client';

describe('forge tenant', () => {
  it('upserts a tenant by identifier', async () => {
    let identifier = uniqueId('tenant');

    let created = await forge.tenant.upsert({ identifier, name: 'New Tenant' });
    expect(created).toMatchObject({ identifier, name: 'New Tenant' });

    let updated = await forge.tenant.upsert({ identifier, name: 'Updated Name' });
    expect(updated).toMatchObject({ id: created.id, name: 'Updated Name' });

    let rows = await db.tenant.findMany({ where: { identifier } });
    expect(rows).toHaveLength(1);
  });

  it('gets a tenant by id', async () => {
    let identifier = uniqueId('tenant');
    let created = await forge.tenant.upsert({ identifier, name: 'Fetch Me' });

    let fetched = await forge.tenant.get({ tenantId: created.id });
    expect(fetched).toMatchObject({ id: created.id, identifier, name: 'Fetch Me' });
  });

  it('rejects an unknown tenant', async () => {
    await expect(forge.tenant.get({ tenantId: 'tenant_missing' })).rejects.toThrow();
  });
});
