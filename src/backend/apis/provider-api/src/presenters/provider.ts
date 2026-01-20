import { publisherPresenter, PublisherData } from './publisher';
import { versionPresenter, VersionData } from './version';

export type ProviderData = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  publisher: PublisherData;
  currentVersion: VersionData | null;
  createdAt: Date;
  updatedAt: Date;
};

export let providerPresenter = (provider: ProviderData) => ({
  object: 'provider' as const,
  id: provider.id,
  name: provider.name,
  description: provider.description,
  slug: provider.slug,
  publisher: publisherPresenter(provider.publisher),
  currentVersion: provider.currentVersion ? versionPresenter(provider.currentVersion) : null,
  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});
