import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { origin } from './client';
import { expectRpcError } from './errors';

describe('origin tenant', () => {
  it('upserts a tenant by identifier', async () => {
    let identifier = uniqueId('tenant');

    let created = await origin.tenant.upsert({ identifier, name: 'New Tenant' });
    expect(created).toMatchObject({
      object: 'origin#tenant',
      identifier,
      name: 'New Tenant',
      createdAt: expect.any(Date)
    });

    let updated = await origin.tenant.upsert({ identifier, name: 'Updated Name' });
    expect(updated).toMatchObject({ id: created.id, name: 'Updated Name' });

    expect(await db.tenant.count({ where: { identifier } })).toBe(1);
  });

  it('creates distinct tenants for distinct identifiers', async () => {
    let first = await origin.tenant.upsert({ identifier: uniqueId('tenant'), name: 'A' });
    let second = await origin.tenant.upsert({ identifier: uniqueId('tenant'), name: 'A' });

    expect(first.id).not.toBe(second.id);
  });

  it('gets a tenant by id and by identifier', async () => {
    let identifier = uniqueId('tenant');
    let created = await origin.tenant.upsert({ identifier, name: 'Fetch Me' });

    let byId = await origin.tenant.get({ tenantId: created.id });
    expect(byId).toMatchObject({ id: created.id, identifier, name: 'Fetch Me' });

    let byIdentifier = await origin.tenant.get({ tenantId: identifier });
    expect(byIdentifier.id).toBe(created.id);
  });

  it('does not expose internal columns', async () => {
    let created = await origin.tenant.upsert({ identifier: uniqueId('tenant'), name: 'T' });

    expect(Object.keys(created).sort()).toEqual(
      ['createdAt', 'id', 'identifier', 'name', 'object'].sort()
    );
  });

  it('rejects an unknown tenant', async () => {
    await expectRpcError(origin.tenant.get({ tenantId: uniqueId('missing') }), 'not_found');
  });

  it('rejects tenant-scoped calls for an unknown tenant', async () => {
    await expectRpcError(
      origin.codeBucket.create({ tenantId: uniqueId('missing'), purpose: 'test' }),
      'not_found'
    );
  });

  it('validates the upsert input', async () => {
    await expectRpcError(
      origin.tenant.upsert({ name: 'No Identifier' } as any),
      'invalid_data'
    );
    await expectRpcError(
      origin.tenant.upsert({ identifier: 'no-name' } as any),
      'invalid_data'
    );
    await expectRpcError(
      origin.tenant.upsert({ identifier: 5, name: 'Bad Identifier' } as any),
      'invalid_data'
    );
  });
});
