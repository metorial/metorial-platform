import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-flags', () => ({
  isFlagEnabled: (flag: unknown) => flag === true
}));

let context = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'user_auth_token'
} as const;

let { v1FlagsPresenter } = await import('./flags');

describe('v1FlagsPresenter', () => {
  it('only exposes boolean flags', async () => {
    let flags = {
      'paid-sandboxes': true,
      'sandbox-enabled': false,
      'sandbox-builder-memory-mib': 8192
    } as any;

    let result = await v1FlagsPresenter.present({ flags }, context).run();

    expect(result.flags).toEqual([
      { slug: 'paid-sandboxes', value: true },
      { slug: 'sandbox-enabled', value: false }
    ]);
  });
});
