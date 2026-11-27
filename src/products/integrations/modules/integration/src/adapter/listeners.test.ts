import { afterEach, describe, expect, it, vi } from 'vitest';

describe('adapter listeners', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('throws when registering the same adapter type twice', async () => {
    let { registerAdapterListener } = await import('./listeners');
    registerAdapterListener('chat', {});
    expect(() => registerAdapterListener('chat', {})).toThrow(
      'Adapter listener for type "chat" is already registered'
    );
  });

  it('dispatches provider sync events to the registered listener', async () => {
    let { notifyAdapterProvidersSynced, registerAdapterListener } = await import('./listeners');
    let onProvidersSynced = vi.fn();
    registerAdapterListener('chat', { onProvidersSynced });

    await notifyAdapterProvidersSynced({
      tenant: { oid: 1n } as any,
      environment: { oid: 2n } as any,
      cause: 'integration',
      adapterIntegration: { type: 'chat', oid: 10n } as any,
      providers: [{ oid: 20n }] as any
    });

    expect(onProvidersSynced).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: 'integration',
        providers: [{ oid: 20n }]
      })
    );
  });

  it('skips callbacks that are not implemented', async () => {
    let { notifyAdapterProvidersSynced, registerAdapterListener } = await import('./listeners');
    registerAdapterListener('chat', {});

    await expect(
      notifyAdapterProvidersSynced({
        tenant: { oid: 1n } as any,
        environment: { oid: 2n } as any,
        cause: 'integration',
        adapterIntegration: { type: 'chat', oid: 10n } as any,
        providers: []
      })
    ).resolves.toBeUndefined();
  });
});
