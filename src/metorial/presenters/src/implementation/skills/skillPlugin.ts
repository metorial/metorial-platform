import { v } from '@lowerdeck/validation';
import { getImageUrl } from '@metorial/db';
import {
  getReadablePluginSkillIds,
  hasSkillPluginArchiveAccess,
  hasSkillPluginWriteAccess
} from '@metorial/module-skill-marketplace';
import { Presenter } from '@metorial/presenter';
import { skillPluginType } from '../../types';
import { skillDestinationSyncStatusPresenter } from './skillDestination';
import { v1SkillPluginSkillPresenter } from './skillPluginSkill';

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
          v.object({
            type: v.literal('manual', {
              description: "The plugin's skills are added and removed directly on the plugin."
            })
          }),
          v.object({
            type: v.literal('skill_group', {
              description:
                "The plugin's skills are synced from a skill group and cannot be edited on the plugin directly."
            }),
            skill_group: v.object(
              {
                id: v.string({ description: 'The ID of the skill group.' }),
                name: v.string({ description: 'The name of the skill group.' })
              },
              { description: "The skill group the plugin's skills are synced from." }
            ),
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
          })
        ],
        { description: "Where the plugin's skills come from." }
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

    return {
      ...inner,
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
