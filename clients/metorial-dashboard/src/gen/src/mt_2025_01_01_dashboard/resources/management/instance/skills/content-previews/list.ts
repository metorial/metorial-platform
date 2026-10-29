import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsContentPreviewsListOutput = {
  items: {
    object: 'skill.content_preview';
    skillId: string;
    content: string | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceSkillsContentPreviewsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsContentPreviewsListOutput>(
    [7, [1, ['skill_id']]]
  );

export type ManagementInstanceSkillsContentPreviewsListQuery = {
  id: string | string[];
};

export let mapManagementInstanceSkillsContentPreviewsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsContentPreviewsListQuery>(
    0
  );
