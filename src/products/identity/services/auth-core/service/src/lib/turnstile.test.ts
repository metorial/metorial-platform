import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/editions', () => ({
  checkEdition: (...editions: string[]) => editions.includes('on-prem')
}));

vi.mock('./turnstileCloud', () => {
  throw new Error('The on-prem edition must never load the captcha verifier');
});

import { turnstileVerifier } from './turnstile';

describe('on-prem captcha', () => {
  it('disables captcha verification even when a token is supplied', async () => {
    expect(turnstileVerifier.enabled).toBe(false);
    await expect(turnstileVerifier.verify({ token: 'ignored' })).resolves.toBe(true);
  });
});
