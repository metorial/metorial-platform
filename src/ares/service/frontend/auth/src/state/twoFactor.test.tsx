// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let { api, startAuthentication } = vi.hoisted(() => ({
  api: {
    loginOptions: vi.fn(),
    authenticationOptions: vi.fn(),
    verify: vi.fn()
  },
  startAuthentication: vi.fn()
}));

vi.mock('./client', () => ({ authClient: { twoFactor: api } }));
vi.mock('@lowerdeck/memo', () => import('../../../../../../lowerdeck/packages/memo/src/memo'));
vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => ({ captureException: vi.fn() }) }));
vi.mock('@metorial-io/ui', () => ({ Error: () => null, CenteredSpinner: () => null }));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication,
  startRegistration: vi.fn()
}));

import {
  twoFactorChallengeState,
  useTwoFactorChallengeCode,
  useTwoFactorChallengePasskey,
  type TwoFactorChallengeCredentials
} from './twoFactor';

let container: HTMLDivElement;

let root: Root;

let sequence = 0;

let credentials: TwoFactorChallengeCredentials;

let code: ReturnType<typeof useTwoFactorChallengeCode>;

let passkey: ReturnType<typeof useTwoFactorChallengePasskey>;

let Challenge = () => {
  let challenge = twoFactorChallengeState.use(credentials);
  code = useTwoFactorChallengeCode(credentials);
  passkey = useTwoFactorChallengePasskey(credentials);

  return <div>{challenge.error ? 'Invalid challenge' : 'Challenge'}</div>;
};

beforeEach(async () => {
  vi.clearAllMocks();
  credentials = {
    authIntentId: `intent-${++sequence}`,
    clientSecret: 'secret',
    stepId: 'step'
  };
  api.loginOptions.mockResolvedValue({ totp: true, passkey: true });
  api.authenticationOptions.mockResolvedValue({ challenge: 'webauthn-challenge' });
  startAuthentication.mockResolvedValue({ id: 'credential' });
  api.verify.mockResolvedValue({ status: 'verified' });

  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  await act(async () => root.render(<Challenge />));
  expect(api.loginOptions).toHaveBeenCalledTimes(1);

  api.loginOptions.mockRejectedValue(new Error('Verification is no longer valid'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('second-factor verification requests', () => {
  it.each(['totp', 'recovery_code'] as const)(
    'does not refetch consumed login options after %s verification',
    async type => {
      await act(async () => {
        await code.mutate({ type, code: '123456' });
      });

      expect(api.verify).toHaveBeenCalledExactlyOnceWith({
        ...credentials,
        input: { type, code: '123456' }
      });
      expect(code.data).toEqual({ status: 'verified' });
      expect(api.loginOptions).toHaveBeenCalledTimes(1);
      expect(container.textContent).not.toContain('Invalid challenge');
    }
  );

  it('does not refetch consumed login options after passkey verification', async () => {
    await act(async () => {
      await passkey.mutate();
    });

    expect(api.authenticationOptions).toHaveBeenCalledExactlyOnceWith(credentials);
    expect(startAuthentication).toHaveBeenCalledExactlyOnceWith({
      optionsJSON: { challenge: 'webauthn-challenge' }
    });
    expect(api.verify).toHaveBeenCalledExactlyOnceWith({
      ...credentials,
      input: { type: 'passkey', response: { id: 'credential' } }
    });
    expect(passkey.data).toEqual({ status: 'verified' });
    expect(api.loginOptions).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Invalid challenge');
  });
});
