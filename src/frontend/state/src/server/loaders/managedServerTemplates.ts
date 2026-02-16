type ManagedServerTemplateData = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Placeholder exports to prevent import errors in consuming code
export const managedServerTemplatesLoader = null;

export const useManagedServerTemplates = (
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: ManagedServerTemplateData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
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
