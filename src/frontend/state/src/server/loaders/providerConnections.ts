import React from 'react';

type ProviderConnectionData = {
  object: string;
  id: string;
  name: string | null;
  description: string | null;
  status: string | null;
  clientId: string | null;
  config: { type: string; scopes?: string[]; config?: unknown };
  provider: {
    id: string;
    name: string;
    slug: string;
    url?: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

let stubMutator = () => ({
  mutate: (..._args: unknown[]): Promise<[null, null]> => Promise.resolve([null, null]),
  isLoading: false as const,
  isSuccess: false as const,
  error: null,
  RenderError: (): React.ReactElement | null => null
});

// Placeholder exports to prevent import errors in consuming code
export const providerConnectionsLoader = null;

export const useCreateProviderConnection = () => stubMutator();

export const useProviderConnections = (
  _instanceId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: ProviderConnectionData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export const providerConnectionLoader = null;

export const useProviderConnection = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null
) => ({
  data: null as ProviderConnectionData | null,
  isLoading: false,
  error: null,
  refetch: () => {},
  useUpdateMutator: stubMutator,
  useDeleteMutator: stubMutator,
  useTestMutator: stubMutator,
  useMutator: (_name: string) => stubMutator
});
