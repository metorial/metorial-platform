import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsContentPreviewsListOutput = {
  items: {
    object: 'skill.content_preview';
    type: 'skill' | 'skill_template';
    skillId: string | null;
    skillTemplateId: string | null;
    content: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsContentPreviewsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsContentPreviewsListOutput>(
    [7, [1, ['skill_id', 'skill_template_id']]]
  );

export type DashboardInstanceSkillsContentPreviewsListQuery = {
  skillId?: string | string[] | undefined;
  skillTemplateId?: string | string[] | undefined;
};

export let mapDashboardInstanceSkillsContentPreviewsListQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsContentPreviewsListQuery>([
    'skill_id',
    'skill_template_id'
  ]);
