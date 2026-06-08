import type {
  SkillMarketplacePluginRecord,
  SkillMarketplaceRecord
} from '@metorial-cargo/module-skill';
import { skillPluginPresenter } from './skillPlugin';

type PresentableSkillMarketplacePlugin =
  | SkillMarketplacePluginRecord
  | SkillMarketplaceRecord['plugins'][number];

export let skillMarketplacePluginPresenter = (
  skillMarketplacePlugin: PresentableSkillMarketplacePlugin
) => ({
  object: 'cargo#skillMarketplacePlugin',
  id: skillMarketplacePlugin.id,
  status: skillMarketplacePlugin.status,
  pluginSlug: skillMarketplacePlugin.pluginSlug,
  skillConfigurationId: skillMarketplacePlugin.skillConfiguration?.id,
  skillMarketplaceId:
    'skillMarketplace' in skillMarketplacePlugin
      ? skillMarketplacePlugin.skillMarketplace.id
      : undefined,
  skillPluginId: skillMarketplacePlugin.skillPlugin.id,
  skillPlugin: skillPluginPresenter(skillMarketplacePlugin.skillPlugin),
  createdAt: skillMarketplacePlugin.createdAt,
  updatedAt: skillMarketplacePlugin.updatedAt
});
