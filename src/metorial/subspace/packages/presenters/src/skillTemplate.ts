import type {
  Integration,
  Provider,
  ProviderListing,
  SkillTemplate,
  SkillTemplateItem
} from '@metorial-subspace/db';
import { integrationPreviewPresenter } from './integration';
import { providerPreviewPresenter } from './provider';

export let skillTemplateItemPresenter = (
  item: SkillTemplateItem & {
    integration: Integration | null;
    provider: (Provider & { listing?: Pick<ProviderListing, 'id' | 'image'> | null }) | null;
  }
) => ({
  object: 'skill.template.item',
  id: item.id,
  type: item.integration ? 'integration' : 'provider',
  integration: item.integration ? integrationPreviewPresenter(item.integration) : null,
  provider: item.provider ? providerPreviewPresenter(item.provider) : null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export let skillTemplatePresenter = (
  skillTemplate: SkillTemplate & {
    skillTemplateItems: (SkillTemplateItem & {
      integration: Integration | null;
      provider: (Provider & { listing?: Pick<ProviderListing, 'id' | 'image'> | null }) | null;
    })[];
  }
) => ({
  object: 'skill.template',
  id: skillTemplate.id,
  status: skillTemplate.status,
  owner: skillTemplate.owner,
  slug: skillTemplate.slug,
  name: skillTemplate.name,
  description: skillTemplate.description,
  metadata: skillTemplate.metadata,
  privateMetadata: skillTemplate.privateMetadata,
  storeId: skillTemplate.storeId,
  storeTemplateId: skillTemplate.storeTemplateId,
  items: skillTemplate.skillTemplateItems.map(skillTemplateItemPresenter),
  createdAt: skillTemplate.createdAt,
  updatedAt: skillTemplate.updatedAt
});
