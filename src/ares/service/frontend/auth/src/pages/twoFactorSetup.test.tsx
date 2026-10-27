// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let { state, mutations } = vi.hoisted(() => ({
  state: { data: null as any, error: null as any },
  mutations: Object.fromEntries(
    ['confirmTotp', 'register', 'confirmPasskey', 'recoveryCodes', 'cancel'].map(name => [
      name,
      { mutate: vi.fn(), data: null as any, isLoading: false, isSuccess: false, error: null }
    ])
  )
}));

vi.mock('@metorial-io/data-hooks', () => ({
  useMutation: (value: unknown) => value,
  useForm: () => ({
    getFieldProps: () => ({ value: 'My Passkey', onChange: vi.fn() }),
    RenderError: () => null,
    handleSubmit: vi.fn()
  })
}));
vi.mock('../state/twoFactor', () => ({
  twoFactorSetupState: { use: () => ({ ...state, mutators: mutations, refetch: vi.fn() }) }
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
  SetupPanel: (p: any) => <div>{p.children}</div>
}));
vi.mock('../components/codeInput', () => ({
  CodeInput: (p: any) => (
    <input
      aria-label="Verification Code"
      onInput={event => {
        if (event.currentTarget.value.length === 6) p.onComplete(event.currentTarget.value);
      }}
    />
  )
}));
vi.mock('@metorial-io/ui', () => ({
  Button: ({ children, fullWidth, loading, success, variant, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  LinkButton: (p: any) => <button {...p} />,
  Input: ({ label, ...p }: any) => (
    <label>
      {label}
      <input {...p} />
    </label>
  ),
  Text: ({ children }: any) => <p>{children}</p>,
  Error: ({ children }: any) => <div role="alert">{children}</div>,
  CenteredSpinner: () => null,
  Spacer: () => null,
  Switch: () => null,
  theme: { colors: { gray300: '#ddd' } }
}));

import { TwoFactorSetup } from './twoFactorSetup';

let container: HTMLDivElement;

let root: Root;

let render = async () => {
  await act(async () => root.render(<TwoFactorSetup />));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = 'setup_id=setup&client_secret=secret';
  mutations.register!.data = null;
  state.data = { status: 'pending', method: 'passkey', email: 'user@example.com' };
  state.error = null;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  sessionStorage.clear();
});

describe('setup layout', () => {
  it('collapses the setup explanation when the passkey naming form appears', async () => {
    await render();
    expect(container.textContent).toContain('Built into your device');
    expect(container.textContent).toContain('Create Passkey');
    mutations.register!.data = { id: 'credential' };
    await render();
    expect(container.textContent).toContain('Setting up a passkey for user@example.com');
    expect(container.textContent).toContain('Name Your Passkey');
    expect(container.textContent).not.toContain('Built into your device');
    expect(container.textContent).not.toContain('Or use a security key');
    expect(container.textContent).not.toContain('Create Passkey');
    expect(container.textContent).not.toContain('Passkey created');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('removes the setup capability from the URL', async () => {
    await render();
    expect(window.location.hash).toBe('');
    expect(sessionStorage.getItem('two-factor:setup')).toBe('secret');
  });

  it('shows expired setup without a header icon or extra status copy', async () => {
    state.error = { data: { code: 'two_factor_invalid' } };
    await render();
    expect(container.querySelector('h1')?.textContent).toBe('Let’s start again');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).not.toContain('Nothing was changed');
  });
});
