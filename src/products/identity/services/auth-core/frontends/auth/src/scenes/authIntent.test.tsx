// @vitest-environment jsdom
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let { loader, mutators } = vi.hoisted(() => ({
  loader: { data: null as any },
  mutators: {
    verifyStep: vi.fn(),
    createUser: vi.fn(),
    verifyCaptcha: vi.fn(),
    complete: vi.fn(),
    resendStep: vi.fn(),
    requestEmailCode: vi.fn()
  }
}));

vi.mock('./twoFactorChallenge', () => ({ TwoFactorChallenge: () => null }));

vi.mock('../state/authIntent', () => ({
  authIntentState: {
    use: () => ({ data: loader.data, isLoading: false, error: null, mutators })
  }
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@lowerdeck/canonicalize', () => ({ canonicalize: vi.fn() }));
vi.mock('@lowerdeck/memo', () => ({ memo: vi.fn() }));
vi.mock('@lowerdeck/sentry', () => ({ getSentry: () => ({}) }));
vi.mock('@metorial/util-endpoint', () => ({ isMetorialSDKError: () => false }));
vi.mock('../components/layout', () => ({
  AuthLayout: (p: any) => (
    <div>
      {p.main?.title}
      {p.children}
    </div>
  )
}));
vi.mock('../components/codeInput', () => ({
  CodeInput: (p: any) => (
    <input
      aria-label="Verification Code"
      disabled={p.disabled}
      onInput={event => p.onComplete(event.currentTarget.value)}
    />
  )
}));
vi.mock('@marsidev/react-turnstile', () => ({ Turnstile: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@metorial-io/ui', () => ({
  Button: ({ children, loading, success, fullWidth, variant, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  LinkButton: (p: any) => <button {...p} />,
  Input: ({ label, ...p }: any) => (
    <label>
      {label}
      <input {...p} onInput={p.onChange} />
    </label>
  ),
  Error: ({ children }: any) => <div role="alert">{children}</div>,
  CenteredSpinner: () => null,
  Spacer: () => null,
  Switch: () => null
}));

import { AuthIntentScene } from './authIntent';

let container: HTMLDivElement;

let root: Root;

let render = async () => {
  await act(async () => {
    root.render(
      <AuthIntentScene authIntentId="intent_1" authIntentClientSecret="test_secret" />
    );
  });
};

let step = (type: 'password' | 'email_code', sentAt?: Date) => ({
  id: 'step_1',
  status: 'current',
  type,
  email: 'user@example.com',
  codes: sentAt ? [{ id: 'code_1', createdAt: sentAt }] : []
});

let resendButton = () =>
  Array.from(container.querySelectorAll('button')).find(
    button => button.textContent == 'Resend Code'
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  loader.data = { status: 'needs_verification', captcha: null, steps: [step('password')] };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('password to email-code transition', () => {
  it('starts the resend cooldown from the fallback code even after waiting on the password screen', async () => {
    await render();
    await act(async () => vi.advanceTimersByTime(3 * 60 * 1000));
    expect(resendButton()).toBeUndefined();

    loader.data = { ...loader.data, steps: [step('email_code', new Date())] };
    await render();
    expect(resendButton()).toBeUndefined();

    await act(async () => vi.advanceTimersByTime(29000));
    expect(resendButton()).toBeUndefined();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(resendButton()).toBeDefined();
  });

  it('restarts the cooldown after a new resend code arrives', async () => {
    loader.data.steps = [step('email_code', new Date(Date.now() - 30000))];
    await render();
    expect(resendButton()).toBeDefined();

    loader.data = { ...loader.data, steps: [step('email_code', new Date())] };
    await render();
    expect(resendButton()).toBeUndefined();

    await act(async () => vi.advanceTimersByTime(30000));
    expect(resendButton()).toBeDefined();
  });

  it('does not offer resend without an email code', async () => {
    loader.data.steps = [step('email_code')];
    await render();
    await act(async () => vi.advanceTimersByTime(3 * 60 * 1000));
    expect(resendButton()).toBeUndefined();
  });

  it('clears a password error on fallback and still shows email-code errors', async () => {
    mutators.verifyStep.mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'The password you entered is incorrect.' }))
    );
    await render();
    let input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    await act(async () => {
      input.value = 'incorrect password';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain('The password you entered is incorrect.');

    mutators.requestEmailCode.mockImplementationOnce(async () => {
      loader.data = { ...loader.data, steps: [step('email_code', new Date())] };
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find(button => button.textContent == 'Send Me a Code Instead')!
        .click();
    });
    await render();
    expect(container.textContent).not.toContain('The password you entered is incorrect.');

    mutators.verifyStep.mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'The code you entered is incorrect.' }))
    );
    await act(async () => {
      let codeInput = container.querySelector<HTMLInputElement>(
        'input[aria-label="Verification Code"]'
      )!;
      codeInput.value = '123456';
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('The code you entered is incorrect.');
  });
});
