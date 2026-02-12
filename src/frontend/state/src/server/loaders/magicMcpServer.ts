// TODO: Wire up MagicMcp endpoints in @metorial/dashboard-sdk when available
export const magicMcpServersLoader = null;
export const useCreateMagicMcpServer = (_opts?: any) => {
  return {
    mutate: () => Promise.reject(new Error('magicMcp API is not yet available in the SDK'))
  };
};
export const useMagicMcpServers = (_instanceId?: string | null, _query?: any) => {
  return {
    data: { items: [] as any[], pagination: { hasMoreBefore: false, hasMoreAfter: false } },
    isLoading: false,
    error: null as any
  };
};
export const magicMcpServerLoader = null;
export const useMagicMcpServer = (
  _instanceId?: string | null,
  _magicMcpServerId?: string | null
) => {
  return {
    data: null,
    isLoading: false,
    error: null as any,
    useUpdateMutator: () => ({
      mutate: () => Promise.reject(new Error('magicMcp API is not yet available'))
    }),
    useDeleteMutator: () => ({
      mutate: () => Promise.reject(new Error('magicMcp API is not yet available'))
    })
  };
};
export const updateMagicMcpServer = (_body?: any) => {
  return Promise.reject(new Error('magicMcp API is not yet available in the SDK'));
};
