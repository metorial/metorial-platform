import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/module-flags', () => ({
  disabledFlag: (reason: string) => ({ enabled: false, reason }),
  isFlagEnabled: (flag: any) => flag === true
}));

import { disabledFlag } from '@metorial/module-flags';
import { v1FlagsPresenter } from './flags';

describe('flags presenter', () => {
  it('keeps disabled reasons internal and presents boolean values', async () => {
    let result = await v1FlagsPresenter
      .present(
        {
          flags: {
            'test-flag': true,
            'callbacks-enabled': disabledFlag('Callbacks are disabled for this project.')
          } as any
        },
        {
          apiVersion: 'mt_2025_01_01_dashboard',
          accessType: 'user_auth_token'
        }
      )
      .run();

    expect(result.flags.find(flag => flag.slug === 'callbacks-enabled')).toEqual({
      slug: 'callbacks-enabled',
      value: false
    });
    expect(JSON.stringify(result)).not.toContain('Callbacks are disabled for this project.');
  });
});
