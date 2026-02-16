type ManagedServerTemplateData = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Managed server templates are no longer used in the Magnetar Provider API.
// These stubs return empty data to prevent runtime errors in legacy forms.
export const managedServerTemplatesLoader = null;

export const useManagedServerTemplates = (
  _query?: Record<string, unknown>
) => ({
  data: {
    items: [] as ManagedServerTemplateData[],
    pagination: { hasMoreBefore: false, hasMoreAfter: false }
  },
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export const managedServerTemplateLoader = null;

export const useManagedServerTemplate = (
  _managedServerTemplateId?: string | null
) => ({
  data: null as ManagedServerTemplateData | null,
  isLoading: false,
  error: null,
  refetch: () => {}
});
