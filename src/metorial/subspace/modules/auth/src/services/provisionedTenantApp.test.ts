import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {},
  getId: vi.fn()
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  getTenantForSlates: vi.fn(),
  slates: { provisionedAppProjection: {} }
}));

import { tombstoneProvisionedTenantAppsForCallbackInTransaction } from './provisionedTenantApp';

describe('provisioned tenant app metadata teardown', () => {
  it('projects create, update, tombstone, and use-time checks through typed Hub RPCs', () => {
    let source = readFileSync(new URL('./provisionedTenantApp.ts', import.meta.url), 'utf8');
    expect(source).toContain('provisionedAppProjection.upsertRoute');
    expect(source).toContain('provisionedAppProjection.upsertTenantApp');
    expect(source).toContain('provisionedAppProjection.get');
    expect(source).toContain("status: 'tombstoned'");
    expect(source).not.toMatch(/ciphertext|secretVersion|providerConfigPatch/i);
  });

  it('tombstones metadata without copying or mutating credential material', async () => {
    let updateMany = vi.fn().mockResolvedValue({ count: 2 });
    let now = new Date('2026-08-21T12:00:00.000Z');

    await tombstoneProvisionedTenantAppsForCallbackInTransaction(
      { provisionedTenantApp: { updateMany } } as any,
      42n,
      now
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { callbackInstanceOid: 42n, status: 'active' },
      data: {
        status: 'tombstoned',
        tombstonedAt: now,
        generation: { increment: 1 }
      }
    });
    let serialized = JSON.stringify(updateMany.mock.calls[0]![0], (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    expect(serialized).not.toMatch(/secret|ciphertext|encrypted/i);
  });
});
