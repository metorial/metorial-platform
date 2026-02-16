type MagicMcpSessionData = {
  id: string;
  name: string | null;
  description: string | null;
  status: string | null;
  connectionStatus: string | null;
  magicMcpServer: { id: string; name: string | null } | null;
  client: { name: string | null; version: string | null } | null;
  sessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let magicMcpSessionsLoader = null;

export let useMagicMcpSessions = (
  _instanceId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: MagicMcpSessionData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export let magicMcpSessionLoader = null;

export let useMagicMcpSession = (
  _instanceId?: string | null,
  _magicMcpSessionId?: string | null
) => ({
  data: null as MagicMcpSessionData | null,
  isLoading: false,
  error: null,
  refetch: () => {}
});
