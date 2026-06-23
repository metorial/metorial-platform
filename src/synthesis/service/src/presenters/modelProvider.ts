import type { ModelProvider } from '../db';

export let modelProviderPresenter = (provider: ModelProvider) => ({
  object: 'synthesis#modelProvider',
  id: provider.id,
  slug: provider.slug,
  name: provider.name,
  imageUrl: provider.imageUrl,
  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
