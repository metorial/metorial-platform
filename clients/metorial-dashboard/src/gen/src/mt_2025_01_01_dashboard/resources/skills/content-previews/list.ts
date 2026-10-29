import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SkillsContentPreviewsListOutput = {
  items: {
    object: 'skill.content_preview';
    skillId: string;
    content: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsContentPreviewsListOutput =
  /* @__PURE__ */ createMapper<SkillsContentPreviewsListOutput>([
    7,
    [1, ['skill_id']]
  ]);

export type SkillsContentPreviewsListQuery = { id: string | string[] };

export let mapSkillsContentPreviewsListQuery =
  /* @__PURE__ */ createMapper<SkillsContentPreviewsListQuery>(0);
