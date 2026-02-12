import React from 'react';

type MagicMcpTokenData = {
  id: string;
  name: string | null;
  description: string | null;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
  secret: string | null;
  groups: { id: string; name: string | null }[];
};

let stubMutator = () => ({
  mutate: (..._args: unknown[]): Promise<[null, null]> => Promise.resolve([null, null]),
  isLoading: false as const,
  isSuccess: false as const,
  error: null,
  RenderError: (): React.ReactElement | null => null
});

export let magicMcpTokensLoader = null;

export let useCreateMagicMcpToken = (_opts?: Record<string, unknown>) => stubMutator();

export let useMagicMcpTokens = (
  _instanceId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: MagicMcpTokenData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {},
  createMutator: { ...stubMutator(), data: null as { secret: string | null } | null },
  revokeMutator: stubMutator,
  updateMutator: stubMutator
});

export let magicMcpTokenLoader = null;

export let useMagicMcpToken = (
  _instanceId?: string | null,
  _magicMcpTokenId?: string | null
) => ({
  data: null as MagicMcpTokenData | null,
  isLoading: false,
  error: null,
  refetch: () => {},
  useUpdateMutator: stubMutator,
  useDeleteMutator: stubMutator
});
