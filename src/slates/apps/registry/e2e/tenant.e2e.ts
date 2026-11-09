import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { expectRpcError, registryClient } from './helpers';

describe('tenant E2E', () => {
  it('creates a tenant and returns the same one for the same identifier', async () => {
    let identifier = uniqueId('tenant');

    let created = await registryClient.tenant.upsert({ identifier, name: 'First' });
    expect(created).toMatchObject({ object: 'tenant', identifier, name: 'First' });

    let again = await registryClient.tenant.upsert({ identifier, name: 'First' });
    expect(again.id).toBe(created.id);
  });

  it('gets a tenant by id', async () => {
    let tenant = await registryClient.tenant.upsert({
      identifier: uniqueId('tenant'),
      name: 'Gettable'
    });

    let fetched = await registryClient.tenant.get({ tenantId: tenant.id });
    expect(fetched).toMatchObject({ id: tenant.id, name: 'Gettable' });
  });

  it('rejects unknown tenants', async () => {
    await expectRpcError(
      registryClient.tenant.get({ tenantId: 'tenant_doesnotexist' }),
      'not_found'
    );
  });
});
