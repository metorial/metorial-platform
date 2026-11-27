import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import {
  getReadablePluginSkillGroupIds,
  getReadablePluginSkillIds,
  hasSkillPluginArchiveAccess,
  hasSkillPluginWriteAccess
} from '@metorial/module-skill-marketplace';
import { Presenter } from '@metorial/presenter';
import { skillPluginSkillGroupMatchType, skillPluginType } from '../../types';
import { skillDestinationSyncStatusPresenter } from './skillDestination';
import { v1SkillPluginSkillPresenter } from './skillPluginSkill';

let manualSourceSchema = v.object({
  type: v.literal('manual', {
    description: "The plugin's skills are added and removed directly on the plugin."
  })
});

let skillGroupSourceType = v.literal('skill_group', {
  description:
    "The plugin's skills are synced from a skill group and cannot be edited on the plugin directly."
});

let skillGroupRefFields = {
  id: v.string({ description: 'The ID of the skill group.' }),
  name: v.string({ description: 'The name of the skill group.' })
};

let skillGroupRefDescription = "The skill group the plugin's skills are synced from.";

let skillGroupSyncFields = {
  unsynced_skills: v.array(
    v.object({
      skill_id: v.string({
        description: 'The ID of the skill that was not synced.'
      }),
      reason: v.enumOf(['limit_exceeded'], {
        description: 'Why the skill was not synced.'
      }),
      message: v.string({ description: 'A human-readable explanation.' })
    }),
    {
      description:
        'Group skills that are not in the plugin, for example because a plugin or marketplace limit was reached.'
    }
  ),
  last_synced_at: v.nullable(
    v.date({
      description: 'When the plugin was last reconciled with the skill group.'
    })
  )
};

let sourceDescription = "Where the plugin's skills come from.";

