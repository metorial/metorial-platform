import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase } from '../../test/setup';
import { voyagerClient } from '../../test/client';

describe('voyager tenant.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts and fetches a tenant', async () => {
    let created = await voyagerClient.tenant.upsert({ identifier: 'acme' });

    expect(created).toMatchObject({
      id: expect.any(String),
      identifier: 'acme'
    });

    let fetched = await voyagerClient.tenant.get({ tenantId: created.id });
    expect(fetched.identifier).toBe('acme');
  });
});
