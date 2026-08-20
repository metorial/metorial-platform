import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  createSignalClient: vi.fn((_options: unknown) => ({ tenant: { upsert: vi.fn() } }))
}));

vi.mock('@metorial-platform-systems/signal-client', () => ({
  createSignalClient: mocks.createSignalClient
}));

vi.mock('./env', () => ({
  env: {
    service: {
      SIGNAL_API_URL: 'http://signal.internal/metorial-signal',
      SIGNAL_SERVICE_CREDENTIAL: 'subspace-rotated-service-credential'
    }
  }
}));

import { createInternalSignalClientOptions, getInternalSignal } from './signal';

describe('Subspace Signal transport authentication', () => {
  it('isolates the exact service credential to the dedicated internal client', () => {
    expect(mocks.createSignalClient).toHaveBeenCalledOnce();
    expect(mocks.createSignalClient.mock.calls[0]![0]).toEqual({
      endpoint: 'http://signal.internal/metorial-signal'
    });

    getInternalSignal();
    getInternalSignal();

    expect(mocks.createSignalClient).toHaveBeenCalledTimes(2);
    expect(mocks.createSignalClient.mock.calls[1]![0]).toEqual({
      endpoint: 'http://signal.internal/metorial-signal',
      headers: {
        'x-metorial-signal-service-credential': 'subspace-rotated-service-credential'
      }
    });
  });

  it('fails closed without a credential and never substitutes a fallback', () => {
    expect(() =>
      createInternalSignalClientOptions({
        endpoint: 'http://signal.internal/metorial-signal',
        serviceCredential: undefined
      })
    ).toThrow('Signal service credential is required.');

    expect(
      createInternalSignalClientOptions({
        endpoint: 'http://signal.internal/metorial-signal',
        serviceCredential: 'caller-supplied-invalid-credential'
      })
    ).toEqual({
      endpoint: 'http://signal.internal/metorial-signal',
      headers: {
        'x-metorial-signal-service-credential': 'caller-supplied-invalid-credential'
      }
    });
  });
});
