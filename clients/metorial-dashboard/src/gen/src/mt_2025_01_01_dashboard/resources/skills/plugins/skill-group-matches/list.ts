import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsPluginsSkillGroupMatchesListOutput = {
  object: 'list';
  items: {
    object: 'skill.plugin.skill_group_match';
    skillPluginId: string;
    skillGroup: { id: string; name: string };
    sharedSkillCount: number;
    skillIdsToAdd: string[];
    skillIdsToRemove: string[];
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapSkillsPluginsSkillGroupMatchesListOutput =
  /* @__PURE__ */ createMapper<SkillsPluginsSkillGroupMatchesListOutput>([
    7,
    [
      1,
      [
        'skill_plugin_id',
        'skill_group',
        'shared_skill_count',
        'skill_ids_to_add',
        'skill_ids_to_remove'
      ]
    ]
  ]);

export type SkillsPluginsSkillGroupMatchesListQuery = {
  skillGroupId?: string | string[] | undefined;
};

export let mapSkillsPluginsSkillGroupMatchesListQuery =
  /* @__PURE__ */ mapObject<SkillsPluginsSkillGroupMatchesListQuery>([
    'skill_group_id'
  ]);
