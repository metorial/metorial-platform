import { mtMap } from '@metorial/util-resource-mapper';

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

export let mapSkillsVersionsListOutput = mtMap.object<SkillsVersionsListOutput>(
  {
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
          storeId: mtMap.objectField('store_id', mtMap.passthrough()),
          storeVersionId: mtMap.objectField(
            'store_version_id',
            mtMap.passthrough()
          ),
          versionNumber: mtMap.objectField(
            'version_number',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  }
);

export type SkillsVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSkillsVersionsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

