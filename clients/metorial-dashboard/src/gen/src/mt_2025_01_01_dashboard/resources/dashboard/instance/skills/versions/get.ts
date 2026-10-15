import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsVersionsGetOutput = {
  object: 'skill.version';
  id: string;
  skillId: string;
  storeId: string;
  storeVersionId: string;
  versionNumber: number;
  createdAt: Date;
};

export let mapDashboardInstanceSkillsVersionsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSkillsVersionsGetOutput>(
    [
      'skill_id',
      'store_id',
      'store_version_id',
      'version_number',
      'created_at'
    ],
    1
  );
