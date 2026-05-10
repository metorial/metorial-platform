import type {
  Integration,
  Provider,
  ProviderListing,
  Skill,
  SkillFork,
  SkillGroup,
  SkillIntegration,
  SkillItem,
  SkillProvider,
  SkillProviderLink
} from '@metorial-subspace/db';
import { integrationPreviewPresenter } from './integration';
import { providerPreviewPresenter } from './provider';

export let skillPreviewPresenter = (skill: Skill) => ({
  object: 'skill',

  id: skill.id,
  status: skill.status,

  slug: skill.slug,
  name: skill.name,
  description: skill.description,
  metadata: skill.metadata,
  privateMetadata: skill.privateMetadata,

  createdAt: skill.createdAt,
  updatedAt: skill.updatedAt
});

export let skillPresenter = (
  skill: Skill & {
    skillGroup: SkillGroup;
    forkedFrom:
      | (SkillFork & {
          parentSkill: Skill;
        })
      | null;
    skillIntegrations: (SkillIntegration & {
      integration: Integration;
    })[];
    skillProviderLinks: (SkillProviderLink & {
      provider: Provider & { listing?: ProviderListing | null };
    })[];
  }
) => ({
  ...skillPreviewPresenter(skill),

  skillGroupId: skill.skillGroup.id,
  forkedFromId: skill.forkedFrom?.parentSkill.id ?? null,

  integrations: skill.skillIntegrations.map(item =>
    integrationPreviewPresenter(item.integration)
  ),
  providers: skill.skillProviderLinks.map(link => providerPreviewPresenter(link.provider))
});

export let skillItemPresenter = (
  skillItem: SkillItem & {
    skill: Skill;
    integration: (SkillIntegration & { integration: Integration }) | null;
    provider:
      | (SkillProvider & {
          provider: Provider & { listing?: ProviderListing | null };
        })
      | null;
  }
) => ({
  object: 'skillItem',

  id: skillItem.id,
  status: skillItem.status,
  type: skillItem.type,

  skillId: skillItem.skill.id,

  integration: skillItem.integration
    ? integrationPreviewPresenter(skillItem.integration.integration)
    : null,
  provider: skillItem.provider ? providerPreviewPresenter(skillItem.provider.provider) : null,

  createdAt: skillItem.createdAt
});
