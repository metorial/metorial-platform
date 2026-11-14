import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsContentPreviewsListOutput = {
  items: {
    object: 'skill.content_preview';
    type: 'skill' | 'skill_template';
    skillId: string | null;
    skillTemplateId: string | null;
    content: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsContentPreviewsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsContentPreviewsListOutput>(
    [7, [1, ['skill_id', 'skill_template_id']]]
  );

export type ManagementInstanceSkillsContentPreviewsListQuery = {
  skillId?: string | string[] | undefined;
  skillTemplateId?: string | string[] | undefined;
};

export let mapManagementInstanceSkillsContentPreviewsListQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsContentPreviewsListQuery>([
    'skill_id',
    'skill_template_id'
  ]);
