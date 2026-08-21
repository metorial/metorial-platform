import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('provisioned app projection RPC contract', () => {
  it('exposes only tenant-authenticated metadata projection operations', () => {
    let source = readFileSync(new URL('./provisionedAppProjection.ts', import.meta.url), 'utf8');
    expect(source).toContain('upsertRoute: tenantApp');
    expect(source).toContain('upsertTenantApp: tenantApp');
    expect(source).toContain('get: tenantApp');
    expect(source).toContain('tenantId: ctx.tenant.id');
    expect(source).not.toMatch(/ciphertext|plaintext|secretVersion|revoke|delete/i);
  });

  it('binds route credential resolution to the authenticated tenant', () => {
    let source = readFileSync(
      new URL('../../services/slateTriggerReceiverSecretProjection.ts', import.meta.url),
      'utf8'
    );
    expect(source).toContain('expectedTenantOid');
    expect(source).toContain('oauthCredentials.tenantOid !== d.expectedTenantOid');
    expect(source).toContain('authConfig.tenantOid !== d.expectedTenantOid');
  });
});
