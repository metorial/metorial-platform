import type {
  Integration,
  Provider,
  SkillIntegration,
  SkillProvider,
  SkillTemplate,
  SkillTemplateItem
} from '@metorial-subspace/db';
import { integrationPreviewPresenter } from './integration';
import { providerPreviewPresenter } from './provider';

export let skillTemplateItemPresenter = (
  item: SkillTemplateItem & {
    integration:
      | (SkillIntegration & { integration: Integration; item: { id: string } })
      | null;
    provider:
      | (SkillProvider & {
          item: { id: string };
          provider: Provider & { listing?: { id: string; image: string } | null };
        })
      | null;
  }
) => ({
  object: 'skill.template.item',
  id: item.id,
  type: item.integration ? 'integration' : 'provider',
  integration: item.integration
    ? integrationPreviewPresenter(item.integration.integration)
    : null,
  provider: item.provider ? providerPreviewPresenter(item.provider.provider) : null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

export let skillTemplatePresenter = (
  skillTemplate: SkillTemplate & {
    skillTemplateItems: (SkillTemplateItem & {
      integration:
        | (SkillIntegration & { integration: Integration; item: { id: string } })
        | null;
      provider:
        | (SkillProvider & {
            item: { id: string };
            provider: Provider & { listing?: { id: string; image: string } | null };
          })
        | null;
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
  items: skillTemplate.skillTemplateItems.map(skillTemplateItemPresenter),
  createdAt: skillTemplate.createdAt,
  updatedAt: skillTemplate.updatedAt
});
