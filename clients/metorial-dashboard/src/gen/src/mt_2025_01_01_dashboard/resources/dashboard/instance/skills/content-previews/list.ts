import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsContentPreviewsListOutput = {
  items: {
    object: 'skill.content_preview';
    skillId: string;
    content: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsContentPreviewsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsContentPreviewsListOutput>(
    [7, [1, ['skill_id']]]
  );

export type DashboardInstanceSkillsContentPreviewsListQuery = {
  id: string | string[];
};

export let mapDashboardInstanceSkillsContentPreviewsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsContentPreviewsListQuery>(
    0
  );
