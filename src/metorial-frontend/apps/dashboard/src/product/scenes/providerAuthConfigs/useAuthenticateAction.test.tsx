// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderAuthConfigAuthenticateAction } from './useAuthenticateAction';

let state = vi.hoisted(() => ({
  methods: [
    { id: 'oauth_a', type: 'oauth' },
    { id: 'oauth_b', type: 'oauth' },
    { id: 'token', type: 'token' }
  ],
  credentials: null as any,
  autoRegistration: false,
  rememberedId: null as string | null,
  start: vi.fn(),
  openModal: vi.fn(),
  credentialsHook: vi.fn()
}));

vi.mock('@metorial/state', () => ({
  instanceProviderAuthConfigsLoader: { refetchAll: vi.fn() },
  useProviderListing: () => ({ data: { name: 'Provider' } }),
  useProviderAuthCredentialsForMethods: (...args: unknown[]) => {
    state.credentialsHook(...args);
    return { data: state.credentials, error: null };
  }
}));

vi.mock('@metorial/ui', () => ({
  Button: () => null,
  Dialog: {},
  Spacer: () => null,
  Text: () => null,
  showModal: vi.fn(),
  toast: { error: vi.fn() }
}));

vi.mock('../../lib/providerCreationCapabilities', () => ({
  useProviderAuthCreationCapabilities: () => ({
    authMethodItems: state.methods,
    oauthAutoRegistrationEnabled: state.autoRegistration,
    deployment: { data: null },
    provider: { data: { id: 'provider', name: 'Provider' } }
  })
}));

vi.mock('../providerDeployments/setupSessionRunner', () => ({
  useProviderSetupSessionRunner: () => ({
    start: state.start,
    isStarting: false,
    isWindowOpen: false
  })
}));

vi.mock('./createModal', () => ({ showProviderAuthConfigCreateModal: state.openModal }));

vi.mock('./credentialPicker', () => ({
  getProviderAuthCredentialsQuery: (query: unknown) => query,
  getRememberedProviderAuthCredentialId: () => state.rememberedId
}));

vi.mock('./modalHelpers', () => ({
  isSetupFlowAuthMethod: (method: { type: string }) => method.type === 'oauth',
  getGeneratedAuthConfigName: () => 'Provider Auth'
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;

let action: ReturnType<typeof useProviderAuthConfigAuthenticateAction>;

let Harness = (props: { fixedAuthMethodId?: string; fixedAuthCredentialsId?: string }) => {
  action = useProviderAuthConfigAuthenticateAction({
    instanceId: 'instance',
    providerId: 'provider',
    ...props
  });

  return null;
};

let credentialsFor = (
  methodId: string,
  ids: string[],
  pagination = { hasMoreAfter: false, hasMoreBefore: false }
) => ({
  providerAuthMethodId: methodId,
  credentials: { items: ids.map(id => ({ id })), pagination }
});

beforeEach(() => {
  vi.clearAllMocks();
  state.credentials = [
    credentialsFor('oauth_a', ['credential_a']),
    credentialsFor('oauth_b', ['credential_b'])
  ];
  state.autoRegistration = false;
  state.rememberedId = null;
  root = createRoot(document.createElement('div'));
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe('OAuth credential selection', () => {
  it('preloads every OAuth method and directly authenticates with the selected method’s only credential', async () => {
    await act(async () => root.render(<Harness />));

    expect(state.credentialsHook).toHaveBeenLastCalledWith('instance', [
      { providerId: 'provider', providerAuthMethodId: 'oauth_a' },
      { providerId: 'provider', providerAuthMethodId: 'oauth_b' }
    ]);
    action.start('oauth_b');

    expect(state.start).toHaveBeenCalledWith({
      providerAuthMethodId: 'oauth_b',
      providerAuthCredentialsId: 'credential_b',
      name: 'Provider Auth'
    });
    expect(state.openModal).not.toHaveBeenCalled();
  });

  it.each([{ ids: [] }, { ids: ['credential_b', 'credential_c'] }])(
    'opens the picker when the selected method has %j credentials',
    async ({ ids }) => {
      state.credentials = [credentialsFor('oauth_b', ids)];
      await act(async () => root.render(<Harness />));
      action.start('oauth_b');

      expect(state.openModal).toHaveBeenCalledWith(
        expect.objectContaining({ initialAuthMethodId: 'oauth_b' })
      );
      expect(state.start).not.toHaveBeenCalled();
    }
  );

  it.each([
    { hasMoreAfter: true, hasMoreBefore: false },
    { hasMoreAfter: false, hasMoreBefore: true }
  ])('keeps the picker when the result is only one page: %j', async pagination => {
    state.credentials = [credentialsFor('oauth_b', ['credential_b'], pagination)];
    await act(async () => root.render(<Harness />));
    action.start('oauth_b');

    expect(state.openModal).toHaveBeenCalled();
    expect(state.start).not.toHaveBeenCalled();
  });

  it('keeps the action loading until credentials arrive', async () => {
    state.credentials = null;
    await act(async () => root.render(<Harness />));
    expect(action.isLoading).toBe(true);

    state.credentials = [credentialsFor('oauth_b', ['credential_b'])];
    await act(async () => root.render(<Harness />));
    expect(action.isLoading).toBe(false);
    action.start('oauth_b');

    expect(state.start).toHaveBeenCalled();
    expect(state.openModal).not.toHaveBeenCalled();
  });

  it('only preloads a fixed method', async () => {
    await act(async () => root.render(<Harness fixedAuthMethodId="oauth_b" />));

    expect(state.credentialsHook).toHaveBeenLastCalledWith('instance', [
      { providerId: 'provider', providerAuthMethodId: 'oauth_b' }
    ]);
    action.start('oauth_b');
    expect(state.start).toHaveBeenCalled();
  });

  it('preserves remembered choices for multiple credentials', async () => {
    state.credentials = [credentialsFor('oauth_b', ['credential_b', 'credential_c'])];
    state.rememberedId = 'credential_c';
    await act(async () => root.render(<Harness />));
    action.start('oauth_b');

    expect(state.start).toHaveBeenCalledWith(
      expect.objectContaining({ providerAuthCredentialsId: 'credential_c' })
    );
    expect(state.openModal).not.toHaveBeenCalled();
  });

  it('uses fixed credentials without loading a picker', async () => {
    state.credentials = null;
    await act(async () => root.render(<Harness fixedAuthCredentialsId="fixed_credential" />));
    action.start('oauth_b');

    expect(state.credentialsHook).toHaveBeenLastCalledWith('instance', null);
    expect(state.start).toHaveBeenCalledWith(
      expect.objectContaining({ providerAuthCredentialsId: 'fixed_credential' })
    );
    expect(state.openModal).not.toHaveBeenCalled();
  });

  it('starts auto-registration without loading credentials', async () => {
    state.credentials = null;
    state.autoRegistration = true;
    await act(async () => root.render(<Harness />));
    action.start('oauth_b');

    expect(state.credentialsHook).toHaveBeenLastCalledWith('instance', null);
    expect(state.start).toHaveBeenCalled();
    expect(state.openModal).not.toHaveBeenCalled();
  });

  it('retains the manual authentication flow', async () => {
    await act(async () => root.render(<Harness />));
    action.start('token');

    expect(state.openModal).toHaveBeenCalledWith(
      expect.objectContaining({ initialAuthMethodId: 'token' })
    );
    expect(state.start).not.toHaveBeenCalled();
  });
});
