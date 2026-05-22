import { beforeEach, describe, expect, it } from 'vitest';
import { adminService } from '../../../../services/admin';
import { cleanDatabase } from '../../../../test/setup';

describe('ares app.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('upserts an app by slug', async () => {
    let created = await adminService.upsertApp({
      slug: 'test-app',
      defaultRedirectUrl: 'https://example.com/callback',
      redirectDomains: ['example.com']
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      slug: 'test-app',
      defaultRedirectUrl: 'https://example.com/callback'
    });

    let updated = await adminService.upsertApp({
      slug: 'test-app',
      defaultRedirectUrl: 'https://example.com/updated',
      redirectDomains: ['example.com', '*.example.com']
    });

    expect(updated.id).toBe(created.id);
    expect(updated.defaultRedirectUrl).toBe('https://example.com/updated');

    let fetched = await adminService.getApp({ appId: created.id });
    expect(fetched.slug).toBe('test-app');
  });
});
