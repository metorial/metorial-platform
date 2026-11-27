import { v } from '@lowerdeck/validation';
import type { SkillResource } from '@metorial/module-skill';
import { getImageUrl } from '@metorial/db';
import { Presenter } from '@metorial/presenter';
import { skillType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import { v1IntegrationPreviewPresenter, v1ProviderPreview } from '../provider';

export let presentSkillImage = (image: PrismaJson.EntityImage | null) => ({
  object: 'skill.image' as const,
  type:
    image?.type == 'file' || image?.type == 'url' || image?.type == 'icon'
      ? image.type
      : 'default',
  icon: image?.type == 'icon' ? image.icon : null,
  color: image?.type == 'icon' ? image.color : null
});

export let skillImageSchema = v.object(
  {
    object: v.literal('skill.image', {
      description: 'String representing the object’s type.'
    }),
    type: v.enumOf(['file', 'url', 'icon', 'default'], {
      description: 'Where the skill image comes from.'
    }),
    icon: v.nullable(
      v.string({
        description: 'Library icon ID. `null` unless `type` is `icon`.'
      })
    ),
    color: v.nullable(
      v.string({
        description: 'Tile color. `null` unless `type` is `icon`.'
      })
    )
  },
  {
    description: 'Image shown for the skill.'
  }
);

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
    image: presentSkillImage(skill.image),
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
      object: v.literal('skill', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['skl_5gHjKlMnPqRsTuVw']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: 'Whether the skill is available, archived, or deleted.'
      }),
      slug: v.string({
        description: 'URL-safe name, unique within the instance.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      image_url: v.string({
        description: 'Public URL of the skill image.'
      }),
      image: skillImageSchema,
      client_name: v.string({
        description: 'Client-facing skill name.'
      }),
      client_description: v.nullable(
        v.string({
          description: 'Client-facing description.'
        })
      ),
      client_metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data for the client-facing skill.'
        })
      ),
      license: v.nullable(
        v.string({
          description: 'License terms for the skill.'
        })
      ),
      compatibility: v.nullable(
        v.string({
          description: 'Compatibility notes for the skill.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      })
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
    image: presentSkillImage(skill.localSkill.image),
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
      object: v.literal('skill', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['skl_5gHjKlMnPqRsTuVw']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: 'Whether the skill is available, archived, or deleted.'
      }),
      slug: v.string({
        description: 'URL-safe name, unique within the instance.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      image_url: v.string({
        description: 'Public URL of the skill image.'
      }),
      image: skillImageSchema,
      client_name: v.string({
        description: 'Client-facing skill name.'
      }),
      client_description: v.nullable(
        v.string({
          description: 'Client-facing description.'
        })
      ),
      client_metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data for the client-facing skill.'
        })
      ),
      license: v.nullable(
        v.string({
          description: 'License terms for the skill.'
        })
      ),
      compatibility: v.nullable(
        v.string({
          description: 'Compatibility notes for the skill.'
        })
      ),
      metadata: v.record(v.any(), {
        description: 'Custom data you attach to identify or organize this record.'
      }),
      store_id: v.string({
        description: 'Store holding the skill, by ID.'
      }),
      hierarchy: v.object(
        {
          object: v.literal('skill.hierarchy', {
            description: 'String representing the object’s type.'
          }),
          type: v.enumOf(['root', 'fork', 'duplicated'], {
            description:
              'How the skill was created. `root` for original skills, `fork` for consumer forks, `duplicated` for copies.'
          }),
          parent_skill_id: v.nullable(
            v.string({
              description: 'Parent skill, by ID. `null` for root skills.'
            })
          ),
          creator: v.nullable(documentParticipantActorSchema),
          fork: v.nullable(
            v.object(
              {
                id: v.string({
                  description: 'Unique ID.'
                }),
                parent_skill_id: v.string({
                  description: 'Upstream skill the fork was created from, by ID.'
                }),
                creator: v.nullable(documentParticipantActorSchema),
                original_creator: v.nullable(documentParticipantActorSchema),
                created_at: v.date({
                  description: 'Creation time.'
                })
              },
              {
                description: 'Fork details. `null` unless the skill is a fork.'
              }
            )
          ),
          entity: v.object(
            {
              object: v.literal('skill.entity', {
                description: 'String representing the object’s type.'
              }),
              id: v.string({
                description: 'Unique ID.'
              }),
              name: v.string({
                description: 'Display name.'
              }),
              slug: v.string({
                description: 'URL-safe name, unique within the instance.'
              }),
              description: v.nullable(
                v.string({
                  description: 'Free-text description.'
                })
              ),
              parent_skill_id: v.string({
                description: 'Upstream skill, by ID.'
              }),
              created_at: v.date({
                description: 'Creation time.'
              }),
              updated_at: v.date({
                description: 'Last update time.'
              })
            },
            {
              description: 'Skill entity the versioned skill content belongs to.'
            }
          )
        },
        {
          description: 'Where the skill came from.'
        }
      ),
      integrations: v.array(v1IntegrationPreviewPresenter.schema, {
        description: 'Integrations attached to the skill.'
      }),
      providers: v.array(v1ProviderPreview.schema, {
        description: 'Providers attached to the skill.'
      }),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      })
    })
  )
  .build();
