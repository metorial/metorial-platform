type ProviderConnectionEventData = {
  object: string;
  id: string;
  type: string | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Placeholder exports to prevent import errors in consuming code
export const providerConnectionEventsLoader = null;

export const useProviderConnectionEvents = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null,
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: ProviderConnectionEventData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export const providerConnectionEventLoader = null;

export const useProviderConnectionEvent = (
  _instanceId?: string | null,
  _providerConnectionId?: string | null,
  _providerConnectionEventId?: string | null
) => ({
  data: null as ProviderConnectionEventData | null,
  isLoading: false,
  error: null,
  refetch: () => {}
});
