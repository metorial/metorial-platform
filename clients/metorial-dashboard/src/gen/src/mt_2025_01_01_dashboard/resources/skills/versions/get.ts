import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsVersionsGetOutput = {
  object: 'skill.version';
  id: string;
  skillId: string;
  storeId: string;
  storeVersionId: string;
  versionNumber: number;
  createdAt: Date;
};

export let mapSkillsVersionsGetOutput = mtMap.object<SkillsVersionsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
  storeId: mtMap.objectField('store_id', mtMap.passthrough()),
  storeVersionId: mtMap.objectField('store_version_id', mtMap.passthrough()),
  versionNumber: mtMap.objectField('version_number', mtMap.passthrough()),
  createdAt: mtMap.objectField('created_at', mtMap.date())
});

