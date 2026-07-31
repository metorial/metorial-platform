import { v } from '@lowerdeck/validation';
import type { SkillResource } from '@metorial/cargo-module-skill';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { skillType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import { v1IntegrationPreviewPresenter, v1ProviderPreview } from '../provider';

export let v1SkillPreviewPresenter = Object.assign(
  async (
    skill: Pick<
      SkillResource,
      | 'id'
      | 'status'
      | 'slug'
      | 'name'
      | 'description'
      | 'image'
      | 'clientName'
      | 'clientDescription'
      | 'clientMetadata'
      | 'license'
      | 'compatibility'
      | 'metadata'
      | 'createdAt'
      | 'updatedAt'
    >
  ) => ({
    object: 'skill' as const,
    id: skill.id,
    status: skill.status,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    image_url: await getImageUrl(skill),
    client_name: skill.clientName,
    client_description: skill.clientDescription,
    client_metadata: skill.clientMetadata,
    license: skill.license,
    compatibility: skill.compatibility,
    metadata: skill.metadata,
    created_at: skill.createdAt,
    updated_at: skill.updatedAt
  }),
  {
    schema: v.object({
      object: v.literal('skill'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      slug: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      image_url: v.string(),
      client_name: v.string(),
      client_description: v.nullable(v.string()),
      client_metadata: v.nullable(v.record(v.any())),
      license: v.nullable(v.string()),
      compatibility: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      created_at: v.date(),
      updated_at: v.date()
    })
  }
);

export let v1SkillPresenter = Presenter.create(skillType)
  .presenter(async ({ skill }, opts) => ({
    object: 'skill' as const,
    id: skill.id,
    status: skill.status,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    image_url: await getImageUrl(skill.localSkill),
    client_name: skill.clientName,
    client_description: skill.clientDescription,
    client_metadata: skill.clientMetadata,
    license: skill.license,
    compatibility: skill.compatibility,
    metadata: skill.metadata,
    store_id: skill.storeId,
    hierarchy: {
      object: 'skill.hierarchy' as const,
      type: skill.hierarchy.type,
      parent_skill_id: skill.hierarchy.parentSkillId,
      creator: skill.hierarchy.creator
        ? await presentDocumentParticipantActor(skill.hierarchy.creator, opts)
        : null,
      fork: skill.hierarchy.fork
        ? {
            id: skill.hierarchy.fork.id,
            parent_skill_id: skill.hierarchy.fork.parentSkillId,
            creator: skill.hierarchy.fork.creator
              ? await presentDocumentParticipantActor(skill.hierarchy.fork.creator, opts)
              : null,
            original_creator: skill.hierarchy.fork.originalCreator
              ? await presentDocumentParticipantActor(
                  skill.hierarchy.fork.originalCreator,
                  opts
                )
              : null,
            created_at: skill.hierarchy.fork.createdAt
          }
        : null,
      entity: {
        object: 'skill.entity' as const,
        id: skill.hierarchy.entity.id,
        name: skill.hierarchy.entity.name,
        slug: skill.hierarchy.entity.slug,
        description: skill.hierarchy.entity.description,
        parent_skill_id: skill.hierarchy.entity.parentSkillId,
        created_at: skill.hierarchy.entity.createdAt,
        updated_at: skill.hierarchy.entity.updatedAt
      }
    },
    integrations: skill.integrations.map(i => v1IntegrationPreviewPresenter(i)),
    providers: skill.providers.map(p => v1ProviderPreview(p)),
    created_at: skill.createdAt,
    updated_at: skill.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      slug: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      image_url: v.string(),
      client_name: v.string(),
      client_description: v.nullable(v.string()),
      client_metadata: v.nullable(v.record(v.any())),
      license: v.nullable(v.string()),
      compatibility: v.nullable(v.string()),
      metadata: v.record(v.any()),
      store_id: v.string(),
      hierarchy: v.object({
        object: v.literal('skill.hierarchy'),
        type: v.enumOf(['root', 'fork', 'duplicated']),
        parent_skill_id: v.nullable(v.string()),
        creator: v.nullable(documentParticipantActorSchema),
        fork: v.nullable(
          v.object({
            id: v.string(),
            parent_skill_id: v.string(),
            creator: v.nullable(documentParticipantActorSchema),
            original_creator: v.nullable(documentParticipantActorSchema),
            created_at: v.date()
          })
        ),
        entity: v.object({
          object: v.literal('skill.entity'),
          id: v.string(),
          name: v.string(),
          slug: v.string(),
          description: v.nullable(v.string()),
          parent_skill_id: v.string(),
          created_at: v.date(),
          updated_at: v.date()
        })
      }),
      integrations: v.array(v1IntegrationPreviewPresenter.schema),
      providers: v.array(v1ProviderPreview.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
