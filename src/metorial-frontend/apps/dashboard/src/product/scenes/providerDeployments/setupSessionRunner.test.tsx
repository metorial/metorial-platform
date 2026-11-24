// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderSetupSessionRunner } from './setupSessionRunner';

let state = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  onCredentialError: vi.fn()
}));

vi.mock('@metorial/state', () => ({
  useCreateProviderSetupSession: () => ({ mutate: state.create }),
  useGetProviderSetupSession: () => ({ mutate: state.get })
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let runner: ReturnType<typeof useProviderSetupSessionRunner>;
let onComplete = vi.fn();
let popup: {
  closed: boolean;
  location: { href: string };
  focus: () => void;
  close: () => void;
};

let Harness = (props: { source?: 'explorer' }) => {
  runner = useProviderSetupSessionRunner({
    instanceId: 'instance',
    providerId: 'provider',
    source: props.source,
    onCredentialError: state.onCredentialError,
    onComplete
  });
  return null;
};

let session = (status: string, expiresAt = new Date(Date.now() + 30 * 60_000)) => ({
  id: 'setup_session',
  url: 'https://provider.example/oauth',
  status,
  expiresAt
});

let flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

let startSession = async () => {
  await act(async () => {
    await runner.start({ providerAuthMethodId: 'oauth' });
  });
  await flush();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  popup = { closed: false, location: { href: '' }, focus: vi.fn(), close: vi.fn() };
  vi.spyOn(window, 'open').mockImplementation(() => popup as unknown as Window);

  state.create.mockResolvedValue([session('pending'), null]);
  state.get.mockResolvedValue([session('pending'), null]);

  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useProviderSetupSessionRunner', () => {
  it.each([
    { code: 'managed_credentials_auth_method_mismatch' },
    { code: 'managed_credentials_auth_method_unavailable' },
    { code: 'not_found', id: 'credential_a' },
    { code: 'use_after_delete', entityId: 'credential_a' }
  ])(
    'closes the blank popup and hands credential failures to the auth flow: $code',
    async data => {
      state.create.mockResolvedValue([null, { data }]);

      await act(async () => {
        await runner.start({
          providerAuthMethodId: 'oauth_a',
          providerAuthCredentialsId: 'credential_a'
        });
      });

      expect(popup.close).toHaveBeenCalledOnce();
      expect(state.onCredentialError).toHaveBeenCalledWith({ credentialId: 'credential_a' });
      expect(runner.error).toBeNull();
    }
  );

  it('shows the service message for a failure unrelated to the selected OAuth app', async () => {
    state.create.mockResolvedValue([
      null,
      {
        message: 'Wrapped error',
        data: { code: 'not_found', id: 'deployment', message: 'The deployment was removed.' }
      }
    ]);

    await startSession();

    expect(state.onCredentialError).not.toHaveBeenCalled();
    expect(runner.error).toBe('The deployment was removed.');
  });

  it.each([undefined, 'explorer' as const])(
    'only marks explicitly requested explorer sessions (source=%s)',
    async source => {
      act(() => root.render(<Harness source={source} />));
      await startSession();

      let input = state.create.mock.calls[0]![0];
      if (source) {
        expect(input).toHaveProperty('source', 'explorer');
      } else {
        expect(input).not.toHaveProperty('source');
      }
      expect(input).not.toHaveProperty('ownedByCaller');
    }
  );

  it('keeps polling when the browser reports the setup window as closed', async () => {
    await startSession();
    popup.closed = true;

    await flush(60_000);

    expect(runner.isAwaitingCompletion).toBe(true);
    expect(runner.error).toBeNull();
    expect(state.get.mock.calls.length).toBeGreaterThan(20);

    state.get.mockResolvedValue([session('completed'), null]);
    await flush(2000);

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect(runner.isAwaitingCompletion).toBe(false);
  });

  it('keeps polling past the old client-side attempt limit', async () => {
    await startSession();
    await flush(10 * 60_000);

    expect(runner.isAwaitingCompletion).toBe(true);
    expect(runner.error).toBeNull();
  });

  it('polls immediately when the dashboard regains focus', async () => {
    await startSession();
    let calls = state.get.mock.calls.length;

    state.get.mockResolvedValue([session('completed'), null]);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await flush();

    expect(state.get.mock.calls.length).toBe(calls + 1);
    expect(onComplete).toHaveBeenCalled();
  });

  it('keeps polling through transient API errors', async () => {
    await startSession();
    state.get.mockResolvedValue([null, new Error('network')]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await flush(10_000);
    expect(runner.isAwaitingCompletion).toBe(true);

    state.get.mockResolvedValue([session('completed'), null]);
    await flush(2000);
    expect(onComplete).toHaveBeenCalled();
  });

  it.each(['failed', 'expired', 'archived', 'deleted'])(
    'stops on terminal status %s',
    async status => {
      await startSession();
      state.get.mockResolvedValue([session(status), null]);
      await flush(2000);

      expect(runner.isAwaitingCompletion).toBe(false);
      expect(runner.error).toBeTruthy();
      expect(onComplete).not.toHaveBeenCalled();
    }
  );

  it('stops once the session is well past its expiry even if the API still reports pending', async () => {
    state.create.mockResolvedValue([session('pending', new Date(Date.now() + 5000)), null]);
    state.get.mockResolvedValue([session('pending', new Date(Date.now() + 5000)), null]);
    await startSession();

    await flush(70_000);

    expect(runner.isAwaitingCompletion).toBe(false);
    expect(runner.error).toMatch(/expired/);
  });
});
