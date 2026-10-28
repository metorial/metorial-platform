// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let { code, passkey, challenge } = vi.hoisted(() => ({
  code: { mutate: vi.fn(), isLoading: false, data: null, error: null },
  passkey: { mutate: vi.fn(), isLoading: false, data: null, error: null as Error | null },
  challenge: { data: { totp: true, passkey: true }, isLoading: false, error: null }
}));

vi.mock('../state/twoFactor', () => ({
  twoFactorChallengeState: { use: () => challenge },
  useTwoFactorChallengeCode: () => code,
  useTwoFactorChallengePasskey: () => passkey
}));
vi.mock('../components/layout', () => ({
  AuthLayout: (p: any) => (
    <main>
      <h1>{p.main?.title}</h1>
      <p>{p.main?.description}</p>
      {p.children}
    </main>
  )
}));
vi.mock('../components/twoFactor', () => ({
  AccountHint: (p: any) => (
    <p>
      {p.action} {p.email}
    </p>
  ),
  MethodList: (p: any) => <div>{p.children}</div>,
  MethodButton: (p: any) => <button {...p} />,
  MethodIcon: () => null,
  PasskeyAnimation: (p: any) => <div aria-label={p.state} />
}));
vi.mock('../components/codeInput', () => ({
  CodeInput: (p: any) => (
    <input
      aria-label="Verification Code"
      value={p.value}
      disabled={p.disabled}
      onInput={event => {
        let value = event.currentTarget.value;
        p.onChange?.(value);
        if (value.length === 6) p.onComplete(value);
      }}
    />
  )
}));
vi.mock('@metorial-io/ui', () => ({
  Button: ({ children, fullWidth, loading, success, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  LinkButton: (p: any) => <button {...p} />,
  Input: ({ label, ...p }: any) => (
    <label>
      {label}
      <input {...p} onInput={p.onChange} />
    </label>
  ),
  Text: ({ children }: any) => <p>{children}</p>,
  Error: ({ children }: any) => <div role="alert">{children}</div>,
  CenteredSpinner: () => null,
  Spacer: () => null
}));

import { TwoFactorChallenge } from './twoFactorChallenge';

let container: HTMLDivElement;

let root: Root;

let click = async (text: string) => {
  let button = [...container.querySelectorAll('button')].find(button =>
    button.textContent?.includes(text)
  );
  if (!button) throw new Error(`Missing button ${text}`);
  await act(async () => button.click());
};

let typeCode = async (value: string) => {
  let input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      value
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

let render = async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <TwoFactorChallenge
          authIntentId="intent"
          clientSecret="secret"
          stepId="step"
          email="user@example.com"
          onVerified={vi.fn()}
        />
      </StrictMode>
    )
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  passkey.isLoading = false;
  passkey.error = null;
  challenge.data = { totp: true, passkey: true };

  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('second-factor scenes', () => {
  it('offers both enrolled methods without primary-authentication banners', async () => {
    await render();

    expect(container.textContent).toContain('Use a Passkey');
    expect(container.textContent).toContain('Authenticator App');
    expect(container.textContent).not.toContain('Password verified');
    expect(container.textContent).not.toContain('One more step');
  });

  it('auto-submits only after all six TOTP digits are entered', async () => {
    await render();

    await click('Authenticator App');
    await typeCode('12345');
    expect(code.mutate).not.toHaveBeenCalled();
    await typeCode('123456');
    expect(code.mutate).toHaveBeenCalledExactlyOnceWith({ type: 'totp', code: '123456' });
    expect(container.textContent).not.toContain('Verify & Sign In');
  });

  it('does not submit an unchanged code twice', async () => {
    await render();

    await click('Authenticator App');
    await typeCode('123456');
    await typeCode('123456');
    expect(code.mutate).toHaveBeenCalledTimes(1);
  });

  it('auto-submits a complete recovery code', async () => {
    await render();

    await click('Recovery Code');
    await typeCode('ABCDE-FGHIJ-KLMNO-PQRST');
    expect(code.mutate).toHaveBeenCalledWith({
      type: 'recovery_code',
      code: 'ABCDE-FGHIJ-KLMNO-PQRST'
    });
  });

  it('starts passkey authentication when selected from multiple methods', async () => {
    await render();
    expect(passkey.mutate).not.toHaveBeenCalled();

    await click('Use a Passkey');

    expect(container.querySelector('h1')?.textContent).toBe('Sign in with your passkey');
    expect(passkey.mutate).toHaveBeenCalledTimes(1);
  });

  it('automatically starts authentication when passkey is the only enrolled method', async () => {
    challenge.data.totp = false;

    await render();

    expect(container.querySelector('h1')?.textContent).toBe('Sign in with your passkey');
    expect(passkey.mutate).toHaveBeenCalledTimes(1);
  });

  it('disables the passkey button while authentication is pending', async () => {
    await render();
    await click('Use a Passkey');

    passkey.isLoading = true;
    await render();
    await click('Use Passkey');

    let button = [...container.querySelectorAll('button')].find(button =>
      button.textContent?.includes('Use Passkey')
    );
    expect(button?.disabled).toBe(true);
    expect(passkey.mutate).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'offers a restart after cancellation with TOTP enrolled: %s',
    async totp => {
      challenge.data.totp = totp;
      await render();
      if (totp) await click('Use a Passkey');

      passkey.isLoading = true;
      await render();
      passkey.isLoading = false;
      passkey.error = new Error('The user cancelled the passkey prompt');
      await render();

      expect(passkey.mutate).toHaveBeenCalledTimes(1);
      await click('Restart Passkey Authentication');
      expect(passkey.mutate).toHaveBeenCalledTimes(2);
    }
  );

  it('automatically opens the authenticator when it is the only enrolled method', async () => {
    challenge.data.passkey = false;

    await render();

    expect(container.querySelector('h1')?.textContent).toBe('Enter your authenticator code');
    expect(container.querySelector('input')).not.toBeNull();
    expect(container.textContent).not.toContain('Authenticator App');
    expect(passkey.mutate).not.toHaveBeenCalled();
  });

  it('offers recovery and sign-in links directly from a challenge', async () => {
    await render();
    await click('Authenticator App');

    expect(container.textContent).toContain('Use a Recovery Code or go back to Sign In');
    expect(container.textContent).not.toContain('Try Another Method');
    await click('Recovery Code');

    expect(container.querySelector('h1')?.textContent).toBe('Use a recovery code');
    expect(container.textContent).toContain('Go back to Sign In');
  });
});
