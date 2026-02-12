type ProviderConnectionProfileData = {
  object: string;
  id: string;
  name: string | null;
  email: string | null;
  sub: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Placeholder exports to prevent import errors in consuming code
export const providerConnectionProfilesLoader = null;

export const useProviderConnectionProfiles = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: ProviderConnectionProfileData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export const providerConnectionProfileLoader = null;

export const useProviderConnectionProfile = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null,
  _providerConnectionProfileId?: string | null
) => ({
  data: null as ProviderConnectionProfileData | null,
  isLoading: false,
  error: null,
  refetch: () => {}
});
