import React from 'react';

let stubMutator = () => ({
  mutate: (..._args: unknown[]): Promise<[null, null]> => Promise.resolve([null, null]),
  input: null as Record<string, unknown> | null,
  isLoading: false as const,
  isSuccess: false as const,
  error: null,
  RenderError: (): React.ReactElement | null => null
});

export let magicMcpGroupsLoader = null;

export let useCreateMagicMcpGroup = stubMutator;

type MagicMcpGroupData = {
  id: string;
  name: string | null;
  description: string | null;
  slug: string | null;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
  serverDeployments: unknown[];
  endpoints: unknown[];
  needsDefaultOauthSession: boolean;
};

export let useMagicMcpGroups = (
  _instanceId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as { items: MagicMcpGroupData[]; pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean } } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {},
  createMutator: stubMutator,
  revokeMutator: stubMutator,
  updateMutator: stubMutator
});

export let magicMcpGroupLoader = null;

export let useMagicMcpGroup = (
  _instanceId?: string | null,
  _magicMcpGroupId?: string | null
) => ({
  data: null as (Record<string, unknown> & {
    id?: string;
    name?: string;
    slug?: string;
    description?: string;
    createdAt?: Date;
    serverDeployments?: unknown[];
    endpoints?: unknown[];
    needsDefaultOauthSession?: boolean;
  }) | null,
  isLoading: false,
  error: null,
  refetch: () => {},
  useUpdateMutator: stubMutator,
  useDeleteMutator: stubMutator,
  useAddServersMutator: stubMutator,
  useRemoveServersMutator: stubMutator
});
