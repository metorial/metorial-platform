import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { voyager } from './client';

describe('voyager tenant', () => {
  it('upserts a tenant idempotently by identifier', async () => {
    let identifier = uniqueId('tenant');

    let created = await voyager.tenant.upsert({ identifier });
    expect(created).toMatchObject({ object: 'voyager#tenant', identifier });
    expect(created.id).toMatch(/^vtn_/);

    let again = await voyager.tenant.upsert({ identifier, name: 'ignored' });
    expect(again.id).toBe(created.id);

    let rows = await db.tenant.findMany({ where: { identifier } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(created.id);
  });

  it('gets a tenant by id and by identifier', async () => {
    let identifier = uniqueId('tenant');
    let created = await voyager.tenant.upsert({ identifier });

    expect(await voyager.tenant.get({ tenantId: created.id })).toMatchObject({
      id: created.id,
      identifier
    });
    expect(await voyager.tenant.get({ tenantId: identifier })).toMatchObject({
      id: created.id,
      identifier
    });
  });

  it('keeps tenants with different identifiers apart', async () => {
    let a = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    let b = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    expect(a.id).not.toBe(b.id);
  });

  it('rejects an unknown tenant', async () => {
    await expect(voyager.tenant.get({ tenantId: uniqueId('missing') })).rejects.toThrow();
  });

  it('rejects invalid input', async () => {
    await expect(voyager.tenant.upsert({} as any)).rejects.toThrow();
    await expect(voyager.tenant.get({} as any)).rejects.toThrow();
  });
});
