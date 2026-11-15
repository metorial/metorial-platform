import { describe, expect, it } from 'vitest';
import { signal } from './client';
import { createTenant } from './fixtures';

describe('signal tenant', () => {
  it('upserts and fetches a tenant', async () => {
    let existing = await createTenant('Original Tenant');

    let fetched = await signal.tenant.get({ tenantId: existing.id });
    expect(fetched).toMatchObject({
      id: existing.id,
      identifier: existing.identifier,
      name: 'Original Tenant'
    });

    let updated = await signal.tenant.upsert({
      identifier: existing.identifier,
      name: 'Updated Tenant'
    });
    expect(updated).toMatchObject({ id: existing.id, name: 'Updated Tenant' });

    let fetchedUpdated = await signal.tenant.get({ tenantId: existing.id });
    expect(fetchedUpdated.name).toBe('Updated Tenant');
  });
});
