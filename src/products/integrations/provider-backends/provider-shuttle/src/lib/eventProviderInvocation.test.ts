import { beforeEach, describe, expect, it, vi } from 'vitest';

let createProviderInvocationId = vi.hoisted(() => vi.fn());

vi.mock('@metorial-subspace/provider-utils', () => ({ createProviderInvocationId }));

import { getEventProviderInvocationId } from './eventProviderInvocation';

describe('getEventProviderInvocationId', () => {
  beforeEach(() => {
    createProviderInvocationId.mockImplementation((sourceType, sourceId) =>
      JSON.stringify([sourceType, sourceId])
    );
  });

  it('links connection-scoped events to the Shuttle connection invocation', () => {
    let id = getEventProviderInvocationId({
      serverConnectionId: 'server_connection_test'
    });

    expect(id).toBe('["shuttle.server_connection","server_connection_test"]');
    expect(createProviderInvocationId).toHaveBeenCalledWith(
      'shuttle.server_connection',
      'server_connection_test'
    );
  });

  it('prefers the more specific function invocation link', () => {
    let id = getEventProviderInvocationId({
      functionInvocationId: 'function_invocation_test',
      serverConnectionId: 'server_connection_test'
    });

    expect(id).toBe('["shuttle.function_invocation","function_invocation_test"]');
  });
});
