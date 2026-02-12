import React from 'react';

type ProviderConnectionTemplateData = {
  object: string;
  id: string;
  name: string | null;
  description: string | null;
  provider: { id: string; name: string; slug: string; imageUrl: string | null } | null;
  scopes: string[];
  variables: { key: string; label: string; description: string | null }[];
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

let stubMutator = () => ({
  mutate: (..._args: unknown[]): Promise<[null, null]> => Promise.resolve([null, null]),
  isLoading: false as const,
  isSuccess: false as const,
  error: null,
  RenderError: (): React.ReactElement | null => null
});

// Placeholder exports to prevent import errors in consuming code
export const providerConnectionTemplatesLoader = null;

export const useProviderConnectionTemplates = (
  _query?: Record<string, unknown>
) => ({
  data: null as {
    items: ProviderConnectionTemplateData[];
    pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
  } | null,
  isLoading: false,
  error: null,
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

export const useEvaluateProviderConnectionTemplate = () => ({
  ...stubMutator(),
  data: null as { config: Record<string, unknown>; providerName?: string } | null
});

export const providerConnectionTemplateLoader = null;

export const useProviderConnectionTemplate = (
  _providerConnectionTemplateId?: string | null
) => ({
  data: null as ProviderConnectionTemplateData | null,
  isLoading: false,
  error: null,
  refetch: () => {}
});
