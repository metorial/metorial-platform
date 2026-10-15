import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SkillsVersionsListOutput = {
  items: {
    object: 'skill.version';
    id: string;
    skillId: string;
    storeId: string;
    storeVersionId: string;
    versionNumber: number;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsVersionsListOutput =
  /* @__PURE__ */ createMapper<SkillsVersionsListOutput>(
    [
      7,
      [
        1,
        [
          'skill_id',
          'store_id',
          'store_version_id',
          'version_number',
          'created_at'
        ]
      ]
    ],
    1
  );

export type SkillsVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSkillsVersionsListQuery =
  /* @__PURE__ */ createMapper<SkillsVersionsListQuery>(0);
