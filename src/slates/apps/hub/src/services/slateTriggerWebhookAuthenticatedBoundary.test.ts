import { describe, expect, it, vi } from 'vitest';

let resolvePath = vi.hoisted(() => vi.fn());

vi.mock('./slateTriggerReceiverSecret', () => ({
  slateTriggerReceiverSecretService: {
    resolvePathActiveAndRetiring: resolvePath
  }
}));

import {
  authenticateReceiverRouteBoundary,
  persistableAuthenticatedBoundary
} from './slateTriggerWebhookAuthenticatedBoundary';

describe('trusted webhook authentication boundary', () => {
  it('persists only a service-issued, owner-bound successful path authentication', async () => {
    resolvePath.mockResolvedValue([
      {
        secret: { id: 'secret-1', secretVersion: 2 },
        plaintext: 'valid-path-secret'
      }
    ]);
    let tenant = { id: 'tenant-1' } as any;
    await expect(
      authenticateReceiverRouteBoundary({
        tenant,
        receiverId: 'receiver-1',
        supplied: 'wrong'
      })
    ).resolves.toBeNull();
    let trusted = await authenticateReceiverRouteBoundary({
      tenant,
      receiverId: 'receiver-1',
      supplied: 'valid-path-secret',
      now: new Date('2026-08-14T12:00:00.000Z')
    });
    expect(
      persistableAuthenticatedBoundary({
        boundary: trusted!,
        tenantId: 'tenant-1',
        receiverId: 'receiver-1'
      })
    ).toEqual({
      authenticatedBoundaryKind: 'receiver_route',
      authenticatedBoundaryAt: new Date('2026-08-14T12:00:00.000Z'),
      authenticatedBindingHash: expect.stringMatching(/^[a-f0-9]{64}$/)
    });
    expect(() =>
      persistableAuthenticatedBoundary({
        boundary: { ...trusted! },
        tenantId: 'tenant-1',
        receiverId: 'receiver-1'
      })
    ).toThrow('untrusted');
    expect(() =>
      persistableAuthenticatedBoundary({
        boundary: trusted!,
        tenantId: 'tenant-1',
        receiverId: 'receiver-2'
      })
    ).toThrow('owner-mismatched');
  });
});
