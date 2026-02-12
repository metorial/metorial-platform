// TODO: Wire up MagicMcp endpoints in @metorial/dashboard-sdk when available
export const magicMcpTokensLoader = null;
export const useCreateMagicMcpToken = (_opts?: any) => {
  return {
    mutate: () => Promise.reject(new Error('magicMcp API is not yet available in the SDK'))
  };
};
export const useMagicMcpTokens = (_instanceId?: string | null, _query?: any) => {
  return {
    data: { items: [] as any[], pagination: { hasMoreBefore: false, hasMoreAfter: false } },
    isLoading: false,
    error: null as any,
    createMutator: {
      mutate: () => Promise.reject(new Error('magicMcp API is not yet available'))
    },
    revokeMutator: () => ({
      mutate: () => Promise.reject(new Error('magicMcp API is not yet available'))
    }),
    updateMutator: () => ({
      mutate: () => Promise.reject(new Error('magicMcp API is not yet available'))
    })
  };
};
export const magicMcpTokenLoader = null;
export const useMagicMcpToken = (
  _instanceId?: string | null,
  _magicMcpTokenId?: string | null
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
