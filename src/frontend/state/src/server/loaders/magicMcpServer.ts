import React from 'react';

type MagicMcpServerData = {
  id: string;
  name: string | null;
  description: string | null;
  slug: string | null;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
  serverDeployments: { id: string; name: string | null; providerId: string }[];
  endpoints: { id: string; url: string }[];
  needsDefaultOauthSession: boolean;
  oauthConnection: { id: string } | null;
};

let stubMutator = () => ({
  mutate: (..._args: unknown[]): Promise<[null, null]> => Promise.resolve([null, null]),
  isLoading: false as const,
  isSuccess: false as const,
  error: null,
  RenderError: (): React.ReactElement | null => null
});

export let magicMcpServersLoader = null;

export let useCreateMagicMcpServer = (_opts?: Record<string, unknown>) => stubMutator();

export let useMagicMcpServers = (
  _instanceId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: MagicMcpServerData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export let magicMcpServerLoader = null;

export let useMagicMcpServer = (
  _instanceId?: string | null,
  _magicMcpServerId?: string | null
) => ({
  data: null as MagicMcpServerData | null,
  isLoading: false,
  error: null,
  refetch: () => {},
  useUpdateMutator: stubMutator,
  useDeleteMutator: stubMutator
});

export let updateMagicMcpServer = stubMutator;
