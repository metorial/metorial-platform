import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../env', () => ({ env: { turnstile: {} } }));
vi.mock('../../../lib/turnstile', () => ({ turnstileVerifier: { enabled: false } }));

import { authIntentPresenter } from './authIntent';

let intent = (verified: boolean) => ({
  id: 'intent',
  type: 'password',
  clientSecret: 'secret',
  userOid: 1n,
  verifiedAt: null,
  steps: [
    { id: 'second', type: 'two_factor', index: 1, codes: [], verifiedAt: null },
    {
      id: 'first',
      type: 'password',
      index: 0,
      codes: [],
      verifiedAt: verified ? new Date() : null
    }
  ]
});

describe('sequential authentication steps', () => {
  it('presents the primary step first regardless of database ordering', () => {
    let result = authIntentPresenter(intent(false) as never);
    expect(result.steps.map(step => [step.id, step.status])).toEqual([
      ['first', 'current'],
      ['second', 'pending']
    ]);
  });

  it('advances to the factor step after primary verification', () => {
    let result = authIntentPresenter(intent(true) as never);
    expect(result.steps.map(step => [step.id, step.status])).toEqual([
      ['first', 'complete'],
      ['second', 'current']
    ]);
    expect(result.status).toBe('needs_verification');
  });
});
