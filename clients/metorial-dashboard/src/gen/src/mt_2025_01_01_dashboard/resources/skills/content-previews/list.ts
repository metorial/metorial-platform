import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsContentPreviewsListOutput = {
  items: {
    object: 'skill.content_preview';
    type: 'skill' | 'skill_template';
    skillId: string | null;
    skillTemplateId: string | null;
    content: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsContentPreviewsListOutput =
  /* @__PURE__ */ createMapper<SkillsContentPreviewsListOutput>([
    7,
    [1, ['skill_id', 'skill_template_id']]
  ]);

export type SkillsContentPreviewsListQuery = {
  skillId?: string | string[] | undefined;
  skillTemplateId?: string | string[] | undefined;
};

export let mapSkillsContentPreviewsListQuery =
  /* @__PURE__ */ mapObject<SkillsContentPreviewsListQuery>([
    'skill_id',
    'skill_template_id'
  ]);