export let v1SkillPluginPresenter = Presenter.create(skillPluginType)
  .presenter(async ({ skillPlugin }, opts) => ({
    object: 'skill.plugin' as const,
    id: skillPlugin.id,
    status: skillPlugin.status,
    sync_status: skillDestinationSyncStatusPresenter(skillPlugin.destination),
    image_url: await getImageUrl(skillPlugin),
    name: skillPlugin.name!,
    description: skillPlugin.description,
    long_description: skillPlugin.longDescription,
    category: skillPlugin.category,
    slug: skillPlugin.slug!,
    skill_configuration_id: skillPlugin.skillConfiguration?.id ?? null,
    source: skillPlugin.skillGroupPlugin
      ? {
          type: 'skill_group' as const,
          skill_group: {
            id: skillPlugin.skillGroupPlugin.skillGroup.id,
            name: skillPlugin.skillGroupPlugin.skillGroup.name
          },
          unsynced_skills: (skillPlugin.skillGroupPlugin.syncIssues ?? []).map(issue => ({
            skill_id: issue.skillId,
            reason: issue.reason,
            message: issue.message
          })),
          last_synced_at: skillPlugin.skillGroupPlugin.lastReconciledAt
        }
      : { type: 'manual' as const },
    skills: await Promise.all(
      skillPlugin.skillPluginSkills.map(skillPluginSkill =>
        v1SkillPluginSkillPresenter.present({ skillPluginSkill }, opts).run()
      )
    ),
    created_at: skillPlugin.createdAt,
    updated_at: skillPlugin.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.plugin'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      sync_status: v.enumOf(['pending', 'processing', 'synced']),
      image_url: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      long_description: v.nullable(v.string()),
      category: v.nullable(v.string()),
      slug: v.string(),
      skill_configuration_id: v.nullable(v.string()),
      source: v.union(
        [
          manualSourceSchema,
          v.object({
            type: skillGroupSourceType,
            skill_group: v.object(skillGroupRefFields, {
              description: skillGroupRefDescription
            }),
            ...skillGroupSyncFields
          })
        ],
        { description: sourceDescription }
      ),
      skills: v.array(v1SkillPluginSkillPresenter.schema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardSkillPluginPresenter = Presenter.create(skillPluginType)
  .presenter(async (input, opts) => {
    let inner = await v1SkillPluginPresenter.present(input, opts).run();
    let isMutable = input.skillPlugin.status == 'active' && !input.skillPlugin.isManaged;
    let canUpdate = isMutable
      ? (input.pluginAccess?.canUpdate ??
        (await hasSkillPluginWriteAccess({
          skillPlugin: input.skillPlugin,
          accessTags: input.accessTags
        })))
      : false;
    let canDelete = isMutable
      ? (input.pluginAccess?.canDelete ??
        (await hasSkillPluginArchiveAccess({
          skillPlugin: input.skillPlugin,
          accessTags: input.accessTags
        })))
      : false;
    let readableSkillIds =
      input.pluginAccess?.readableSkillIds ??
      (await getReadablePluginSkillIds({
        plugins: [input.skillPlugin],
        accessTags: input.accessTags
      }));
    let readableSkillGroupIds =
      input.pluginAccess?.readableSkillGroupIds ??
      (await getReadablePluginSkillGroupIds({
        plugins: [input.skillPlugin],
        accessTags: input.accessTags
      }));

    return {
      ...inner,
      source:
        inner.source.type === 'skill_group'
          ? {
              ...inner.source,
              skill_group: {
                ...inner.source.skill_group,
                can_read: readableSkillGroupIds.has(inner.source.skill_group.id)
              }
            }
          : inner.source,
      skills: inner.skills.map(skill => ({
        ...skill,
        can_read: readableSkillIds.has(skill.skill_id)
      })),
      can_update: canUpdate,
      can_delete: canDelete,
      can_edit_skills: canUpdate && !input.skillPlugin.skillGroupPlugin
    };
  })
  .schema(
    v.intersection([
      v1SkillPluginPresenter.schema,
      v.object({
        skills: v.array(
          v.intersection([
            v1SkillPluginSkillPresenter.schema,
            v.object({
              can_read: v.boolean({
                description:
                  'Whether the caller can open the skill. Consumers see every skill in a marketplace they can access, but can only read some of them.'
              })
            })
          ])
        ),
        source: v.union(
          [
            manualSourceSchema,
            v.object({
              type: skillGroupSourceType,
              skill_group: v.object(
                {
                  ...skillGroupRefFields,
                  can_read: v.boolean({
                    description: 'Whether the caller can open the skill group.'
                  })
                },
                { description: skillGroupRefDescription }
              ),
              ...skillGroupSyncFields
            })
          ],
          { description: sourceDescription }
        ),
        can_update: v.boolean(),
        can_delete: v.boolean(),
        can_edit_skills: v.boolean({
          description:
            'Whether skills can be added to or removed from the plugin directly. False for plugins synced from a skill group.'
        })
      })
    ])
  )
  .build();

export let v1SkillPluginSkillGroupMatchPresenter = Presenter.create(
  skillPluginSkillGroupMatchType
)
  .presenter(async ({ skillGroupMatch }) => ({
    object: 'skill.plugin.skill_group_match' as const,
    skill_plugin_id: skillGroupMatch.skillPlugin.id,
    skill_group: {
      id: skillGroupMatch.skillGroup.id,
      name: skillGroupMatch.skillGroup.name
    },
    shared_skill_count: skillGroupMatch.sharedSkillCount,
    skill_ids_to_add: skillGroupMatch.skillsToAdd.map(skill => skill.id),
    skill_ids_to_remove: skillGroupMatch.skillsToRemove.map(skill => skill.id)
  }))
  .schema(
    v.object({
      object: v.literal('skill.plugin.skill_group_match', {
        description: 'String representing the object’s type.'
      }),
      skill_plugin_id: v.string({
        description: 'Skill plugin the skill group is compared with.',
        examples: ['skpl_0mbgjh8iMEI3ZMm2r2iP0P']
      }),
      skill_group: v.object(
        {
          id: v.string({
            description: 'Unique ID.',
            examples: ['skg_0mbgjh8iMEI3ZMm2r2iP0P']
          }),
          name: v.string({ description: 'Display name.' })
        },
        { description: 'Skill group compared with the plugin.' }
      ),
      shared_skill_count: v.number({
        description: 'Number of skills that are in both the plugin and the skill group.'
      }),
      skill_ids_to_add: v.array(v.string(), {
        description:
          'Skills in the group that the plugin lacks. Attaching the group adds them to the plugin.'
      }),
      skill_ids_to_remove: v.array(v.string(), {
        description:
          'Skills in the plugin that the group lacks. Attaching the group removes them from the plugin.'
      })
    })
  )
  .build();
