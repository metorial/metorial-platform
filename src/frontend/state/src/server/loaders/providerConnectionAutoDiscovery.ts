import React from 'react';

type AutoDiscoverResult = {
  config: Record<string, unknown>;
  providerName: string;
  autoRegistrationId: string | null;
};

// Placeholder export to prevent import errors in consuming code
export const useAutoDiscoverProviderConnection = () => ({
  mutate: (..._args: unknown[]): Promise<[AutoDiscoverResult | null, null]> => Promise.resolve([null, null]),
  isLoading: false as const,
  isSuccess: false as const,
  isSuccessPermanent: false as const,
  error: null,
  data: null as { testUrl: string } | null,
  RenderError: (): React.ReactElement | null => null
});
