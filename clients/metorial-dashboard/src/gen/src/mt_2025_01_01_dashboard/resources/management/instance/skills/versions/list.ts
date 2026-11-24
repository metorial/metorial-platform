import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsVersionsListOutput = {
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

export let mapManagementInstanceSkillsVersionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsVersionsListOutput>(
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

export type ManagementInstanceSkillsVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceSkillsVersionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceSkillsVersionsListQuery>(0);
