import type {
  Integration,
  Provider,
  ProviderListing,
  Skill,
  SkillEntity,
  SkillFork,
  SkillIntegration,
  SkillItem,
  SkillProvider,
  SkillProviderLink
} from '@metorial-subspace/db';
import { integrationPreviewPresenter } from './integration';
import { providerPreviewPresenter } from './provider';

export let skillPreviewPresenter = (skill: Skill) => {
  return {
    object: 'skill',

    id: skill.id,
    status: skill.status,

    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    metadata: skill.metadata,
    privateMetadata: skill.privateMetadata,

    clientName: skill.clientName,
    clientDescription: skill.clientDescription,
    clientMetadata: skill.clientMetadata,
    license: skill.license,
    compatibility: skill.compatibility,

    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt
  };
};

export let skillPresenter = (
  skill: Skill & {
    skillEntity: SkillEntity & {
      ownerSkill: Skill | null;
    };
    duplicatedFromSkill: Skill | null;
    fork:
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

  storeId: skill.storeId,

  hierarchy: {
    type: skill.fork ? 'fork' : skill.duplicatedFromSkill ? 'duplicated' : 'root',
    parentSkillId: skill.fork?.parentSkill.id ?? skill.duplicatedFromSkill?.id ?? null,
    forkId: skill.fork?.id ?? null,

    entity: {
      id: skill.skillEntity.id,
      name: skill.skillEntity.name,
      slug: skill.skillEntity.slug,
      description: skill.skillEntity.description,
      parentSkillId: skill.skillEntity.ownerSkill!.id,
      createdAt: skill.skillEntity.createdAt,
      updatedAt: skill.skillEntity.updatedAt
    }
  },

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
