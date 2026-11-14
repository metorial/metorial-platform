import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { shuttleClient } from './client';
import { fixtures } from './fixtures';
import { db } from '../src/db';

describe('shuttle tenant', () => {
  let f = fixtures(db);

  it('creates a tenant', async () => {
    let identifier = uniqueId('tenant');
    let result = await shuttleClient.tenant.upsert({ identifier, name: 'New Tenant' });

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier,
      name: 'New Tenant',
      createdAt: expect.any(Date)
    });
  });

  it('updates an existing tenant with the same identifier', async () => {
    let identifier = uniqueId('tenant');
    let created = await shuttleClient.tenant.upsert({ identifier, name: 'Original Name' });
    let result = await shuttleClient.tenant.upsert({ identifier, name: 'Updated Name' });

    expect(result).toMatchObject({
      id: created.id,
      identifier,
      name: 'Updated Name',
      createdAt: created.createdAt
    });
  });

  it('gets a tenant by id', async () => {
    let tenant = await f.tenant.default();
    let result = await shuttleClient.tenant.get({ tenantId: tenant.id });

    expect(result).toMatchObject({
      id: tenant.id,
      identifier: tenant.identifier,
      name: tenant.name
    });
  });
});
