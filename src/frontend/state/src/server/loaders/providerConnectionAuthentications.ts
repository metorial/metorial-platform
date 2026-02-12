type ProviderConnectionAuthenticationData = {
  object: string;
  id: string;
  status: string | null;
  profile: {
    name: string | null;
    email: string | null;
    imageUrl: string | null;
    sub: string | null;
  } | null;
  events: {
    type: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

// Placeholder exports to prevent import errors in consuming code
export const providerConnectionAuthenticationsLoader = null;

export const useProviderConnectionAuthentications = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: ProviderConnectionAuthenticationData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export const providerConnectionAuthenticationLoader = null;

export const useProviderConnectionAuthentication = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null,
  _providerConnectionAuthenticationId?: string | null
) => ({
  data: null as ProviderConnectionAuthenticationData | null,
  isLoading: false,
  error: null,
  refetch: () => {}
});
