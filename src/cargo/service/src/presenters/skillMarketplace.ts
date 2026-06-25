import type { SkillMarketplaceRecord } from '@metorial-cargo/module-skill';
import { skillDestinationSyncStatusPresenter } from './skillDestination';
import { skillMarketplacePluginPresenter } from './skillMarketplacePlugin';

export let skillMarketplacePresenter = (skillMarketplace: SkillMarketplaceRecord) => ({
  object: 'cargo#skillMarketplace',
  id: skillMarketplace.id,
  status: skillMarketplace.status,
  image: skillMarketplace.image,
  providerOverrides: skillMarketplace.providerOverrides,
  version: skillMarketplace.version,
  name: skillMarketplace.name,
  description: skillMarketplace.description,
  slug: skillMarketplace.slug,
  skillConfigurationId: skillMarketplace.skillConfiguration?.id,
  syncStatus: skillDestinationSyncStatusPresenter(skillMarketplace.destination),
  plugins: skillMarketplace.plugins.map(skillMarketplacePluginPresenter),
  createdAt: skillMarketplace.createdAt,
  updatedAt: skillMarketplace.updatedAt
});
